import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeProcurementApi, type ProcurementApi } from "agent-core";
import { createProcurementTools } from "./tools";

/**
 * A thread that records what was posted and holds per-thread state, which is
 * where the requisition binding lives. Only the methods these tools touch.
 */
function stubThread() {
  const posts: unknown[] = [];
  const updates: { ref: unknown; ui: unknown }[] = [];
  let state: unknown;
  const thread = {
    async post(ui: unknown) {
      posts.push(ui);
      return { id: `m${posts.length}` };
    },
    async update(ref: unknown, ui: unknown) {
      updates.push({ ref, ui });
      return { id: "m1" };
    },
    async setState(value: unknown) {
      state = value;
    },
    async state() {
      return state;
    },
  };
  return { thread, posts, updates, getState: () => state };
}

function harness(api: ProcurementApi = createFakeProcurementApi()) {
  const tools = createProcurementTools(api);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const { thread, posts, updates, getState } = stubThread();
  const ctx = {
    thread,
    user: { id: "u1", name: "priya" },
    actor: { id: "a1" },
    platform: "slack",
  } as never;
  const call = (name: string, args: Record<string, unknown> = {}) => {
    const tool = byName.get(name);
    assert.ok(tool, `tool ${name} is registered`);
    return tool!.handler(args as never, ctx);
  };
  return { api, call, posts, updates, getState, tools };
}

describe("tool registration", () => {
  it("registers the whole flow", () => {
    const { tools } = harness();
    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        "browse_catalog",
        "add_items",
        "resolve_line",
        "get_request",
        "find_requests",
        "send_for_quotes",
        "resend_invitations",
        "compare_quotes",
        "request_po_approval",
      ],
    );
  });
});

describe("intake", () => {
  it("opens a requisition on first add and binds it to the thread", async () => {
    const { call, getState } = harness();
    const result = (await call("add_items", {
      items: [{ text: "27 inch 4K monitor", quantity: 2 }],
    })) as { code: string; lines: { status: string }[] };

    assert.match(result.code, /^REQ-/);
    assert.equal(result.lines[0]?.status, "confirmed");
    assert.match(
      String((getState() as { requisitionId: string }).requisitionId),
      /^req-/,
    );
  });

  it("hands the model the options for an ambiguous line rather than choosing", async () => {
    const { call } = harness();
    const result = (await call("add_items", {
      items: [{ text: "cables", quantity: 1 }],
    })) as {
      lines: { status: string; options?: { itemId: string; name: string }[] }[];
    };
    const line = result.lines[0]!;
    assert.equal(line.status, "needs_confirmation");
    assert.ok(
      (line.options?.length ?? 0) > 1,
      "more than one option to ask about",
    );
  });

  it("guides rather than throws when a line is resolved with no request open", async () => {
    const { call } = harness();
    const result = await call("resolve_line", {
      lineId: "line-nope",
      itemId: null,
    });
    assert.equal(typeof result, "string");
    assert.match(String(result), /no open request/i);
  });

  it("turns a backend rejection into text the model can act on", async () => {
    const { call } = harness();
    await call("add_items", { items: [{ text: "27 inch 4K monitor" }] });
    // A quantity of zero is refused by the backend; the tool must not throw,
    // or the agent loses the chance to ask for a sensible number.
    const added = (await call("add_items", {
      items: [{ text: "A4 paper" }],
    })) as {
      lines: { lineId: string }[];
    };
    const result = await call("resolve_line", {
      lineId: added.lines.at(-1)!.lineId,
      quantity: 0,
    });
    assert.equal(typeof result, "string");
    assert.match(String(result), /greater than zero/i);
  });
});

describe("request lookup", () => {
  it("posts a card and re-binds the thread when given a code", async () => {
    const api = createFakeProcurementApi();
    const seeded = await api.createRequisition({
      requesterId: "u1",
      title: "Seeded",
    });
    const { call, posts, getState } = harness(api);

    const result = (await call("get_request", { code: seeded.code })) as {
      code: string;
    };
    assert.equal(result.code, seeded.code);
    assert.equal(posts.length, 1, "the requisition card is posted");
    assert.equal(
      (getState() as { requisitionId: string }).requisitionId,
      seeded.id,
    );
  });

  it("says it cannot find an unknown code instead of guessing", async () => {
    const { call, posts } = harness();
    const result = await call("get_request", { code: "REQ-999999" });
    assert.match(String(result), /no request found/i);
    assert.equal(
      posts.length,
      0,
      "nothing is posted for a request that does not exist",
    );
  });
});

