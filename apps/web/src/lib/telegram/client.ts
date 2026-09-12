import type { TelegramConfig } from "./config";

type FetchLike = typeof fetch;

/** Sends a plain text message. Reused by the webhook and the reminders scheduler. */
export async function sendTelegramMessage(
  config: TelegramConfig,
  chatId: string,
  text: string,
  fetcher: FetchLike = fetch,
): Promise<void> {
  if (config.dryRun) {
    console.info("Telegram dry run", { chatId, text });
    return;
  }
  const response = await fetcher(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
  }
}
