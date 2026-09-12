import assert from "node:assert/strict";
import test from "node:test";
import { triageBlockers, type Blocker } from "./triage";

const blockers: Blocker[] = [
  {
    id: "b1",
    label: "Confirmar presupuesto Q3",
    owner: "Dana",
    blocks: [],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "b2",
    label: "Elegir proveedor de pagos",
    owner: "Marco",
    blocks: ["b1"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
];

test("classifies each blocker from a single model call, in order", async () => {
  const result = await triageBlockers(blockers, async () =>
    JSON.stringify({
      results: [
        { id: "b1", kind: "confirmation", summary: "Pedir sí/no a Dana.", meetingMinutes: 15, attendees: 2 },
        { id: "b2", kind: "real_decision", summary: "Trade-off costo vs. tiempo de integración.", meetingMinutes: 45, attendees: 4 },
      ],
    }),
  );
  assert.equal(result[0].kind, "confirmation");
  assert.equal(result[0].status, "resolved");
  assert.equal(result[0].resolution?.summary, "Pedir sí/no a Dana.");
  assert.equal(result[0].savedPersonHours, 0.5);
  assert.equal(result[1].kind, "real_decision");
  assert.equal(result[1].status, "needs_meeting");
  assert.equal(result[1].savedPersonHours, 0);
});

test("malformed JSON falls back to confirmation for every node, never throws", async () => {
  const result = await triageBlockers(blockers, async () => "not json");
  assert.equal(result.length, 2);
  for (const b of result) {
    assert.equal(b.kind, "confirmation");
    assert.equal(b.status, "resolved");
    assert.ok(b.resolution?.summary.includes(b.owner));
  }
});

test("a completer that throws still returns a full, demo-safe result set", async () => {
  const result = await triageBlockers(blockers, async () => {
    throw new Error("network down");
  });
  assert.equal(result.length, 2);
  assert.ok(result.every((b) => b.status === "resolved"));
});

test("an empty blocker list is a no-op and never calls the model", async () => {
  let called = false;
  const result = await triageBlockers([], async () => {
    called = true;
    return "{}";
  });
  assert.deepEqual(result, []);
  assert.equal(called, false);
});