describe("rfq", () => {
  it("surfaces the unsettled-line refusal without throwing", async () => {
    const { call } = harness();
    await call("add_items", {
      items: [{ text: "27 inch 4K monitor" }, { text: "cables" }],
    });

    const result = await call("send_for_quotes");
    assert.equal(typeof result, "string");
    assert.match(String(result), /not settled/i);
  });

  it("reports failed invitations so a resend can be offered", async () => {
    const { call } = harness();
    await call("add_items", {
      items: [{ text: "27 inch 4K monitor" }, { text: "A4 paper" }],
    });
    const sent = (await call("send_for_quotes")) as {
      failed: { supplier: string }[];
      next: string;
    };
    assert.equal(sent.failed.length, 1);
    assert.match(sent.next, /resend_invitations/);

    const retried = (await call("resend_invitations")) as {
      stillFailed: string[];
    };
    assert.deepEqual(retried.stillFailed, []);
  });
});

describe("comparison", () => {
  it("posts the card and returns figures with a recommendation", async () => {
    const { call, posts } = harness();
    await call("add_items", { items: [{ text: "A4 paper", quantity: 10 }] });
    await call("send_for_quotes");

    const before = posts.length;
    const result = (await call("compare_quotes")) as {
      quotes: { quoteId: string; total: number }[];
      recommendedQuoteId: string | null;
      next: string;
    };
    assert.equal(posts.length, before + 1, "the comparison card is posted");
    assert.ok(result.quotes.length > 0);
    assert.ok(result.recommendedQuoteId);
    assert.match(result.next, /request_po_approval/);
  });

  it("tells the agent not to seek approval when there is nothing to recommend", async () => {
    const { call } = harness();
    await call("add_items", { items: [{ text: "A4 paper" }] });
    const result = (await call("compare_quotes")) as { next: string };
    assert.match(result.next, /do not call request_po_approval/i);
  });
});

describe("purchase order approval", () => {
  async function readyForApproval() {
    const h = harness();
    await h.call("add_items", { items: [{ text: "A4 paper", quantity: 5 }] });
    await h.call("send_for_quotes");
    const comparison = (await h.call("compare_quotes")) as {
      recommendedQuoteId: string;
      quotes: { quoteId: string }[];
    };
    return {
      ...h,
      quoteId: comparison.recommendedQuoteId ?? comparison.quotes[0]!.quoteId,
    };
  }

  /** The property that matters most: asking is not ordering. */
  it("posts an approval card and issues nothing", async () => {
    const { call, api, quoteId, posts, getState } = await readyForApproval();
    const before = posts.length;

    const result = await call("request_po_approval", { quoteId });
    assert.equal(posts.length, before + 1, "the approval card is posted");
    assert.match(String(result), /not issued until someone clicks approve/i);

    const detail = await api.getRequisition(
      (getState() as { requisitionId: string }).requisitionId,
    );
    assert.equal(detail?.purchaseOrder, null, "no purchase order exists yet");
    assert.notEqual(detail?.requisition.status, "ordered");
  });

  it("refuses a quote that is not on the request", async () => {
    const { call } = await readyForApproval();
    const result = await call("request_po_approval", {
      quoteId: "quote-invented",
    });
    assert.match(String(result), /no quote/i);
    assert.match(String(result), /compare_quotes/);
  });

  it("refuses to raise a second order once one exists", async () => {
    const { call, api, quoteId, getState } = await readyForApproval();
    const requisitionId = (getState() as { requisitionId: string })
      .requisitionId;
    await api.issuePurchaseOrder({ requisitionId, quoteId, approvedBy: "u1" });

    const result = await call("request_po_approval", { quoteId });
    assert.match(String(result), /already has purchase order/i);
  });
});
