export type ReminderStatus = "pending" | "sent" | "completed" | "failed";

export type Reminder = {
  id: string;
  userId: string;
  title: string;
  scheduledAt: string;
  status: ReminderStatus;
  context: string;
  sourceMemoryIds: string[];
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ToolFailure = {
  ok: false;
  code: "VALIDATION_ERROR" | "NOT_FOUND" | "NO_ACTIVE_REMINDER" | "CONFLICT" | "UNAVAILABLE";
  message: string;
};

export type CreateReminderInput = {
  userId: string;
  title: string;
  scheduledAt: string;
  context: string;
  sourceMemoryIds: string[];
  sourceMessageId: string;
};

export type CompleteReminderInput = { userId: string; reminderId: string };

export interface ReminderRepository {
  create(input: CreateReminderInput): Promise<Reminder>;
  completeSent(input: CompleteReminderInput, completedAt: string): Promise<Reminder | "not-found" | "conflict">;
  /** Atomically reserves due reminders. A reserved reminder has a single delivery row. */
  claimDue(now: string, limit: number): Promise<Reminder[]>;
  markDelivered(reminderId: string, deliveredAt: string): Promise<void>;
  markDeliveryFailed(reminderId: string, failedAt: string, error: unknown): Promise<void>;
}

export interface NotificationSender {
  send(notification: { userId: string; reminderId: string; text: string }): Promise<void>;
}

export function createReminder(
  repository: ReminderRepository,
  input: CreateReminderInput,
  now = new Date(),
): Promise<{ ok: true; reminder: Reminder } | ToolFailure> {
  if (!input.userId || !input.title.trim() || !input.context.trim() || !input.sourceMessageId) {
    return Promise.resolve({ ok: false, code: "VALIDATION_ERROR", message: "Faltan datos para crear el recordatorio." });
  }
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
    return Promise.resolve({ ok: false, code: "VALIDATION_ERROR", message: "La fecha del recordatorio debe ser futura." });
  }
  return repository.create({ ...input, title: input.title.trim(), context: input.context.trim() })
    .then((reminder) => ({ ok: true as const, reminder }))
    .catch(() => ({ ok: false as const, code: "UNAVAILABLE" as const, message: "No pude guardar el recordatorio. Intentá de nuevo." }));
}

export async function completeReminder(
  repository: ReminderRepository,
  input: CompleteReminderInput,
  now = new Date(),
): Promise<{ ok: true; reminder: Reminder } | ToolFailure> {
  const result = await repository.completeSent(input, now.toISOString()).catch(() => "unavailable" as const);
  if (result === "unavailable") return { ok: false, code: "UNAVAILABLE", message: "No pude completar el recordatorio. Intentá de nuevo." };
  if (result === "not-found") return { ok: false, code: "NO_ACTIVE_REMINDER", message: "No tenés un recordatorio activo para completar." };
  if (result === "conflict") return { ok: false, code: "CONFLICT", message: "Ese recordatorio ya fue completado o no está listo para completar." };
  return { ok: true, reminder: result };
}

export function reminderNotificationText(reminder: Reminder): string {
  return `🔔 Recordatorio\n${reminder.title}\n${reminder.context}\nRespondé “Hecho” cuando lo completes.`;
}

export type SchedulerResult = { processed: number; sent: number; failed: number };

export function createReminderScheduler(options: {
  repository: ReminderRepository;
  notificationSender: NotificationSender;
  now?: () => Date;
  batchSize?: number;
}) {
  const now = options.now ?? (() => new Date());
  const batchSize = options.batchSize ?? 50;
  return {
    async runDue(): Promise<SchedulerResult> {
      const startedAt = now().toISOString();
      const reminders = await options.repository.claimDue(startedAt, batchSize);
      let sent = 0;
      let failed = 0;
      for (const reminder of reminders) {
        try {
          await options.notificationSender.send({
            userId: reminder.userId,
            reminderId: reminder.id,
            text: reminderNotificationText(reminder),
          });
          await options.repository.markDelivered(reminder.id, now().toISOString());
          sent += 1;
        } catch (error) {
          console.error("Reminder delivery failed", { reminderId: reminder.id, error });
          try {
            await options.repository.markDeliveryFailed(reminder.id, now().toISOString(), error);
          } catch (markError) {
            console.error("Reminder failure state could not be recorded", { reminderId: reminder.id, error: markError });
          }
          failed += 1;
        }
      }
      return { processed: reminders.length, sent, failed };
    },
  };
}
