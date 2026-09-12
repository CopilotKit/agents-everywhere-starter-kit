import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RequisitionDetail } from "procure-db/types";
import { createProcurementTools } from "./tools";
import type { ProcurementBackend } from "./backend";

const ID = "11111111-2222-4333-8444-555555555555";
const QUOTE_A = "aaaaaaaa-2222-4333-8444-555555555555";
const QUOTE_B = "bbbbbbbb-2222-4333-8444-555555555555";
const ITEM = "99999999-2222-4333-8444-555555555555";

function detail(over: Partial<RequisitionDetail> = {}): RequisitionDetail {
  return {
    id: ID,
    requesterId: "slack:U1",
    status: "intake",
    neededBy: "2026-09-18",
    waitingOn: "being put together",
    createdAt: "2026-09-12T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
    lines: [
      {
        id: "line-1",
        rawDescription: "4000 ballpoint pens",
        quantityRequested: "4000",
        category: "office_supplies",
        status: "resolved",
        itemId: ITEM,
        itemName: "Ballpoint pen, black",
        sku: "OFF-PEN-BLK",
        unitOfMeasure: "each",
      },
    ],
    rfq: null,
    quotes: [],
    approvals: [],
    purchaseOrders: [],
    ...over,
  };
}

const comparison = (over = {}) => ({
  requisitionId: ID,
  neededBy: "2026-09-18",
  rows: [
    { quoteId: QUOTE_A, supplierId: "s1", supplierName: "Acme", totalCents: 129500, leadTimeDays: 4, estimatedDelivery: "2026-09-16", meetsDeadline: true, complete: true },
    { quoteId: QUOTE_B, supplierId: "s2", supplierName: "Partial Co", totalCents: 99000, leadTimeDays: 2, estimatedDelivery: "2026-09-14", meetsDeadline: true, complete: false },
  ],
  recommendedQuoteId: QUOTE_A,
  reason: "Acme is the only complete quote that arrives on time.",
  ...over,
});

