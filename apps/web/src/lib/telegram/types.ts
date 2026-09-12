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
  messageId: string;
  text: string;
  receivedAt: string;
};

export type AcordateUser = {
  id: string;
  telegramId: string;
  timezone: string;
  createdAt: string;
};

export type ActiveSentReminder = {
  id: string;
  title: string;
  context: string;
};

export type AgentTurn = {
  userId: string;
  text: string;
  sourceMessageId: string;
  receivedAt: string;
  timezone: string;
  activeSentReminder: ActiveSentReminder | null;
};

export type AcordateAgent = (turn: AgentTurn) => Promise<{ text: string }>;
