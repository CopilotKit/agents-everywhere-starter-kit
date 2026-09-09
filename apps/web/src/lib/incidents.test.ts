import assert from "node:assert/strict";
import test from "node:test";
import { createFollowup, findIncident, workspaceContext } from "./incidents";

test("selection changes the shared incident and timeline together", () => {
  const checkout = workspaceContext("INC-1042", []);
  const notifications = workspaceContext("INC-1043", []);
  assert.equal(checkout.selectedIncident.service, "Checkout API");
  assert.equal(notifications.selectedIncident.service, "Notifications");
  assert.match(notifications.selectedIncident.timeline[0].detail, /emails/);
  assert.equal(notifications.availableIncidents.length, 2);
});

test("follow-ups are trimmed and scoped to their incident when switching", () => {
  const tasks = [
    createFollowup("INC-1042", "  Check pool metrics  ", "task-1"),
    createFollowup("INC-1043", "Watch queue", "task-2"),
  ];
  assert.equal(tasks[0].title, "Check pool metrics");
  assert.deepEqual(workspaceContext("INC-1042", tasks).followups, [tasks[0]]);
  assert.deepEqual(workspaceContext("INC-1043", tasks).followups, [tasks[1]]);
  assert.equal(tasks.length, 2);
});

test("unknown incidents and empty or oversized follow-ups are rejected", () => {
  assert.throws(() => findIncident("unknown"), /Unknown incident/);
  assert.throws(
    () => createFollowup("unknown", "Task", "1"),
    /Unknown incident/,
  );
  assert.throws(() => createFollowup("INC-1042", " \n ", "1"), /title/);
  assert.throws(() => createFollowup("INC-1042", "x".repeat(201), "1"), /200/);
  assert.match(
    workspaceContext("INC-1042", []).dataSource,
    /No external task system/,
  );
});