/** Records posts and holds thread state; only what these tools touch. */
function harness(over: Partial<ProcurementBackend> = {}) {
  const calls: string[] = [];
  const backend: ProcurementBackend = {
    searchItems: async () => {
      calls.push("searchItems");
      return [{ id: ITEM, sku: "OFF-PEN-BLK", name: "Ballpoint pen, black", description: null, category: "office_supplies", unitOfMeasure: "each", quantityOnHand: "0", matchScore: 2 }];
    },
    findSuppliers: async () => {
      calls.push("findSuppliers");
      return {
        wouldInvite: [{ id: "s1", name: "Acme", email: "a@example.com", preferred: true, quotesSubmitted: 3 }],
        allInCategory: [{ id: "s1", name: "Acme", email: "a@example.com", categories: [] }],
      };
    },
    listRequisitions: async () => {
      calls.push("listRequisitions");
      return [];
    },
    getRequisition: async () => detail(),
    createDraft: async () => {
      calls.push("createDraft");
      return detail();
    },
    compare: async () => comparison(),
    dispatchRfq: async () => {
      calls.push("dispatchRfq");
      return { requisitionId: ID, rfqId: "rfq-1", invitations: [{ supplierId: "s1", supplierName: "Acme", status: "sent" as const, error: null }] };
    },
    awardQuote: async () => {
      calls.push("awardQuote");
      return {
        requisitionId: ID,
        purchaseOrder: { id: "po-1", poNumber: "PO-1001", requisitionId: ID, supplierId: "s1", supplierName: "Acme", status: "issued" as const, issuedAt: "2026-09-12T00:00:00Z", emailedAt: null, emailError: null, totalCents: 129500, lines: [] },
        emailed: true,
        emailError: null,
      };
    },
    ...over,
  };

  const posts: unknown[] = [];
  const updates: unknown[] = [];
  let state: unknown;
  const thread = {
    async post(ui: unknown) { posts.push(ui); return { id: `m${posts.length}` }; },
    async update(_ref: unknown, ui: unknown) { updates.push(ui); return { id: "m1" }; },
    async setState(v: unknown) { state = v; },
    async state() { return state; },
  };
  const ctx = { thread, user: { id: "U1", name: "priya" }, actor: { id: "U1" }, platform: "slack" } as never;
  const byName = new Map(createProcurementTools(backend).map((t) => [t.name, t]));
  const call = (name: string, args: Record<string, unknown> = {}) => {
    const tool = byName.get(name);
    assert.ok(tool, `${name} registered`);
    return tool!.handler(args as never, ctx);
  };
  /**
   * Click a button on one posted card. Takes the card index rather than the
   * latest post, because approving posts a *result* card afterwards — so
   * "click again" must target the original approval card, not that result.
   */
  const buttonOn = (postIndex: number, value: boolean) => {
    const found: ((...a: unknown[]) => Promise<void>)[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === "object") {
        const o = node as Record<string, unknown>;
        if (typeof o.onClick === "function" && o.value === value) {
          found.push(o.onClick as never);
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(posts[postIndex]);
    assert.equal(found.length, 1, `exactly one button with value ${value} on card ${postIndex}`);
    return () =>
      found[0]!({
        thread,
        message: { ref: { id: "m1" } },
        user: { id: "U1", name: "priya" },
        action: { id: "a", value },
      });
  };
  /** Click the newest card's button. */
  const click = (value: boolean) => buttonOn(posts.length - 1, value)();

  return { call, click, buttonOn, posts, updates, calls, getState: () => state, backend };
}

describe("registration", () => {
  it("mirrors the ERP agent's tools plus the two Slack approval gates", () => {
    const names = createProcurementTools(harness().backend).map((t) => t.name);
    assert.deepEqual(names, [
      "browse_catalog",
      "find_suppliers",
      "create_requisition",
      "get_request",
      "find_requests",
      "compare_quotes",
      "propose_rfq",
      "propose_award",
    ]);
  });

  it("has no tool that sends email or issues a PO by itself", async () => {
    const h = harness();
    // Every non-approval tool, exercised; neither write may be reached.
    await h.call("browse_catalog", { query: "pens" });
    await h.call("find_suppliers", { category: "office_supplies" });
    await h.call("create_requisition", { neededBy: "2026-09-18", lines: [{ itemId: ITEM, quantity: 4000, rawDescription: "pens" }] });
    await h.call("get_request");
    await h.call("find_requests", { mine: true });
    await h.call("compare_quotes");
    assert.equal(h.calls.includes("dispatchRfq"), false);
    assert.equal(h.calls.includes("awardQuote"), false);
  });
});

describe("intake", () => {
  it("creates a draft, binds it to the thread, and posts the card", async () => {
    const h = harness();
    const result = (await h.call("create_requisition", {
      neededBy: "2026-09-18",
      lines: [{ itemId: ITEM, quantity: 4000, rawDescription: "4000 ballpoint pens" }],
    })) as { requisitionId: string; next: string };

    assert.equal(result.requisitionId, ID);
    assert.equal((h.getState() as { requisitionId: string }).requisitionId, ID);
    assert.equal(h.posts.length, 1);
    assert.match(result.next, /find_suppliers/);
  });

  it("passes the Slack user through as the requester", async () => {
    let seen: string | undefined;
    const h = harness({
      createDraft: async ({ requesterId }) => {
        seen = requesterId;
        return detail();
      },
    });
    await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] });
    assert.equal(seen, "slack:U1", "requester_id is TEXT precisely so this works");
  });
});

describe("rfq gate", () => {
  it("posts an approval card and emails nothing", async () => {
    const h = harness();
    await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] });
    const result = await h.call("propose_rfq");

    assert.match(String(result), /waiting on their approval/i);
    assert.equal(h.calls.includes("dispatchRfq"), false, "asking is not sending");
  });

  it("dispatches only on the approve click, exactly once", async () => {
    const h = harness();
    await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] });
    await h.call("propose_rfq");

    const approve = h.buttonOn(h.posts.length - 1, true);
    await approve();
    assert.equal(h.calls.filter((c) => c === "dispatchRfq").length, 1);
    await approve();
    assert.equal(h.calls.filter((c) => c === "dispatchRfq").length, 1, "a second click must not re-send");
  });

  it("cancelling sends nothing and says so", async () => {
    const h = harness();
    await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] });
    await h.call("propose_rfq");
    await h.click(false);

    assert.equal(h.calls.includes("dispatchRfq"), false);
    assert.match(String(h.updates.at(-1)), /nothing was emailed/i);
  });

  it("refuses to re-send a request that already went out", async () => {
    const h = harness({ getRequisition: async () => detail({ status: "rfq_dispatched", waitingOn: "waiting on quotes" }) });
    await h.call("get_request", { requisitionId: ID });
    const result = await h.call("propose_rfq");
    assert.match(String(result), /already been sent/i);
    assert.equal(h.posts.length, 1, "only the request card from the lookup");
  });
});

