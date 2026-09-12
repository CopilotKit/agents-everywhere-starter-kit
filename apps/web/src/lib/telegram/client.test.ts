import assert from "node:assert/strict";
import test from "node:test";
import { sendTelegramMessage } from "./client";

const config = {
  botToken: "test-token",
  webhookSecret: "test-secret",
  dryRun: false,
};

test("Telegram delivery requires the API confirmation body", async () => {
  await assert.rejects(
    sendTelegramMessage(
      config,
      "123",
      "Recordatorio",
      async () => Response.json({ ok: false, description: "chat not found" }),
    ),
    /sendMessage failed/,
  );
});

test("Telegram delivery accepts an explicit API confirmation", async () => {
  await sendTelegramMessage(
    config,
    "123",
    "Recordatorio",
    async () => Response.json({ ok: true, result: { message_id: 1 } }),
  );
});
