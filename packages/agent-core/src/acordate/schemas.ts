import { z } from "zod";

const nonEmptyId = z.string().trim().min(1).max(200);
const nonEmptyText = z.string().trim().min(1);

export const saveMemoryInputSchema = z
  .object({
    content: nonEmptyText
      .max(4_000)
      .describe("Information the user explicitly asked to remember."),
  })
  .strict();

export const searchMemoryInputSchema = z
  .object({
    query: nonEmptyText
      .max(500)
      .describe("A concise query describing the memory to retrieve."),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export const createReminderInputSchema = z
  .object({
    title: nonEmptyText
      .max(160)
      .describe("A short action-oriented reminder title."),
    dueAt: z.iso
      .datetime({ offset: true })
      .describe("Concrete ISO 8601 date-time including Z or a UTC offset."),
    context: nonEmptyText
      .max(2_000)
      .optional()
      .describe("Useful retrieved context to include in the notification."),
    memoryIds: z
      .array(nonEmptyId)
      .max(10)
      .default([])
      .describe("IDs of memories that support this reminder."),
  })
  .strict();

export const completeReminderInputSchema = z
  .object({
    reminderId: nonEmptyId.describe(
      "The exact active reminder ID supplied in runtime context.",
    ),
  })
  .strict();

const acordateMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: nonEmptyText.max(8_000),
  })
  .strict();

export const runAcordateAgentInputSchema = z
  .object({
    userId: nonEmptyId,
    messages: z.array(acordateMessageSchema).min(1).max(50),
    now: z.iso.datetime({ offset: true }),
    timezone: nonEmptyText.max(100).refine(
      (value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      },
      { message: "timezone must be a valid IANA time zone" },
    ),
    sourceMessageId: nonEmptyId.optional(),
    activeReminder: z
      .object({
        id: nonEmptyId,
        title: nonEmptyText.max(160),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((input) => input.messages.at(-1)?.role === "user", {
    message: "The last message must come from the user.",
    path: ["messages"],
  });

export type SaveMemoryInput = z.infer<typeof saveMemoryInputSchema>;
export type SearchMemoryInput = z.infer<typeof searchMemoryInputSchema>;
export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;
export type CompleteReminderInput = z.infer<
  typeof completeReminderInputSchema
>;
export type RunAcordateAgentInput = z.input<
  typeof runAcordateAgentInputSchema
>;
export type ParsedRunAcordateAgentInput = z.output<
  typeof runAcordateAgentInputSchema
>;
