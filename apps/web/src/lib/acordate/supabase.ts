import type {
  AcordateServices,
  CreateReminderRequest,
  MemoryRecord,
  ReminderRecord,
  ToolFailure,
} from "agent-core/acordate";
import type {
  Reminder,
  ReminderRepository,
} from "reminders";
import type { AcordateUser, ActiveSentReminder } from "@/lib/telegram/types";

type FetchLike = typeof fetch;

export type SupabaseConfig = {
  restUrl: string;
  serviceRoleKey: string;
};

type UserRow = {
  id: string;
  telegram_id: string;
  timezone: string;
  created_at: string;
};

type MemoryRow = {
  id: string;
  user_id: string;
  content: string;
  source_message_id: string;
  created_at: string;
  rank?: number | string;
};

type ReminderRow = {
  id: string;
  user_id: string;
  title: string;
  scheduled_at: string;
  status: "pending" | "sent" | "completed" | "failed";
  context: string;
  source_memory_ids: string[] | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
};

class SupabaseRequestError extends Error {
  constructor(status: number) {
    super(`Supabase request failed with HTTP ${status}.`);
    this.name = "SupabaseRequestError";
  }
}

function normalizeRestUrl(value: string): string {
  const withoutTrailingSlash = value.trim().replace(/\/+$/, "");
  return withoutTrailingSlash.endsWith("/rest/v1")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/rest/v1`;
}

export function getSupabaseConfig(env = process.env): SupabaseConfig | undefined {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return undefined;
  return { restUrl: normalizeRestUrl(url), serviceRoleKey };
}

function failure(code: ToolFailure["code"], message: string): ToolFailure {
  return { ok: false, code, message };
}

function toUser(row: UserRow): AcordateUser {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    timezone: row.timezone,
    createdAt: row.created_at,
  };
}

function toMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
  };
}

function toReminder(row: ReminderRow): ReminderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    status: row.status,
    context: row.context,
    sourceMemoryIds: row.source_memory_ids ?? [],
    sentAt: row.sent_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function toSchedulerReminder(row: ReminderRow): Reminder {
  return toReminder(row);
}

function escapeFilter(value: string): string {
  return encodeURIComponent(value.replace(/,/g, "\\,"));
}

export class AcordateSupabaseStore {
  constructor(
    private readonly config: SupabaseConfig,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.config.serviceRoleKey);
    headers.set("authorization", `Bearer ${this.config.serviceRoleKey}`);
    if (init.body) headers.set("content-type", "application/json");

    const response = await this.fetcher(`${this.config.restUrl}/${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) throw new SupabaseRequestError(response.status);
    if (response.status === 204) return undefined as T;
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  }

  async #rows<T>(path: string, init: RequestInit = {}): Promise<T[]> {
    return this.#request<T[]>(path, init);
  }

  async #rpc<T>(functionName: string, input: Record<string, unknown>): Promise<T> {
    return this.#request<T>(`rpc/${functionName}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async resolveUser(telegramUserId: string): Promise<AcordateUser> {
    const existing = await this.#rows<UserRow>(
      `users?telegram_id=eq.${escapeFilter(telegramUserId)}&select=id,telegram_id,timezone,created_at`,
    );
    if (existing[0]) return toUser(existing[0]);

    try {
      const created = await this.#rows<UserRow>("users?on_conflict=telegram_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          telegram_id: telegramUserId,
          timezone: "America/Asuncion",
        }),
      });
      if (created[0]) return toUser(created[0]);
    } catch (error) {
      if (!(error instanceof SupabaseRequestError)) throw error;
    }

    const resolved = await this.#rows<UserRow>(
      `users?telegram_id=eq.${escapeFilter(telegramUserId)}&select=id,telegram_id,timezone,created_at`,
    );
    if (!resolved[0]) throw new Error("Could not resolve Telegram user.");
    return toUser(resolved[0]);
  }

  async userById(userId: string): Promise<AcordateUser> {
    const rows = await this.#rows<UserRow>(
      `users?id=eq.${escapeFilter(userId)}&select=id,telegram_id,timezone,created_at`,
    );
    if (!rows[0]) throw new Error("Acordate user was not found.");
    return toUser(rows[0]);
  }

  async latestSentReminder(userId: string): Promise<ActiveSentReminder | null> {
    const rows = await this.#rows<Pick<ReminderRow, "id" | "title" | "context">>(
      `reminders?user_id=eq.${escapeFilter(userId)}&status=eq.sent&select=id,title,context&order=sent_at.desc&limit=1`,
    );
    return rows[0] ?? null;
  }

  async saveMemory(input: {
    userId: string;
    content: string;
    sourceMessageId: string;
  }): Promise<MemoryRecord> {
    const rows = await this.#rows<MemoryRow>("memories", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: input.userId,
        content: input.content,
        source_message_id: input.sourceMessageId,
      }),
    });
    if (!rows[0]) throw new Error("Supabase did not return the created memory.");
    return toMemory(rows[0]);
  }

  async searchMemories(userId: string, query: string) {
    const rows = await this.#rpc<MemoryRow[]>("search_memories_text", {
      match_user_id: userId,
      search_query: query,
      match_count: 3,
    });
    return rows.slice(0, 3).map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      score: Math.max(0, Math.min(1, Number(row.rank) || 0)),
    }));
  }

  async createReminder(input: CreateReminderRequest): Promise<ReminderRecord> {
    const rows = await this.#rows<ReminderRow>("reminders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: input.userId,
        title: input.title,
        scheduled_at: input.scheduledAt,
        status: "pending",
        context: input.context,
        source_memory_ids: input.sourceMemoryIds,
        source_message_id: input.sourceMessageId,
      }),
    });
    if (!rows[0]) throw new Error("Supabase did not return the created reminder.");
    return toReminder(rows[0]);
  }

  async completeSentReminder(
    userId: string,
    reminderId: string,
    completedAt: string,
  ): Promise<ReminderRecord | "not-found" | "conflict"> {
    const rows = await this.#rows<ReminderRow>(
      `reminders?id=eq.${escapeFilter(reminderId)}&user_id=eq.${escapeFilter(userId)}&status=eq.sent`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "completed", completed_at: completedAt }),
      },
    );
    if (rows[0]) return toReminder(rows[0]);

    const current = await this.#rows<Pick<ReminderRow, "status">>(
      `reminders?id=eq.${escapeFilter(reminderId)}&user_id=eq.${escapeFilter(userId)}&select=status`,
    );
    if (!current[0]) return "not-found";
    return current[0].status === "completed" ? "conflict" : "not-found";
  }

  async claimDue(now: string, limit: number): Promise<Reminder[]> {
    const rows = await this.#rpc<ReminderRow[]>("claim_due_reminders", {
      run_at: now,
      batch_size: limit,
    });
    return rows.map(toSchedulerReminder);
  }

  async markDelivered(reminderId: string, deliveredAt: string): Promise<void> {
    await this.#rpc("mark_reminder_delivered", {
      target_reminder_id: reminderId,
      delivered_at: deliveredAt,
    });
  }

  async markDeliveryFailed(reminderId: string, failedAt: string): Promise<void> {
    await this.#rpc("mark_reminder_delivery_failed", {
      target_reminder_id: reminderId,
      failed_at: failedAt,
    });
  }
}

