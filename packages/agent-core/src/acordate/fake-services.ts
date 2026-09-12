import type {
  AcordateServices,
  CreateReminderRequest,
  MemoryRecord,
  MemoryService,
  ReminderRecord,
  ReminderService,
  ToolFailure,
} from "./contracts";

type Clock = () => Date;

function tokens(value: string): Set<string> {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  );
}

function failure(code: ToolFailure["code"], message: string): ToolFailure {
  return { ok: false, code, message };
}

export class InMemoryMemoryService implements MemoryService {
  readonly #records = new Map<string, MemoryRecord[]>();
  #sequence = 0;

  constructor(private readonly clock: Clock = () => new Date()) {}

  async save({
    userId,
    content,
    sourceMessageId,
  }: Parameters<MemoryService["save"]>[0]) {
    const memory: MemoryRecord = {
      id: `memory-${++this.#sequence}`,
      userId,
      content,
      sourceMessageId,
      createdAt: this.clock().toISOString(),
    };
    const records = this.#records.get(userId) ?? [];
    records.push(memory);
    this.#records.set(userId, records);
    return { ok: true as const, memory };
  }

  async search({ userId, query }: Parameters<MemoryService["search"]>[0]) {
    const queryTokens = tokens(query);
    const memories = (this.#records.get(userId) ?? [])
      .map((memory) => ({
        memory,
        matches: [...queryTokens].filter((token) =>
          tokens(memory.content).has(token),
        ).length,
      }))
      .filter(({ matches }) => matches > 0)
      .sort(
        (a, b) =>
          b.matches - a.matches ||
          b.memory.createdAt.localeCompare(a.memory.createdAt),
      )
      .slice(0, 3)
      .map(({ memory, matches }) => ({
        id: memory.id,
        content: memory.content,
        createdAt: memory.createdAt,
        score: Math.min(1, matches / Math.max(queryTokens.size, 1)),
      }));
    return { ok: true as const, memories };
  }

  recordsFor(userId: string): readonly MemoryRecord[] {
    return [...(this.#records.get(userId) ?? [])];
  }
}

export class InMemoryReminderService implements ReminderService {
  readonly #records = new Map<string, ReminderRecord[]>();
  #sequence = 0;

  constructor(private readonly clock: Clock = () => new Date()) {}

  async create(input: CreateReminderRequest) {
    const reminder: ReminderRecord = {
      id: `reminder-${++this.#sequence}`,
      userId: input.userId,
      title: input.title,
      scheduledAt: input.scheduledAt,
      status: "pending",
      context: input.context,
      sourceMemoryIds: [...input.sourceMemoryIds],
      sentAt: null,
      completedAt: null,
      createdAt: this.clock().toISOString(),
    };
    const records = this.#records.get(input.userId) ?? [];
    records.push(reminder);
    this.#records.set(input.userId, records);
    return { ok: true as const, reminder };
  }

  async complete({
    userId,
    reminderId,
  }: Parameters<ReminderService["complete"]>[0]) {
    const records = this.#records.get(userId) ?? [];
    const index = records.findIndex((record) => record.id === reminderId);
    const current = records[index];
    if (!current) {
      return failure(
        "NO_ACTIVE_REMINDER",
        "No tenés un recordatorio enviado para completar.",
      );
    }
    if (current.status === "completed") {
      return failure("CONFLICT", "El recordatorio ya estaba completado.");
    }
    if (current.status !== "sent") {
      return failure(
        "NO_ACTIVE_REMINDER",
        "Ese recordatorio todavía no fue enviado.",
      );
    }

    const reminder: ReminderRecord = {
      ...current,
      status: "completed",
      completedAt: this.clock().toISOString(),
    };
    records[index] = reminder;
    return { ok: true as const, reminder };
  }

  markSent(userId: string, reminderId: string): ReminderRecord | undefined {
    const records = this.#records.get(userId) ?? [];
    const index = records.findIndex((record) => record.id === reminderId);
    const current = records[index];
    if (!current) return undefined;
    const reminder: ReminderRecord = {
      ...current,
      status: "sent",
      sentAt: this.clock().toISOString(),
    };
    records[index] = reminder;
    return reminder;
  }

  recordsFor(userId: string): readonly ReminderRecord[] {
    return [...(this.#records.get(userId) ?? [])];
  }
}

export function createInMemoryAcordateServices(
  clock?: Clock,
): AcordateServices & {
  memories: InMemoryMemoryService;
  reminders: InMemoryReminderService;
} {
  return {
    memories: new InMemoryMemoryService(clock),
    reminders: new InMemoryReminderService(clock),
  };
}
