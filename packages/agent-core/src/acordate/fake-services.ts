import type {
  AcordateServices,
  CreateReminderRequest,
  MemoryRecord,
  MemoryService,
  ReminderRecord,
  ReminderService,
  ServiceResult,
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

function notFound<T>(message: string): ServiceResult<T> {
  return { ok: false, error: { code: "not_found", message } };
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
    const record: MemoryRecord = {
      id: `memory-${++this.#sequence}`,
      content,
      createdAt: this.clock().toISOString(),
      ...(sourceMessageId ? { sourceMessageId } : {}),
    };
    const records = this.#records.get(userId) ?? [];
    records.push(record);
    this.#records.set(userId, records);
    return { ok: true as const, value: record };
  }

  async search({
    userId,
    query,
    limit,
  }: Parameters<MemoryService["search"]>[0]) {
    const queryTokens = tokens(query);
    const matches = (this.#records.get(userId) ?? [])
      .map((record) => ({
        record,
        score: [...queryTokens].filter((token) =>
          tokens(record.content).has(token),
        ).length,
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.record.createdAt.localeCompare(a.record.createdAt),
      )
      .slice(0, limit)
      .map(({ record }) => record);
    return { ok: true as const, value: matches };
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
    const record: ReminderRecord = {
      id: `reminder-${++this.#sequence}`,
      title: input.title,
      dueAt: input.dueAt,
      timezone: input.timezone,
      ...(input.context ? { context: input.context } : {}),
      memoryIds: [...input.memoryIds],
      status: "pending",
      createdAt: this.clock().toISOString(),
    };
    const records = this.#records.get(input.userId) ?? [];
    records.push(record);
    this.#records.set(input.userId, records);
    return { ok: true as const, value: record };
  }

  async complete({
    userId,
    reminderId,
  }: Parameters<ReminderService["complete"]>[0]) {
    const records = this.#records.get(userId) ?? [];
    const index = records.findIndex((record) => record.id === reminderId);
    const current = records[index];
    if (!current) {
      return notFound<ReminderRecord>(
        "El recordatorio no existe para este usuario. No se completó nada.",
      );
    }
    if (current.status === "completed") {
      return {
        ok: false as const,
        error: {
          code: "already_completed",
          message: "El recordatorio ya estaba completado.",
        },
      };
    }

    const completed: ReminderRecord = {
      ...current,
      status: "completed",
      completedAt: this.clock().toISOString(),
    };
    records[index] = completed;
    return { ok: true as const, value: completed };
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
