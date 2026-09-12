import { z } from "zod";

export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: z
      .object({
        message_id: z.number().int(),
        date: z.number().int(),
        chat: z.object({ id: z.number().int() }),
        from: z.object({ id: z.number().int() }).optional(),
        text: z.string().max(4_096).optional(),
      })
      .optional(),
  })
  .passthrough();

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export type IncomingTelegramMessage = {
  chatId: string;
  telegramUserId: string;
  text: string;
};

/**
 * Contract consumed by Persona 1. Persona 2 can replace the mock implementation
 * without changing the Telegram webhook.
 */
export type AcordateAgent = (input: {
  userId: string;
  message: string;
}) => Promise<{ text: string }>;
