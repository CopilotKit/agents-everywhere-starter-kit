export type TelegramConfig = {
  botToken: string;
  webhookSecret: string | undefined;
  dryRun: boolean;
};

export function getTelegramConfig(env = process.env): TelegramConfig | undefined {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return undefined;

  return {
    botToken,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
    dryRun: env.TELEGRAM_DRY_RUN === "true",
  };
}
