export type TelegramConfig = {
  botToken: string;
  webhookSecret: string;
  dryRun: boolean;
};

export function getTelegramConfig(env = process.env): TelegramConfig | undefined {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!botToken || !webhookSecret) return undefined;

  return {
    botToken,
    webhookSecret,
    dryRun: env.TELEGRAM_DRY_RUN === "true",
  };
}
