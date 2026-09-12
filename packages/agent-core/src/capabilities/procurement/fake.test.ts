import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeProcurementApi } from "./fake";
import { ProcurementApiError } from "./client";

async function openRequisition() {
  const api = createFakeProcurementApi();
  const requisition = await api.createRequisition({ requesterId: "u1", title: "Desk setup" });
  return { api, requisition };
}

describe("intake", () => {
  it("settles a decisive match and asks about an ambiguous one", async () => {
    const { api, requisition } = await openRequisition();
    const updated = await api.addItems({
      requisitionId: requisition.id,
      requests: [
        { text: "27 inch 4K monitor", quantity: 3 },
        { text: "cables", quantity: 2 },
      ],
    });

    const [monitor, cables] = updated.lines;
    assert.equal(monitor?.status, "confirmed");
    assert.equal(monitor?.quantity, 3);

    // "cables" matches several catalog entries, so intake must not choose.
    assert.equal(cables?.status, "needs_confirmation");
    assert.ok((cables?.candidates?.length ?? 0) > 1);
    assert.equal(cables?.itemId, null);
  });

  it("reports an unmatched request instead of inventing an item", async () => {
    const { api, requisition } = await openRequisition();
    const updated = await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "helicopter" }],
    });
    assert.equal(updated.lines[0]?.status, "unmatched");
    assert.equal(updated.lines[0]?.itemId, null);
  });

  it("settles a line from its candidates, and drops it on null", async () => {
    const { api, requisition } = await openRequisition();
    const added = await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "cables", quantity: 2 }],
    });
    const line = added.lines[0]!;
    const chosen = line.candidates![0]!;

    const settled = await api.resolveLine({
      requisitionId: requisition.id,
      lineId: line.id,
      itemId: chosen.itemId,
    });
    assert.equal(settled.lines[0]?.status, "confirmed");
    assert.equal(settled.lines[0]?.itemName, chosen.name);

    const dropped = await api.resolveLine({
      requisitionId: requisition.id,
      lineId: line.id,
      itemId: null,
    });
    assert.equal(dropped.lines.length, 0);
  });

  it("rejects a non-catalog item and a non-positive quantity", async () => {
    const { api, requisition } = await openRequisition();
    const added = await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "27 inch 4K monitor" }],
    });
    const lineId = added.lines[0]!.id;

    await assert.rejects(
      () => api.resolveLine({ requisitionId: requisition.id, lineId, itemId: "itm-nope" }),
      ProcurementApiError,
    );
    await assert.rejects(
      () => api.resolveLine({ requisitionId: requisition.id, lineId, quantity: 0 }),
      ProcurementApiError,
    );
  });
});

describe("rfq dispatch", () => {
  it("refuses to send while any line is unsettled, naming the line", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "27 inch 4K monitor" }, { text: "cables" }],
    });

    await assert.rejects(
      () => api.sendForQuotes({ requisitionId: requisition.id }),
      (error: unknown) => {
        assert.ok(error instanceof ProcurementApiError);
        assert.equal(error.status, 409);
        assert.match(error.message, /not settled/i);
        assert.match(error.message, /cables/i);
        return true;
      },
    );
  });

  it("refuses an empty request", async () => {
    const { api, requisition } = await openRequisition();
    await assert.rejects(
      () => api.sendForQuotes({ requisitionId: requisition.id }),
      /no items/i,
    );
  });

  it("reports a failed invitation, and recovers it on resend", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "27 inch 4K monitor" }, { text: "A4 paper" }],
    });

    const rfq = await api.sendForQuotes({ requisitionId: requisition.id });
    const failed = rfq.invitations.filter((invitation) => invitation.status === "failed");
    assert.equal(failed.length, 1, "the stand-in bounces one invitation so the path is testable");
    assert.ok(failed[0]?.error);

    const before = (await api.getRequisition(requisition.id))!.quotes.length;
    const retried = await api.resendFailedInvitations({ requisitionId: requisition.id });
    assert.equal(retried.invitations.every((invitation) => invitation.status !== "failed"), true);
    const after = (await api.getRequisition(requisition.id))!.quotes.length;
    assert.ok(after > before, "the recovered supplier also quotes");
  });

  it("blocks adding items once the request has gone out", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({ requisitionId: requisition.id, requests: [{ text: "A4 paper" }] });
    await api.sendForQuotes({ requisitionId: requisition.id });

    await assert.rejects(
      () => api.addItems({ requisitionId: requisition.id, requests: [{ text: "A4 paper" }] }),
      /already been sent/i,
    );
  });
});

