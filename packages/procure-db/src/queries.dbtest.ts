import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  compareQuotes,
  createDraftRequisition,
  DomainError,
  getRequisitionDetail,
  listRequisitions,
  searchItems,
  selectInvitees,
  WEB_REQUESTER_ID,
} from "./index";
import { createTestDatabase, type TestDatabase } from "./testing";

let db: TestDatabase;
before(async () => {
  db = await createTestDatabase();
});
after(async () => {
  await db?.drop();
});

describe("catalog search", () => {
  it("matches plural, natural-language queries to both pen colours", async () => {
    const results = await searchItems(db.pool, { query: "4000 ballpoint pens" });
    const skus = results.filter((item) => item.matchScore === results[0]!.matchScore).map((item) => item.sku);
    assert.deepEqual(skus.sort(), ["OFF-PEN-BLK", "OFF-PEN-BLU"]);
  });

  it("filters by category without a query", async () => {
    const results = await searchItems(db.pool, { category: "facilities" });
    assert.equal(results.length, 3);
  });
});

describe("selectInvitees", () => {
  it("returns preferred suppliers first and fills to three", async () => {
    const invitees = await selectInvitees(db.pool, "office_supplies");
    assert.equal(invitees.length, 3);
    assert.deepEqual(
      invitees.slice(0, 2).map((invitee) => invitee.name),
      ["Acme Stationers", "Northwind Office Supply"],
    );
    assert.equal(invitees[2]?.preferred, false);
  });

  it("passes through a short list rather than inventing suppliers", async () => {
    const invitees = await selectInvitees(db.pool, "it_equipment");
    assert.equal(invitees.length, 2);
  });
});

describe("draft requisitions", () => {
  it("creates an intake requisition with resolved, categorised lines", async () => {
    const [pen] = await searchItems(db.pool, { query: "OFF-PEN-BLU" });
    const draft = await createDraftRequisition(db.pool, {
      requesterId: WEB_REQUESTER_ID,
      neededBy: "2026-09-18",
      lines: [{ itemId: pen!.id, quantity: 4000, rawDescription: "4000 ballpoint pens" }],
    });
    assert.equal(draft.status, "intake");
    assert.equal(draft.neededBy, "2026-09-18");
    assert.equal(draft.waitingOn, "requester_to_send");
    assert.equal(draft.lines[0]?.category, "office_supplies");
    assert.equal(draft.lines[0]?.quantityRequested, "4000.000");
    assert.equal(draft.rfq, null);

    const listed = await listRequisitions(db.pool, { requesterId: WEB_REQUESTER_ID });
    assert.ok(listed.some((row) => row.id === draft.id && row.summary === "Ballpoint pen, blue"));

    const comparison = await compareQuotes(db.pool, draft.id, "2026-09-12");
    assert.equal(comparison?.recommendedQuoteId, null);
    assert.equal(comparison?.reason, "No quotes have been received yet.");
  });

  it("rejects unknown items and non-positive quantities", async () => {
    await assert.rejects(
      createDraftRequisition(db.pool, {
        requesterId: WEB_REQUESTER_ID,
        neededBy: null,
        lines: [{ itemId: "00000000-0000-4000-8000-00000000dead", quantity: 1, rawDescription: "x" }],
      }),
      (error: unknown) => error instanceof DomainError && error.status === 404,
    );
    await assert.rejects(
      createDraftRequisition(db.pool, {
        requesterId: WEB_REQUESTER_ID,
        neededBy: null,
        lines: [{ itemId: "00000000-0000-4000-8000-00000000dead", quantity: 0, rawDescription: "x" }],
      }),
      /Quantity must be positive/,
    );
  });

  it("returns null for a missing requisition", async () => {
    assert.equal(await getRequisitionDetail(db.pool, "00000000-0000-4000-8000-000000000000"), null);
  });
});
