import assert from "node:assert/strict";
import test from "node:test";
import { findIncident, workspaceContext } from "./incidents";
import type { WorkplaceTask } from "./followup-types";

test("selection changes the shared incident and timeline together", () => {
  const checkout = workspaceContext("INC-1042", []);
  const notifications = workspaceContext("INC-1043", []);
  assert.equal(checkout.selectedIncident.service, "Checkout API");
  assert.equal(notifications.selectedIncident.service, "Notifications");
  assert.match(notifications.selectedIncident.timeline[0].detail, /emails/);
  assert.equal(notifications.availableIncidents.length, 2);
});

test("workspace context labels sample incidents and provider follow-ups", () => {
  const tasks: WorkplaceTask[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Check pool metrics",
      description: "Provider task details\nagents-everywhere:INC-1042",
      url: null,
    },
  ];
  const context = workspaceContext("INC-1042", tasks);
  assert.throws(() => findIncident("unknown"), /Unknown incident/);
  assert.match(context.dataSource, /Fictional sample/);
  assert.match(context.dataSource, /Ambiguous/);
  assert.deepEqual(context.followups, tasks);
});
