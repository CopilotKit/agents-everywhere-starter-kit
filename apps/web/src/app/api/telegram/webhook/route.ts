import { handleAcordateMessage } from "@/lib/telegram/agent";
import { getTelegramConfig } from "@/lib/telegram/config";
import { createTelegramWebhookHandler } from "@/lib/telegram/webhook";

export const runtime = "nodejs";

const handler = createTelegramWebhookHandler({
  config: getTelegramConfig(),
  agent: handleAcordateMessage,
});

export async function POST(request: Request) {
  return handler(request);
}

export function GET() {
  return Response.json({ status: "ok", service: "acordate-telegram-webhook" });
}
