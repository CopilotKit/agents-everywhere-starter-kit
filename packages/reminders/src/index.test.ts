import assert from "node:assert/strict";
import test from "node:test";
import {
  completeReminder,
  createReminder,
  createReminderScheduler,
  type Reminder,
  type ReminderRepository,
} from "./index";

const reminder: Reminder = {
  id: "r-1", userId: "u-1", title: "Retirar certificado", scheduledAt: "2026-09-12T16:00:00.000Z",
  status: "pending", context: "Llevá cédula.", sourceMemoryIds: [], sentAt: null, completedAt: null,
  createdAt: "2026-09-12T15:00:00.000Z",
};

test("scheduler sends claimed reminders and marks them sent only after delivery", async () => {
  const calls: string[] = [];
  const repository: ReminderRepository = {
    create: async () => reminder,
    completeSent: async () => "not-found",
    claimDue: async () => [reminder],
    markDelivered: async (id) => { calls.push(`sent:${id}`); },
    markDeliveryFailed: async (id) => { calls.push(`failed:${id}`); },
  };
  const scheduler = createReminderScheduler({
    repository,
    notificationSender: { send: async (item) => { calls.push(`send:${item.reminderId}`); assert.match(item.text, /Respondé “Hecho”/); } },
    now: () => new Date("2026-09-12T16:00:01.000Z"),
  });
  assert.deepEqual(await scheduler.runDue(), { processed: 1, sent: 1, failed: 0 });
  assert.deepEqual(calls, ["send:r-1", "sent:r-1"]);
});

test("scheduler records failed delivery and never marks it sent", async () => {
  const calls: string[] = [];
  const repository: ReminderRepository = {
    create: async () => reminder,
    completeSent: async () => "not-found",
    claimDue: async () => [reminder],
    markDelivered: async () => { calls.push("sent"); },
    markDeliveryFailed: async () => { calls.push("failed"); },
  };
  const scheduler = createReminderScheduler({ repository, notificationSender: { send: async () => { throw new Error("Telegram unavailable"); } } });
  assert.deepEqual(await scheduler.runDue(), { processed: 1, sent: 0, failed: 1 });
  assert.deepEqual(calls, ["failed"]);
});

test("tools validate a future reminder and only complete sent reminders", async () => {
  const repository: ReminderRepository = {
    create: async () => reminder,
    completeSent: async () => ({ ...reminder, status: "completed", completedAt: "2026-09-12T17:00:00.000Z" }),
    claimDue: async () => [], markDelivered: async () => {}, markDeliveryFailed: async () => {},
  };
  const invalid = await createReminder(repository, { userId: "u", title: "x", context: "y", sourceMemoryIds: [], sourceMessageId: "m", scheduledAt: "2026-09-12T15:00:00.000Z" }, new Date("2026-09-12T15:00:00.000Z"));
  assert.equal(invalid.ok, false);
  const completed = await completeReminder(repository, { userId: "u-1", reminderId: "r-1" }, new Date("2026-09-12T17:00:00.000Z"));
  assert.equal(completed.ok, true);
});
