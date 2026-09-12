import { ZodError } from "zod";
import { sendTelegramMessage } from "./client";
import type { TelegramConfig } from "./config";
import type {
  AcordateAgent,
  AcordateUser,
  ActiveSentReminder,
  IncomingTelegramMessage,
} from "./types";
import { telegramUpdateSchema } from "./types";

const genericError = "No pude procesar tu mensaje. Intentá de nuevo en un momento.";

export function createTelegramWebhookHandler(options: {
  config: TelegramConfig | undefined;
  agent: AcordateAgent;
  resolveUser: (telegramUserId: string) => Promise<AcordateUser>;
  findLatestSentReminder: (
    userId: string,
  ) => Promise<ActiveSentReminder | null>;
  send?: (chatId: string, text: string) => Promise<void>;
  ready?: boolean;
}) {
  const send =
    options.send ??
    (options.config
      ? (chatId: string, text: string) =>
          sendTelegramMessage(options.config!, chatId, text)
      : undefined);

  return async (request: Request): Promise<Response> => {
    if (!options.config || !send || options.ready === false) {
      return Response.json(
        { error: "Telegram is not configured on this server." },
        { status: 503 },
      );
    }
    if (
      request.headers.get("x-telegram-bot-api-secret-token") !==
      options.config.webhookSecret
    ) {
      return Response.json({ error: "Unauthorized webhook." }, { status: 401 });
    }

    try {
      const update = telegramUpdateSchema.parse(await request.json());
      const message = update.message;
      if (!message?.text?.trim() || !message.from) {
        return Response.json({ ok: true, ignored: true });
      }

      const incoming: IncomingTelegramMessage = {
        chatId: String(message.chat.id),
        telegramUserId: String(message.from.id),
        messageId: String(message.message_id),
        text: message.text.trim(),
        receivedAt: new Date(message.date * 1_000).toISOString(),
      };
      try {
        const user = await options.resolveUser(incoming.telegramUserId);
        const activeSentReminder = /^hecho[.!\s]*$/iu.test(incoming.text)
          ? await options.findLatestSentReminder(user.id)
          : null;
        const result = await options.agent({
          userId: user.id,
          text: incoming.text,
          sourceMessageId: incoming.messageId,
          receivedAt: incoming.receivedAt,
          timezone: user.timezone,
          activeSentReminder,
        });
        await send(incoming.chatId, result.text);
        return Response.json(
          options.config.dryRun
            ? { ok: true, dryRun: true, reply: result.text }
            : { ok: true },
        );
      } catch (error) {
        console.error("Telegram message handling failed", error);
        try {
          await send(incoming.chatId, genericError);
        } catch {
          console.error("Telegram fallback reply failed");
        }
        return Response.json({ ok: true, handled: false });
      }
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid Telegram update." }, { status: 400 });
      }
      console.error("Telegram webhook failed", error);
      return Response.json({ error: "Webhook processing failed." }, { status: 500 });
    }
  };
}