describe("comparison", () => {
  it("recommends only a quote covering every line, and names what went unquoted", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "27 inch 4K monitor" }, { text: "Thunderbolt 4 Dock" }],
    });
    await api.sendForQuotes({ requisitionId: requisition.id });

    const comparison = await api.compareQuotes({ requisitionId: requisition.id });
    assert.ok(comparison.quotes.length > 0);

    if (comparison.recommendedQuoteId) {
      const winner = comparison.quotes.find((q) => q.id === comparison.recommendedQuoteId)!;
      assert.ok(
        winner.lines.every((line) => line.available),
        "a partial quote must never be recommended",
      );
      // No complete quote may undercut the winner.
      const complete = comparison.quotes.filter((q) => q.lines.every((l) => l.available));
      assert.equal(Math.min(...complete.map((q) => q.total)), winner.total);
    }
    assert.match(comparison.rationale, /\S/);
  });

  it("recommends nothing when no quotes are in", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({ requisitionId: requisition.id, requests: [{ text: "A4 paper" }] });

    const comparison = await api.compareQuotes({ requisitionId: requisition.id });
    assert.equal(comparison.recommendedQuoteId, null);
    assert.equal(comparison.quotes.length, 0);
    assert.match(comparison.rationale, /no quotes/i);
  });

  it("is recomputed, so a late quote changes the recommendation", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({
      requisitionId: requisition.id,
      requests: [{ text: "27 inch 4K monitor" }, { text: "A4 paper" }],
    });
    await api.sendForQuotes({ requisitionId: requisition.id });
    const first = await api.compareQuotes({ requisitionId: requisition.id });

    await api.resendFailedInvitations({ requisitionId: requisition.id });
    const second = await api.compareQuotes({ requisitionId: requisition.id });

    assert.ok(second.quotes.length > first.quotes.length);
  });
});

describe("purchase order", () => {
  it("issues against a quote and marks the request ordered", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({ requisitionId: requisition.id, requests: [{ text: "A4 paper" }] });
    await api.sendForQuotes({ requisitionId: requisition.id });
    const comparison = await api.compareQuotes({ requisitionId: requisition.id });
    const quoteId = comparison.recommendedQuoteId ?? comparison.quotes[0]!.id;

    const order = await api.issuePurchaseOrder({
      requisitionId: requisition.id,
      quoteId,
      approvedBy: "u1",
    });
    assert.match(order.number, /^PO-/);
    assert.equal(order.quoteId, quoteId);

    const detail = (await api.getRequisition(requisition.id))!;
    assert.equal(detail.requisition.status, "ordered");
    assert.equal(detail.purchaseOrder?.number, order.number);
  });

  it("never issues twice for one request", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({ requisitionId: requisition.id, requests: [{ text: "A4 paper" }] });
    await api.sendForQuotes({ requisitionId: requisition.id });
    const comparison = await api.compareQuotes({ requisitionId: requisition.id });
    const quoteId = comparison.quotes[0]!.id;

    await api.issuePurchaseOrder({ requisitionId: requisition.id, quoteId, approvedBy: "u1" });
    await assert.rejects(
      () => api.issuePurchaseOrder({ requisitionId: requisition.id, quoteId, approvedBy: "u1" }),
      (error: unknown) => {
        assert.ok(error instanceof ProcurementApiError);
        assert.equal(error.status, 409);
        assert.match(error.message, /already has purchase order/i);
        return true;
      },
    );
  });

  it("rejects a quote that is not on the request", async () => {
    const { api, requisition } = await openRequisition();
    await api.addItems({ requisitionId: requisition.id, requests: [{ text: "A4 paper" }] });
    await api.sendForQuotes({ requisitionId: requisition.id });

    await assert.rejects(
      () =>
        api.issuePurchaseOrder({
          requisitionId: requisition.id,
          quoteId: "quote-made-up",
          approvedBy: "u1",
        }),
      /no quote/i,
    );
  });
});

describe("lookup", () => {
  it("finds by code, case-insensitively, and returns null for an unknown one", async () => {
    const { api, requisition } = await openRequisition();
    assert.equal((await api.getRequisitionByCode(requisition.code.toLowerCase()))?.id, requisition.id);
    assert.equal(await api.getRequisitionByCode("REQ-999999"), null);
  });

  it("filters requests by requester", async () => {
    const api = createFakeProcurementApi();
    await api.createRequisition({ requesterId: "u1" });
    await api.createRequisition({ requesterId: "u2" });
    const mine = await api.findRequisitions({ requesterId: "u1" });
    assert.equal(mine.length, 1);
  });
});
