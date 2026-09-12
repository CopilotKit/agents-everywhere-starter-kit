import assert from "node:assert/strict";
import test from "node:test";
import { createTelegramWebhookHandler } from "./webhook";

const config = {
  botToken: "test-token",
  webhookSecret: "test-secret",
  dryRun: true,
};
const update = {
  update_id: 10,
  message: {
    message_id: 20,
    date: 1,
    chat: { id: 12345 },
    from: { id: 67890 },
    text: "  Guardá mi documento  ",
  },
};
const request = (body: unknown, secret = "test-secret") =>
  new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(body),
  });

test("webhook identifies the Telegram user and returns the agent result to the chat", async () => {
  const sent: Array<{ chatId: string; text: string }> = [];
  const handler = createTelegramWebhookHandler({
    config,
    agent: async (input) => {
      assert.deepEqual(input, { userId: "67890", message: "Guardá mi documento" });
      return { text: "Listo" };
    },
    send: async (chatId, text) => void sent.push({ chatId, text }),
  });
  const response = await handler(request(update));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, dryRun: true, reply: "Listo" });
  assert.deepEqual(sent, [{ chatId: "12345", text: "Listo" }]);
});

test("webhook rejects an incorrect secret before reading the update", async () => {
  let called = false;
  const handler = createTelegramWebhookHandler({
    config,
    agent: async () => {
      called = true;
      return { text: "unused" };
    },
    send: async () => {},
  });
  assert.equal((await handler(request(update, "wrong-secret"))).status, 401);
  assert.equal(called, false);
});

test("webhook safely acknowledges unsupported and malformed updates", async () => {
  const handler = createTelegramWebhookHandler({
    config,
    agent: async () => ({ text: "unused" }),
    send: async () => assert.fail("should not send"),
  });
  assert.equal((await handler(request({ update_id: 1 }))).status, 200);
  assert.equal((await handler(request({ nope: true }))).status, 400);
});
