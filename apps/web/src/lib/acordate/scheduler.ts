import { createReminderScheduler } from "reminders";
import { sendTelegramMessage } from "@/lib/telegram/client";
import type { TelegramConfig } from "@/lib/telegram/config";
import {
  AcordateSupabaseStore,
  createReminderRepository,
} from "./supabase";

export function getCronSecret(env = process.env): string | undefined {
  return env.CRON_SECRET?.trim() || undefined;
}

export async function runAcordateScheduler(options: {
  store: AcordateSupabaseStore;
  telegram: TelegramConfig;
}) {
  const scheduler = createReminderScheduler({
    repository: createReminderRepository(options.store),
    notificationSender: {
      async send({ userId, text }) {
        const user = await options.store.userById(userId);
        await sendTelegramMessage(options.telegram, user.telegramId, text);
      },
    },
  });
  return scheduler.runDue();
}
