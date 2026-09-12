/**
 * The Slack purchasing tools.
 *
 * Deliberately the same shape as apps/procure-agent's six server tools, so a
 * request behaves the same in Slack as it does in the ERP chat. The difference
 * is the SDK (`defineChannelTool` + Slack-native cards) and the two approval
 * gates, which are Channels cards here rather than React components.
 *
 * Two rules:
 *
 * 1. No tool sends email. `propose_rfq` and `propose_award` post a card and
 *    return; the emails and the purchase order happen in the click handler,
 *    outside the agent loop. This mirrors erp-frontend exactly.
 *
 * 2. Figures reach the screen from the backend response the tool holds, never
 *    as component arguments the model could retype.
 *
 * Managed Channels cannot block on `awaitChoice` (`supportsBlockingChoice` is
 * false on the Intelligence HTTP loop), so the pattern is post-then-update
 * rather than the ERP's `respond()` resume. The agent is told to stop and does
 * not learn the outcome; the card itself reports it.
 */
import { defineChannelTool } from "@copilotkit/channels";
import type { ChannelToolContext, InteractionContext } from "@copilotkit/channels";
import { z } from "zod";
import {
  awardApprovalCard,
  comparisonCard,
  money,
  purchaseOrderCard,
  requisitionCard,
  rfqApprovalCard,
  rfqResultCard,
} from "./cards";
import {
  BackendError,
  describeFailure,
  liveBackend,
  today,
  type ProcurementBackend,
} from "./backend";

type ToolThread = ChannelToolContext["thread"];
/** The requisition this thread is about. Channels' Thread exposes no id, so
 *  the binding lives in thread state. */
type ThreadBinding = { requisitionId?: string };

const UUID = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "expected an id from an earlier tool result");

async function boundId(thread: ToolThread): Promise<string | undefined> {
  return (await thread.state<ThreadBinding>())?.requisitionId;
}

/**
 * Models fill an optional id parameter with a placeholder rather than omitting
 * it — `00000000-0000-0000-0000-000000000000` was sent verbatim in testing.
 * Only `get_request` takes an id at all now, and it discards that.
 */
function realId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^0+(-0+)*$/.test(value.replace(/[^0-9a-f-]/gi, "")) ? undefined : value;
}

/** A Slack requester id. The schema stores requester_id as TEXT for this. */
function requesterOf(ctx: Pick<ChannelToolContext, "user" | "actor" | "platform">): string {
  return `${ctx.platform}:${ctx.user?.id ?? ctx.actor.id}`;
}

/**
 * Runs a backend call and turns any failure into one digestible sentence the
 * requester can pass on. Never a stack, never a response body — the detail is
 * logged against the reference inside `describeFailure`.
 */
async function attempt<T>(action: string, work: () => Promise<T>): Promise<T | string> {
  try {
    return await work();
  } catch (cause) {
    // procure-db's DomainError messages are already written for people.
    if (cause instanceof Error && cause.name === "DomainError") return cause.message;
    const failure = cause instanceof BackendError ? cause : describeFailure(cause, action);
    return failure.retryable
      ? `${failure.message} You can ask me to try again.`
      : `${failure.message} Do not ask me to retry; report it instead.`;
  }
}

