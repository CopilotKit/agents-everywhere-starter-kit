import { createAcordateServices, AcordateSupabaseStore, getSupabaseConfig } from "@/lib/acordate/supabase";
import { createAcordateTelegramAgent } from "@/lib/telegram/agent";
import { getTelegramConfig } from "@/lib/telegram/config";
import { createTelegramWebhookHandler } from "@/lib/telegram/webhook";

export const runtime = "nodejs";

const telegram = getTelegramConfig();
const supabase = getSupabaseConfig();
const store = supabase ? new AcordateSupabaseStore(supabase) : undefined;

const handler = createTelegramWebhookHandler({
  config: telegram,
  ready: Boolean(store),
  agent: store
    ? createAcordateTelegramAgent(createAcordateServices(store))
    : async () => {
        throw new Error("Acordate persistence is not configured.");
      },
  resolveUser: store
    ? (telegramUserId) => store.resolveUser(telegramUserId)
    : async () => {
        throw new Error("Acordate persistence is not configured.");
      },
  findLatestSentReminder: store
    ? (userId) => store.latestSentReminder(userId)
    : async () => {
        throw new Error("Acordate persistence is not configured.");
      },
});

export async function POST(request: Request) {
  return handler(request);
}

export function GET() {
  return Response.json({ status: "ok", service: "acordate-telegram-webhook" });
}
