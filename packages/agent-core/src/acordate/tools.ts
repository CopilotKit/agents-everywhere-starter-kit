import { tool } from "ai";
import type { ServiceResult } from "./contracts";
import type { AcordateServices } from "./contracts";
import {
  completeReminderInputSchema,
  createReminderInputSchema,
  saveMemoryInputSchema,
  searchMemoryInputSchema,
  type ParsedRunAcordateAgentInput,
} from "./schemas";

export type AcordateToolName =
  | "saveMemory"
  | "searchMemory"
  | "createReminder"
  | "completeReminder";

export type AcordateToolOutcome =
  | { name: AcordateToolName; ok: true }
  | {
      name: AcordateToolName;
      ok: false;
      error: { code: string; message: string };
    };

type ObserveToolOutcome = (outcome: AcordateToolOutcome) => void;

function failure<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } };
}

async function safely<T>(
  operation: () => Promise<ServiceResult<T>>,
): Promise<ServiceResult<T>> {
  try {
    return await operation();
  } catch {
    return failure(
      "service_unavailable",
      "El servicio de persistencia falló. No se confirmó ni cambió nada.",
    );
  }
}

function report<T>(
  name: AcordateToolName,
  result: ServiceResult<T>,
  observe?: ObserveToolOutcome,
): ServiceResult<T> {
  observe?.(
    result.ok
      ? { name, ok: true }
      : { name, ok: false, error: result.error },
  );
  return result;
}

export function createAcordateTools(
  services: AcordateServices,
  context: ParsedRunAcordateAgentInput,
  observe?: ObserveToolOutcome,
) {
  return {
    saveMemory: tool({
      description:
        "Save information only when the user explicitly asks to remember or store it for later. Never use this merely because a message contains a fact.",
      inputSchema: saveMemoryInputSchema,
      execute: async ({ content }) =>
        report(
          "saveMemory",
          await safely(() =>
            services.memories.save({
              userId: context.userId,
              content,
              ...(context.sourceMessageId
                ? { sourceMessageId: context.sourceMessageId }
                : {}),
            }),
          ),
          observe,
        ),
    }),

    searchMemory: tool({
      description:
        "Search the user's persisted memories when answering about saved information or resolving a reference to earlier information. An empty result means there is no supporting memory; do not guess.",
      inputSchema: searchMemoryInputSchema,
      execute: async ({ query, limit }) =>
        report(
          "searchMemory",
          await safely(() =>
            services.memories.search({
              userId: context.userId,
              query,
              limit,
            }),
          ),
          observe,
        ),
    }),

    createReminder: tool({
      description:
        "Create a real reminder only after both the task and a concrete date-time are known. For references to saved information, call searchMemory first and include useful context and supporting memory IDs.",
      inputSchema: createReminderInputSchema,
      execute: async ({ title, dueAt, context: reminderContext, memoryIds }) => {
        if (Date.parse(dueAt) <= Date.parse(context.now)) {
          return report(
            "createReminder",
            failure(
              "due_at_not_future",
              "La fecha del recordatorio debe ser posterior a la hora actual. No se creó nada.",
            ),
            observe,
          );
        }

        return report(
          "createReminder",
          await safely(() =>
            services.reminders.create({
              userId: context.userId,
              title,
              dueAt,
              timezone: context.timezone,
              ...(reminderContext ? { context: reminderContext } : {}),
              memoryIds,
            }),
          ),
          observe,
        );
      },
    }),

    completeReminder: tool({
      description:
        "Complete a reminder only after the user explicitly says it is done and runtime context supplies the exact active reminder. Never treat delivery, reading, or an unrelated reaction as completion.",
      inputSchema: completeReminderInputSchema,
      execute: async ({ reminderId }) => {
        if (!context.activeReminder) {
          return report(
            "completeReminder",
            failure(
              "missing_active_reminder",
              "No se identificó un recordatorio activo. No se completó nada; hay que preguntar cuál quiso decir el usuario.",
            ),
            observe,
          );
        }
        if (context.activeReminder.id !== reminderId) {
          return report(
            "completeReminder",
            failure(
              "reminder_mismatch",
              "El recordatorio solicitado no coincide con el recordatorio activo. No se completó nada.",
            ),
            observe,
          );
        }

        return report(
          "completeReminder",
          await safely(() =>
            services.reminders.complete({
              userId: context.userId,
              reminderId,
            }),
          ),
          observe,
        );
      },
    }),
  };
}

export type AcordateTools = ReturnType<typeof createAcordateTools>;
