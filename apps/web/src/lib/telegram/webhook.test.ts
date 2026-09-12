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
    date: 1_789_205_220,
    chat: { id: 12345 },
    from: { id: 67890 },
    text: "  Guardá mi documento  ",
  },
};
const request = (body: unknown, secret?: string) =>
  new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
    },
    body: JSON.stringify(body),
  });

function handler(overrides: Partial<Parameters<typeof createTelegramWebhookHandler>[0]> = {}) {
  return createTelegramWebhookHandler({
    config,
    agent: async (turn) => {
      assert.deepEqual(turn, {
        userId: "user-1",
        text: "Guardá mi documento",
        sourceMessageId: "20",
        receivedAt: "2026-09-12T09:27:00.000Z",
        timezone: "America/Asuncion",
        activeSentReminder: null,
      });
      return { text: "Listo" };
    },
    resolveUser: async () => ({
      id: "user-1",
      telegramId: "67890",
      timezone: "America/Asuncion",
      createdAt: "2026-09-12T15:00:00.000Z",
    }),
    findLatestSentReminder: async () => null,
    send: async () => {},
    ...overrides,
  });
}

test("webhook builds an AgentTurn from the authenticated Telegram update", async () => {
  const sent: Array<{ chatId: string; text: string }> = [];
  const response = await handler({
    send: async (chatId, text) => void sent.push({ chatId, text }),
  })(request(update, "test-secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, dryRun: true, reply: "Listo" });
  assert.deepEqual(sent, [{ chatId: "12345", text: "Listo" }]);
});

test("webhook rejects missing or incorrect secrets before resolving a user", async () => {
  let resolved = false;
  const secureHandler = handler({
    resolveUser: async () => {
      resolved = true;
      throw new Error("should not run");
    },
  });
  assert.equal((await secureHandler(request(update))).status, 401);
  assert.equal((await secureHandler(request(update, "wrong-secret"))).status, 401);
  assert.equal(resolved, false);
});

test("webhook supplies the latest sent reminder only for Hecho", async () => {
  let queriedFor: string | undefined;
  const doneUpdate = {
    ...update,
    message: { ...update.message, text: "Hecho" },
  };
  const doneHandler = handler({
    agent: async (turn) => {
      assert.deepEqual(turn.activeSentReminder, {
        id: "reminder-1",
        title: "Retirar certificado",
        context: "Llevá cédula.",
      });
      return { text: "Completado" };
    },
    findLatestSentReminder: async (userId) => {
      queriedFor = userId;
      return { id: "reminder-1", title: "Retirar certificado", context: "Llevá cédula." };
    },
  });
  assert.equal((await doneHandler(request(doneUpdate, "test-secret"))).status, 200);
  assert.equal(queriedFor, "user-1");
});

test("webhook reports unavailable configuration without accepting a request", async () => {
  const unavailable = handler({ config: undefined, ready: false });
  assert.equal((await unavailable(request(update, "test-secret"))).status, 503);
});