export function createProcurementTools(backend: ProcurementBackend = liveBackend()) {
  const browseCatalog = defineChannelTool({
    name: "browse_catalog",
    description:
      "Search the item catalog by the words in a request (e.g. 'ballpoint pens'), optionally within a category. Returns best matches first with a matchScore. Always call this before creating a request — only catalog items can be ordered, and you cannot add new ones.",
    parameters: z.object({
      query: z.string().optional().describe("Words from the request, without quantities or dates"),
      category: z.string().optional().describe("office_supplies, it_equipment, or facilities"),
    }),
    async handler({ query, category }) {
      return attempt("searching the catalog", async () => {
        const items = await backend.searchItems({ query, category, limit: 10 });
        if (items.length === 0) {
          return "No catalog items matched. Tell the requester it is not in the catalog and ask them to rephrase.";
        }
        return items.map((item) => ({
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          unitOfMeasure: item.unitOfMeasure,
          category: item.category,
          matchScore: item.matchScore,
        }));
      });
    },
  });

  const findSuppliers = defineChannelTool({
    name: "find_suppliers",
    description:
      "List the suppliers that would receive an RFQ for a category (preferred first, filled to at least three), plus every supplier in that category. Call this for each category on the request before propose_rfq.",
    parameters: z.object({ category: z.string().describe("office_supplies, it_equipment, or facilities") }),
    async handler({ category }) {
      return attempt("looking up suppliers", async () => {
        const { wouldInvite, allInCategory } = await backend.findSuppliers(category);
        return {
          category,
          wouldInvite: wouldInvite.map((s) => ({ id: s.id, name: s.name, preferred: s.preferred, hasEmail: Boolean(s.email) })),
          allInCategory: allInCategory.map(({ id, name }) => ({ id, name })),
        };
      });
    },
  });

  const createRequisition = defineChannelTool({
    name: "create_requisition",
    description:
      "Create a draft request from catalog items you have already resolved. Sends nothing to anyone. Every line needs an itemId from browse_catalog. Resolve a vague date to YYYY-MM-DD against today first, and say which date you used. Follow this with find_suppliers, then propose_rfq.",
    parameters: z.object({
      neededBy: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .describe("Concrete date YYYY-MM-DD, or null if they did not say"),
      lines: z
        .array(
          z.object({
            itemId: UUID,
            quantity: z.number().positive(),
            rawDescription: z.string().describe("The requester's own words for this line"),
          }),
        )
        .min(1),
    }),
    async handler({ neededBy, lines }, { thread, user, actor, platform }) {
      return attempt("creating the request", async () => {
        const detail = await backend.createDraft({
          requesterId: requesterOf({ user, actor, platform }),
          neededBy,
          lines,
        });
        await thread.setState<ThreadBinding>({ requisitionId: detail.id });
        await thread.post(requisitionCard(detail));
        return {
          requisitionId: detail.id,
          status: detail.status,
          neededBy: detail.neededBy,
          categories: [...new Set(detail.lines.map((line) => line.category).filter(Boolean))],
          posted: "request card",
          next: "Call find_suppliers for each category, then propose_rfq.",
        };
      });
    },
  });

  const getRequest = defineChannelTool({
    name: "get_request",
    description:
      "The full state of a request — items, suppliers invited, quotes received, approvals and purchase orders. Call this for any 'has it gone out', 'who has quoted', 'where is my PO' question rather than answering from memory. Posts a card, so do not restate it all in prose. Omit the id for the request this thread is about.",
    parameters: z.object({
      requisitionId: UUID.optional().describe("Omit to use this thread's request"),
    }),
    async handler({ requisitionId }, { thread }) {
      return attempt("looking up the request", async () => {
        const given = realId(requisitionId);
        const id = given ?? (await boundId(thread));
        if (!id) return "This thread has no request yet. Ask what they need to order.";
        const detail = await backend.getRequisition(id);
        if (!detail) return "I cannot find that request. Say so; do not guess at its state.";
        if (given) await thread.setState<ThreadBinding>({ requisitionId: id });

        await thread.post(requisitionCard(detail));
        return {
          posted: "request card",
          requisitionId: detail.id,
          status: detail.status,
          waitingOn: detail.waitingOn,
          neededBy: detail.neededBy,
          invitations: (detail.rfq?.invitations ?? []).map((i) => ({
            supplier: i.supplierName,
            status: i.status,
            ...(i.sendError ? { error: i.sendError } : {}),
          })),
          quotesReceived: detail.quotes.length,
          purchaseOrders: detail.purchaseOrders.map((po) => ({ poNumber: po.poNumber, total: money(po.totalCents) })),
        };
      });
    },
  });

  const findRequests = defineChannelTool({
    name: "find_requests",
    description:
      "This requester's recent requests with what each is waiting on. Use it for 'which of mine are still open' or 'where is the pens request'. Report what each is waiting on in plain words, not as a status code.",
    parameters: z.object({
      status: z
        .enum(["intake", "rfq_dispatched", "comparing", "pending_approval", "approved", "rejected", "po_issued", "closed"])
        .optional()
        .describe("Optional filter; omit for all of them"),
      mine: z
        .boolean()
        .default(true)
        .describe("True (default) for only this requester's requests; false for everyone's"),
    }),
    async handler({ status, mine }, { user, actor, platform }) {
      return attempt("listing requests", async () => {
        const found = await backend.listRequisitions({
          status,
          ...(mine ? { requesterId: requesterOf({ user, actor, platform }) } : {}),
        });
        if (found.length === 0) {
          return mine
            ? "This requester has no requests matching that. Note that requests raised in the ERP belong to a different requester."
            : "No requests match that.";
        }
        return found.map((r) => ({
          requisitionId: r.id,
          summary: r.summary,
          status: r.status,
          waitingOn: r.waitingOn,
          neededBy: r.neededBy,
          quotesReceived: r.quotesReceived,
        }));
      });
    },
  });

  const compareQuotesTool = defineChannelTool({
    name: "compare_quotes",
    description:
      "Rank the quotes for a request: complete quotes first, then those arriving by the needed-by date, then lowest total, then shortest lead time. Posts the comparison card and returns the figures. Summarize the recommendation in one sentence; do not repeat the table. Say who has not answered yet.",
    // No requisitionId parameter: this always means the request this thread is
    // about, and an optional id is something the model invents a value for.
    parameters: z.object({}),
    async handler(_args, { thread }) {
      return attempt("comparing the quotes", async () => {
        const id = await boundId(thread);
        if (!id) return "This thread has no request yet.";
        const [comparison, detail] = await Promise.all([backend.compare(id), backend.getRequisition(id)]);
        if (!comparison || !detail) return "I cannot find that request.";

        await thread.post(comparisonCard(comparison));
        const outstanding = (detail.rfq?.invitations ?? [])
          .filter((i) => i.status === "sent" || i.status === "send_failed")
          .map((i) => `${i.supplierName} (${i.status})`);
        return {
          posted: "quote comparison card",
          today: today(),
          neededBy: comparison.neededBy,
          rows: comparison.rows.map((row) => ({
            quoteId: row.quoteId,
            supplier: row.supplierName,
            total: money(row.totalCents),
            estimatedDelivery: row.estimatedDelivery,
            meetsDeadline: row.meetsDeadline,
            coversEveryLine: row.complete,
          })),
          recommendedQuoteId: comparison.recommendedQuoteId,
          reason: comparison.reason,
          outstanding,
          alreadyOrdered: detail.purchaseOrders.map((po) => po.poNumber),
          next: comparison.recommendedQuoteId
            ? "Ask which quote they want, then call propose_award with that quoteId."
            : "There is nothing complete to recommend. Do not call propose_award.",
        };
      });
    },
  });

  /** Settles a click exactly once, so a second or opposite click cannot re-send. */
  function onceOnly(
    run: (approved: boolean, ctx: InteractionContext<boolean>) => Promise<void>,
  ): (approved: boolean, ctx: InteractionContext<boolean>) => Promise<void> {
    let settled = false;
    let chain = Promise.resolve();
    return (approved, ctx) => {
      const step = async () => {
        if (settled) return;
        try {
          await run(approved, ctx);
          settled = true;
        } catch (cause) {
          // No model is in the loop here, so people must see this.
          const failure = cause instanceof BackendError ? cause : describeFailure(cause, "that action");
          await ctx.thread.post(failure.message);
          // Left unsettled only when retrying is safe.
          settled = !failure.retryable;
        }
      };
      chain = chain.then(step, step);
      return chain;
    };
  }

  const proposeRfq = defineChannelTool({
    name: "propose_rfq",
    description:
      "Ask the requester to approve emailing RFQs for a draft request. Shows the lines and the exact suppliers. Emails go out ONLY if they click send. Call this and then STOP: say one short sentence that it is waiting on them, call no further tools, and do not claim anything was sent. The card reports the outcome itself.",
    parameters: z.object({}),
    async handler(_args, { thread }) {
      return attempt("preparing the RFQ", async () => {
        const id = await boundId(thread);
        if (!id) return "This thread has no request yet.";
        const detail = await backend.getRequisition(id);
        if (!detail) return "I cannot find that request.";
        if (detail.status !== "intake") {
          return `This request has already been sent out (${detail.waitingOn}). Say so; do not send it again.`;
        }

        // Same invitee computation apps/api's rfq-preview does, so the card
        // shows who will actually be emailed.
        const categories = [...new Set(detail.lines.map((line) => line.category).filter((c): c is string => Boolean(c)))];
        const invitees = new Map<string, Awaited<ReturnType<typeof backend.findSuppliers>>["wouldInvite"][number]>();
        for (const category of categories) {
          for (const supplier of (await backend.findSuppliers(category)).wouldInvite) {
            invitees.set(supplier.id, supplier);
          }
        }
        const list = [...invitees.values()];
        if (list.length === 0) return "No suppliers are set up for these categories, so I cannot send this out.";

        await thread.post(
          rfqApprovalCard(
            detail,
            list,
            onceOnly(async (approved, ctx) => {
              if (!approved) {
                await ctx.thread.update(
                  ctx.message.ref,
                  `Cancelled by ${ctx.user?.name ?? "the requester"}. Nothing was emailed; the request is still a draft.`,
                );
                return;
              }
              const result = await backend.dispatchRfq(id);
              const failed = result.invitations.filter((i) => i.status === "send_failed").length;
              await ctx.thread.update(
                ctx.message.ref,
                `Approved by ${ctx.user?.name ?? "the requester"} — RFQs sent to ${result.invitations.length - failed} of ${result.invitations.length} suppliers.`,
              );
              await ctx.thread.post(rfqResultCard(result));
            }),
          ),
        );
        return `Approval card posted for ${list.length} supplier(s). Reply with ONE short sentence that it is waiting on their approval, then stop. Call no further tools. Nothing is emailed until someone clicks send, and the card reports the result itself.`;
      });
    },
  });

  const proposeAward = defineChannelTool({
    name: "propose_award",
    description:
      "Ask the requester to approve issuing a purchase order for one quote. On approval the PO is created and emailed to the supplier. Call this and then STOP: say one short sentence that it is waiting on them, call no further tools, and never say a PO exists — a purchase order exists only once the card shows its number.",
    parameters: z.object({ quoteId: UUID.describe("The quoteId from compare_quotes") }),
    async handler({ quoteId }, { thread }) {
      return attempt("preparing the purchase order", async () => {
        const id = await boundId(thread);
        if (!id) return "This thread has no request yet.";
        const detail = await backend.getRequisition(id);
        if (!detail) return "I cannot find that request.";
        if (detail.purchaseOrders.length > 0) {
          return `This request already has purchase order ${detail.purchaseOrders[0]!.poNumber}. Say so; do not raise another.`;
        }
        const comparison = await backend.compare(id);
        if (!comparison) return "I cannot find that request.";
        const row = comparison.rows.find((candidate) => candidate.quoteId === quoteId);
        if (!row) return "That quote is not on this request. Call compare_quotes and use a quoteId from it.";
        if (!row.complete) {
          return `${row.supplierName}'s quote does not price every line, so it cannot be ordered as-is. Tell the requester and offer a complete quote instead.`;
        }

        await thread.post(
          awardApprovalCard(
            comparison,
            quoteId,
            onceOnly(async (approved, ctx) => {
              if (!approved) {
                await ctx.thread.update(
                  ctx.message.ref,
                  `Cancelled by ${ctx.user?.name ?? "the requester"}. No purchase order was created.`,
                );
                return;
              }
              const award = await backend.awardQuote(id, quoteId);
              await ctx.thread.update(
                ctx.message.ref,
                `Approved by ${ctx.user?.name ?? "the requester"} — ${award.purchaseOrder.poNumber} issued to ${award.purchaseOrder.supplierName}.`,
              );
              await ctx.thread.post(
                purchaseOrderCard(award.purchaseOrder, award.emailed, award.emailError),
              );
            }),
          ),
        );
        return `Approval card posted for ${row.supplierName} at ${money(row.totalCents)}. Reply with ONE short sentence that it is waiting on their approval, then stop. Call no further tools. No purchase order exists until someone clicks approve, and the card posts the record itself.`;
      });
    },
  });

  /** In the order the flow runs. */
  return [
    browseCatalog,
    findSuppliers,
    createRequisition,
    getRequest,
    findRequests,
    compareQuotesTool,
    proposeRfq,
    proposeAward,
  ];
}

/** Registered in channel.tsx, against Postgres and apps/api. */
export const procurementTools = createProcurementTools();