describe("award gate", () => {
  async function ready(over: Partial<ProcurementBackend> = {}) {
    const h = harness({ getRequisition: async () => detail({ status: "comparing" }), ...over });
    await h.call("get_request", { requisitionId: ID });
    return h;
  }

  it("posts an approval card and issues nothing", async () => {
    const h = await ready();
    const result = await h.call("propose_award", { quoteId: QUOTE_A });
    assert.match(String(result), /waiting on their approval/i);
    assert.equal(h.calls.includes("awardQuote"), false, "asking is not ordering");
  });

  it("issues only on the approve click, exactly once", async () => {
    const h = await ready();
    await h.call("propose_award", { quoteId: QUOTE_A });

    const approve = h.buttonOn(h.posts.length - 1, true);
    await approve();
    assert.equal(h.calls.filter((c) => c === "awardQuote").length, 1);
    await approve();
    assert.equal(h.calls.filter((c) => c === "awardQuote").length, 1, "a double click must not order twice");
  });

  it("refuses an incomplete quote before showing a card", async () => {
    const h = await ready();
    const result = await h.call("propose_award", { quoteId: QUOTE_B });
    assert.match(String(result), /does not price every line/i);
    assert.equal(h.posts.length, 1, "only the earlier request card");
  });

  it("refuses a quote that is not on the request", async () => {
    const h = await ready();
    const result = await h.call("propose_award", { quoteId: "cccccccc-2222-4333-8444-555555555555" });
    assert.match(String(result), /not on this request/i);
  });

  it("refuses a second purchase order", async () => {
    const h = await ready({
      getRequisition: async () =>
        detail({
          status: "po_issued",
          purchaseOrders: [{ id: "po-1", poNumber: "PO-1001", requisitionId: ID, supplierId: "s1", supplierName: "Acme", status: "issued", issuedAt: "x", emailedAt: null, emailError: null, totalCents: 1, lines: [] }],
        }),
    });
    const result = await h.call("propose_award", { quoteId: QUOTE_A });
    assert.match(String(result), /already has purchase order PO-1001/i);
  });
});

describe("placeholder ids", () => {
  // A live model sent requisitionId "00000000-0000-0000-0000-000000000000"
  // rather than omitting the optional parameter, and the lookup then failed.
  it("ignores a nil-UUID on get_request and falls back to the thread's request", async () => {
    const h = harness();
    await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] });
    const result = (await h.call("get_request", {
      requisitionId: "00000000-0000-0000-0000-000000000000",
    })) as { requisitionId: string };
    assert.equal(result.requisitionId, ID, "the thread binding wins over a made-up id");
  });

  it("gives the thread-scoped tools no id to invent", () => {
    const byName = new Map(createProcurementTools(harness().backend).map((t) => [t.name, t]));
    for (const name of ["compare_quotes", "propose_rfq"]) {
      const shape = JSON.stringify(byName.get(name)!.parameters);
      assert.doesNotMatch(shape, /requisitionId/, `${name} must not accept a requisitionId`);
    }
    assert.doesNotMatch(
      JSON.stringify(byName.get("propose_award")!.parameters),
      /requisitionId/,
      "propose_award takes only a quoteId",
    );
  });
});

describe("errors reach the requester in words they can pass on", () => {
  it("turns an unreachable database into a plain sentence with a reference", async () => {
    const h = harness({
      searchItems: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5434");
      },
    });
    const result = String(await h.call("browse_catalog", { query: "pens" }));
    assert.match(result, /could not reach the procurement system/i);
    assert.match(result, /Nothing was changed/i);
    assert.match(result, /PB-[A-Z0-9]{6}/, "carries a reference to quote");
    assert.doesNotMatch(result, /ECONNREFUSED|at .*\.ts:/, "no raw error, no stack");
    assert.match(result, /try again/i, "a connection refusal is safe to retry");
  });

  it("does not invite a retry when it cannot tell whether the write landed", async () => {
    const h = harness({
      dispatchRfq: async () => {
        throw new Error("The operation was aborted due to timeout");
      },
    });
    await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] });
    await h.call("propose_rfq");
    await h.click(true);

    const posted = String(h.posts.at(-1));
    assert.match(posted, /did not respond in time/i);
    assert.match(posted, /cannot confirm/i);
    assert.doesNotMatch(posted, /timeout was/i);
  });

  it("passes a DomainError through unchanged, since those are written for people", async () => {
    const domainError = Object.assign(new Error("A requisition needs at least one line."), { name: "DomainError" });
    const h = harness({
      createDraft: async () => {
        throw domainError;
      },
    });
    const result = String(await h.call("create_requisition", { neededBy: null, lines: [{ itemId: ITEM, quantity: 1, rawDescription: "x" }] }));
    assert.equal(result, "A requisition needs at least one line.");
  });
});
