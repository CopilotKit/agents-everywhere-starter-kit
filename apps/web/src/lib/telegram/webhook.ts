import { ZodError } from "zod";
import { sendTelegramMessage } from "./client";
import type { TelegramConfig } from "./config";
import { telegramUpdateSchema, type AcordateAgent } from "./types";

const genericError = "No pude procesar tu mensaje. Intentá de nuevo en un momento.";

export function createTelegramWebhookHandler(options: {
  config: TelegramConfig | undefined;
  agent: AcordateAgent;
  send?: (chatId: string, text: string) => Promise<void>;
}) {
  const send =
    options.send ??
    (options.config
      ? (chatId: string, text: string) =>
          sendTelegramMessage(options.config!, chatId, text)
      : undefined);

  return async (request: Request): Promise<Response> => {
    if (!options.config || !send) {
      return Response.json(
        { error: "Telegram is not configured on this server." },
        { status: 503 },
      );
    }
    if (
      options.config.webhookSecret &&
      request.headers.get("x-telegram-bot-api-secret-token") !==
        options.config.webhookSecret
    ) {
      return Response.json({ error: "Unauthorized webhook." }, { status: 401 });
    }

    try {
      const body = await request.json();
      const update = telegramUpdateSchema.parse(body);
      const message = update.message;
      // Telegram also sends edited messages, callbacks, and non-text content.
      // Acknowledge them to prevent retries, but do not treat them as commands.
      if (!message?.text?.trim() || !message.from) {
        return Response.json({ ok: true, ignored: true });
      }

      const chatId = String(message.chat.id);
      const userId = String(message.from.id);
      let replyPreview: string | undefined;
      try {
        const result = await options.agent({ userId, message: message.text.trim() });
        replyPreview = result.text;
        await send(chatId, result.text);
      } catch (error) {
        console.error("Telegram message handling failed", error);
        try {
          await send(chatId, genericError);
        } catch {
          console.error("Telegram fallback reply failed");
        }
      }
      return Response.json(
        options.config.dryRun
          ? { ok: true, dryRun: true, reply: replyPreview ?? genericError }
          : { ok: true },
      );
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid Telegram update." }, { status: 400 });
      }
      console.error("Telegram webhook failed", error);
      return Response.json({ error: "Webhook processing failed." }, { status: 500 });
    }
  };
}
