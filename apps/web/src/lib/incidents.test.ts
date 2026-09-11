import assert from "node:assert/strict";
import test from "node:test";
import { findIncident, workspaceContext } from "./incidents";

test("selection changes the shared incident and timeline together", () => {
  const checkout = workspaceContext("INC-1042", []);
  const notifications = workspaceContext("INC-1043", []);
  assert.equal(checkout.selectedIncident.service, "Checkout API");
  assert.equal(notifications.selectedIncident.service, "Notifications");
  assert.match(notifications.selectedIncident.timeline[0].detail, /emails/);
  assert.equal(notifications.availableIncidents.length, 2);
});

test("unknown incidents are rejected and sample context is labeled", () => {
  assert.throws(() => findIncident("unknown"), /Unknown incident/);
  assert.match(workspaceContext("INC-1042", []).dataSource, /Fictional sample/);
});