export function createAcordateServices(
  store: AcordateSupabaseStore,
): AcordateServices {
  return {
    memories: {
      async save(input) {
        try {
          return { ok: true, memory: await store.saveMemory(input) };
        } catch (error) {
          console.error("Acordate memory save failed", error);
          return failure("UNAVAILABLE", "No pude guardar esa memoria. Intentá de nuevo.");
        }
      },
      async search(input) {
        try {
          return { ok: true, memories: await store.searchMemories(input.userId, input.query) };
        } catch (error) {
          console.error("Acordate memory search failed", error);
          return failure("UNAVAILABLE", "No pude consultar tus memorias. Intentá de nuevo.");
        }
      },
    },
    reminders: {
      async create(input) {
        try {
          return { ok: true, reminder: await store.createReminder(input) };
        } catch (error) {
          console.error("Acordate reminder create failed", error);
          return failure("UNAVAILABLE", "No pude crear el recordatorio. Intentá de nuevo.");
        }
      },
      async complete(input) {
        try {
          const result = await store.completeSentReminder(
            input.userId,
            input.reminderId,
            new Date().toISOString(),
          );
          if (result === "not-found") {
            return failure("NO_ACTIVE_REMINDER", "No tenés un recordatorio enviado para completar.");
          }
          if (result === "conflict") {
            return failure("CONFLICT", "Ese recordatorio ya fue completado.");
          }
          return { ok: true, reminder: result };
        } catch (error) {
          console.error("Acordate reminder completion failed", error);
          return failure("UNAVAILABLE", "No pude completar el recordatorio. Intentá de nuevo.");
        }
      },
    },
  };
}

export function createReminderRepository(
  store: AcordateSupabaseStore,
): ReminderRepository {
  return {
    create: (input) => store.createReminder(input),
    async completeSent(input, completedAt) {
      return store.completeSentReminder(input.userId, input.reminderId, completedAt);
    },
    claimDue: (now, limit) => store.claimDue(now, limit),
    markDelivered: (reminderId, deliveredAt) =>
      store.markDelivered(reminderId, deliveredAt),
    markDeliveryFailed: (reminderId, failedAt) =>
      store.markDeliveryFailed(reminderId, failedAt),
  };
}
