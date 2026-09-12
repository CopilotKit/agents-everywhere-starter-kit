import { tool } from "ai";
import type { AcordateServices, ToolFailure } from "./contracts";
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
  | { name: AcordateToolName; ok: false; error: ToolFailure };

type ObserveToolOutcome = (outcome: AcordateToolOutcome) => void;
type ToolResult = { ok: boolean };

function failure(code: ToolFailure["code"], message: string): ToolFailure {
  return { ok: false, code, message };
}

function isFailure(value: ToolResult | ToolFailure): value is ToolFailure {
  return value.ok === false && "code" in value;
}

async function safely<T extends ToolResult>(
  operation: () => Promise<T>,
): Promise<T | ToolFailure> {
  try {
    return await operation();
  } catch {
    return failure(
      "UNAVAILABLE",
      "El servicio de persistencia falló. No se confirmó ni cambió nada.",
    );
  }
}

function report<T extends ToolResult>(
  name: AcordateToolName,
  result: T | ToolFailure,
  observe?: ObserveToolOutcome,
): T | ToolFailure {
  observe?.(isFailure(result)
    ? { name, ok: false, error: result }
    : { name, ok: true });
  return result;
}

export function createAcordateTools(
  services: AcordateServices,
  context: ParsedRunAcordateAgentInput,
  observe?: ObserveToolOutcome,
) {
  const retrievedMemoryIds = new Set<string>();

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
              sourceMessageId: context.sourceMessageId,
            }),
          ),
          observe,
        ),
    }),

    searchMemory: tool({
      description:
        "Search the user's persisted memories when answering about saved information or resolving a reference to earlier information. An empty result means there is no supporting memory; do not guess.",
      inputSchema: searchMemoryInputSchema,
      execute: async ({ query }) => {
        const result = await safely(() =>
          services.memories.search({ userId: context.userId, query }),
        );
        if (result.ok && "memories" in result) {
          for (const memory of result.memories) retrievedMemoryIds.add(memory.id);
        }
        return report("searchMemory", result, observe);
      },
    }),

    createReminder: tool({
      description:
        "Create a real reminder only after both the task and a concrete date-time are known. For references to saved information, call searchMemory first and include only returned memory IDs and useful context.",
      inputSchema: createReminderInputSchema,
      execute: async ({ title, scheduledAt, context: reminderContext, sourceMemoryIds }) => {
        if (Date.parse(scheduledAt) <= Date.parse(context.now)) {
          return report(
            "createReminder",
            failure(
              "VALIDATION_ERROR",
              "La fecha del recordatorio debe ser posterior a la hora actual. No se creó nada.",
            ),
            observe,
          );
        }
        if (sourceMemoryIds.some((id) => !retrievedMemoryIds.has(id))) {
          return report(
            "createReminder",
            failure(
              "VALIDATION_ERROR",
              "El contexto del recordatorio debe provenir de una búsqueda de memoria de este usuario.",
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
              scheduledAt,
              context: reminderContext,
              sourceMemoryIds,
              sourceMessageId: context.sourceMessageId,
            }),
          ),
          observe,
        );
      },
    }),

    completeReminder: tool({
      description:
        "Complete a reminder only after the user explicitly says it is done and runtime context supplies the exact sent reminder. Never treat delivery, reading, or an unrelated reaction as completion.",
      inputSchema: completeReminderInputSchema,
      execute: async ({ reminderId }) => {
        const activeReminder = context.activeSentReminder;
        if (!activeReminder) {
          return report(
            "completeReminder",
            failure(
              "NO_ACTIVE_REMINDER",
              "No se identificó un recordatorio enviado. No se completó nada.",
            ),
            observe,
          );
        }
        if (activeReminder.id !== reminderId) {
          return report(
            "completeReminder",
            failure(
              "CONFLICT",
              "El recordatorio solicitado no coincide con el último aviso enviado.",
            ),
            observe,
          );
        }
        return report(
          "completeReminder",
          await safely(() =>
            services.reminders.complete({ userId: context.userId, reminderId }),
          ),
          observe,
        );
      },
    }),
  };
}

export type AcordateTools = ReturnType<typeof createAcordateTools>;
