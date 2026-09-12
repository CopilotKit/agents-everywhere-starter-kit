/**
 * The purchasing agent's tools.
 *
 * Two rules shape this file:
 *
 * 1. **Every number the requester sees comes from the backend.** Tools post
 *    their own cards from the response they already hold, so a price or total
 *    never round-trips through the model as a component argument.
 *
 * 2. **The purchase order is gated on a human click.** `request_po_approval`
 *    posts a card and returns; issuing happens in the click handler, outside
 *    the agent loop. There is no tool the model can call to spend money.
 *
 * The thread-to-requisition binding lives in Channel thread state, because the
 * Channels `Thread` exposes no stable conversation id. That state is in-memory
 * unless `createChannel({ store })` is given a durable one, so a restart can
 * orphan an open thread — `get_request({ code })` is the recovery path.
 */
import { defineChannelTool } from "@copilotkit/channels";
import type {
  ChannelToolContext,
  InteractionContext,
} from "@copilotkit/channels";
import {
  procurementApi,
  ProcurementApiError,
  type ProcurementApi,
  type Requisition,
} from "agent-core";
import { z } from "zod";
import {
  approvalCard,
  comparisonCard,
  purchaseOrderCard,
  requisitionCard,
  rfqCard,
} from "./cards";

type ThreadBinding = { requisitionId?: string };

/**
 * The thread a tool actually receives.
 *
 * `@copilotkit/channels` also exports a `Thread` — the concrete core class,
 * with `deps`, `store` and friends — which is NOT what a tool context carries.
 * Deriving the type from the context keeps these helpers assignable.
 */
type ToolThread = ChannelToolContext["thread"];

/** Runs a backend call and turns a known failure into text the model can act on. */
async function attempt<T>(work: () => Promise<T>): Promise<T | string> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ProcurementApiError) return error.message;
    throw error;
  }
}

function isFailure<T>(result: T | string): result is string {
  return typeof result === "string";
}

async function boundRequisitionId(
  thread: ToolThread,
): Promise<string | undefined> {
  return (await thread.state<ThreadBinding>())?.requisitionId;
}

async function bind(thread: ToolThread, requisitionId: string): Promise<void> {
  await thread.setState<ThreadBinding>({ requisitionId });
}

/** The requisition for this thread, opening one on first use. */
async function ensureRequisition(
  api: ProcurementApi,
  thread: ToolThread,
  requesterId: string,
  title?: string,
): Promise<Requisition> {
  const existingId = await boundRequisitionId(thread);
  if (existingId) {
    const detail = await api.getRequisition(existingId);
    if (detail) return detail.requisition;
    // The binding outlived the record (backend reset mid-thread). Start over
    // rather than reporting a request that no longer exists.
  }
  const created = await api.createRequisition({ requesterId, title });
  await bind(thread, created.id);
  return created;
}

/** Line summaries the model needs to ask a good confirming question. */
function describeLines(requisition: Requisition) {
  return {
    code: requisition.code,
    status: requisition.status,
    lines: requisition.lines.map((line) => ({
      lineId: line.id,
      item: line.itemName,
      quantity: line.quantity,
      unit: line.unit,
      status: line.status,
      ...(line.candidates
        ? {
            options: line.candidates.map((candidate) => ({
              itemId: candidate.itemId,
              name: candidate.name,
              unit: candidate.unit,
            })),
          }
        : {}),
    })),
  };
}

/**
 * The tools, over one backend.
 *
 * Injected rather than resolved inside each handler so tests can hand in a
 * fresh in-memory backend per case — the module-level `procurementApi()`
 * stand-in is one instance per process, which would otherwise leak state
 * between tests. Same reason `createSearchTool` takes its search function.
 */
export function createProcurementTools(api: ProcurementApi = procurementApi()) {
  const browseCatalog = defineChannelTool({
    name: "browse_catalog",
    description:
      "List or search what can actually be ordered. Only catalog items are orderable — there is no way to add a new one. Call this when the requester asks what is available, or when you need to check whether something they named exists before telling them it does not.",
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Optional free-text filter, e.g. 'monitor' or 'pantry'. Omit to list everything.",
        ),
    }),
    async handler({ query }) {
      return attempt(async () => {
        const items = await api.listCatalog({ query, limit: 20 });
        if (items.length === 0) {
          return query
            ? `Nothing in the catalog matches "${query}". Tell the requester it is not available and offer to show what is.`
            : "The catalog is empty.";
        }
        return items.map((item) => ({
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          category: item.category,
        }));
      });
    },
  });

  const addItems = defineChannelTool({
    name: "add_items",
    description:
      "Add what the requester wants to buy to this request, in their own words — matching against the catalog is done for you. Returns every line with its status. A line coming back as needs_confirmation or unmatched is NOT settled: show the options and ask which they meant. Never pick for them.",
    parameters: z.object({
      items: z
        .array(
          z.object({
            text: z
              .string()
              .describe(
                "The requester's own words for one thing, e.g. 'a box of HDMI cables'.",
              ),
            quantity: z
              .number()
              .int()
              .positive()
              .optional()
              .describe("How many, when they said."),
          }),
        )
        .min(1)
        .describe("One entry per distinct thing they asked for."),
    }),
    async handler({ items }, { thread, user, actor }) {
      return attempt(async () => {
        const requisition = await ensureRequisition(
          api,
          thread,
          user?.id ?? actor.id,
          items[0]?.text.slice(0, 60),
        );
        const updated = await api.addItems({
          requisitionId: requisition.id,
          requests: items,
        });
        return describeLines(updated);
      });
    },
  });

  const resolveLine = defineChannelTool({
    name: "resolve_line",
    description:
      "Settle one line on this request: choose which catalog item they meant, change its quantity, or drop it. Pass itemId null to drop the line — that is the answer when they say none of the options is right. Call this once per line they answer about.",
    parameters: z.object({
      lineId: z.string().describe("The lineId from add_items or get_request."),
      itemId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Catalog itemId they picked, or null to drop the line. Omit to change only the quantity.",
        ),
      quantity: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("New quantity, when they changed it."),
    }),
    async handler({ lineId, itemId, quantity }, { thread }) {
      return attempt(async () => {
        const requisitionId = await boundRequisitionId(thread);
        if (!requisitionId) {
          return "This thread has no open request yet. Add items first, or ask the requester for the request code.";
        }
        const updated = await api.resolveLine({
          requisitionId,
          lineId,
          itemId,
          quantity,
        });
        return describeLines(updated);
      });
    },
  });

  const getRequest = defineChannelTool({
    name: "get_request",
    description:
      "The full state of a request — items, suppliers invited, quotes received, and any purchase order. Call this for every 'has it gone out', 'who has quoted', 'where is my PO' question instead of answering from memory. Posts a card, so do not restate the whole thing in prose. Pass a code to look up a different request and attach this thread to it.",
    parameters: z.object({
      code: z
        .string()
        .optional()
        .describe(
          "A request code like 'REQ-1042'. Omit for the request this thread is about.",
        ),
    }),
    async handler({ code }, { thread }) {
      return attempt(async () => {
        let requisitionId = await boundRequisitionId(thread);

        if (code) {
          const found = await api.getRequisitionByCode(code);
          if (!found)
            return `No request found with code ${code}. Say you cannot find it; do not guess at its state.`;
          requisitionId = found.id;
          await bind(thread, found.id);
        }
        if (!requisitionId) {
          return "This thread has no request yet. Ask what they would like to buy, or ask for a request code.";
        }

        const detail = await api.getRequisition(requisitionId);
        if (!detail)
          return "That request no longer exists. Say so rather than describing it.";

        await thread.post(requisitionCard(detail));
        return {
          posted: "requisition card",
          ...describeLines(detail.requisition),
          invited:
            detail.rfq?.invitations.map((invitation) => ({
              supplier: invitation.supplierName,
              status: invitation.status,
              ...(invitation.error ? { error: invitation.error } : {}),
            })) ?? [],
          quotesReceived: detail.quotes.length,
          purchaseOrder: detail.purchaseOrder
            ? {
                number: detail.purchaseOrder.number,
                supplier: detail.purchaseOrder.supplierName,
              }
            : null,
        };
      });
    },
  });

  const findRequests = defineChannelTool({
    name: "find_requests",
    description:
      "This requester's other requests, newest first. Use it for 'which of mine are still open' or 'where is the monitor request'. Report what each one is waiting on in plain words, not as a status code.",
    parameters: z.object({
      status: z
        .enum([
          "draft",
          "rfq_sent",
          "quotes_in",
          "approved",
          "ordered",
          "cancelled",
        ])
        .optional()
        .describe("Optional filter. Omit for all of them."),
    }),
    async handler({ status }, { user, actor }) {
      return attempt(async () => {
        const found = await api.findRequisitions({
          requesterId: user?.id ?? actor.id,
          status,
        });
        if (found.length === 0)
          return "This requester has no requests matching that.";
        return found.map((requisition) => ({
          code: requisition.code,
          title: requisition.title,
          status: requisition.status,
          itemCount: requisition.lines.length,
        }));
      });
    },
  });

  const sendForQuotes = defineChannelTool({
    name: "send_for_quotes",
    description:
      "Dispatch this request to suppliers for quotes. Only call this once the requester has said they are finished adding items. It refuses while any line is unconfirmed — if it does, confirm those lines first rather than retrying. Posts a card showing who was invited and whether any invitation failed.",
    parameters: z.object({}),
    async handler(_args, { thread }) {
      return attempt(async () => {
        const requisitionId = await boundRequisitionId(thread);
        if (!requisitionId) return "This thread has no open request to send.";

        const rfq = await api.sendForQuotes({ requisitionId });
        const detail = await api.getRequisition(requisitionId);
        if (detail) await thread.post(rfqCard(rfq, detail.requisition));

        const failed = rfq.invitations.filter(
          (invitation) => invitation.status === "failed",
        );
        return {
          posted: "RFQ card",
          invited: rfq.invitations.length,
          failed: failed.map((invitation) => ({
            supplier: invitation.supplierName,
            error: invitation.error,
          })),
          quotesAlreadyIn: detail?.quotes.length ?? 0,
          next:
            failed.length > 0
              ? "Tell the requester which invitations failed and offer resend_invitations."
              : "Tell them it is out with suppliers and you will compare quotes when they are back.",
        };
      });
    },
  });

  const resendInvitations = defineChannelTool({
    name: "resend_invitations",
    description:
      "Retry only the supplier invitations that failed to deliver. Call this when the requester asks you to, after send_for_quotes reported a failure.",
    parameters: z.object({}),
    async handler(_args, { thread }) {
      return attempt(async () => {
        const requisitionId = await boundRequisitionId(thread);
        if (!requisitionId) return "This thread has no open request.";

        const rfq = await api.resendFailedInvitations({ requisitionId });
        const detail = await api.getRequisition(requisitionId);
        if (detail) await thread.post(rfqCard(rfq, detail.requisition));
        const stillFailed = rfq.invitations.filter(
          (invitation) => invitation.status === "failed",
        );
        return {
          posted: "RFQ card",
          stillFailed: stillFailed.map((invitation) => invitation.supplierName),
          next:
            stillFailed.length > 0
              ? "Say which supplier still cannot be reached."
              : "Say the invitations went out on retry.",
        };
      });
    },
  });

  const compareQuotes = defineChannelTool({
    name: "compare_quotes",
    description:
      "Post the quote comparison for this request and return the figures. The card carries the totals, lead times and the recommendation — summarize in a sentence rather than repeating the table. If any line went unquoted, say so before recommending anything.",
    parameters: z.object({}),
    async handler(_args, { thread }) {
      return attempt(async () => {
        const requisitionId = await boundRequisitionId(thread);
        if (!requisitionId) return "This thread has no open request.";

        const detail = await api.getRequisition(requisitionId);
        if (!detail) return "That request no longer exists.";
        const comparison = await api.compareQuotes({ requisitionId });

        await thread.post(comparisonCard(comparison, detail.requisition));
        return {
          posted: "quote comparison card",
          quotes: comparison.quotes.map((quote) => ({
            quoteId: quote.id,
            supplier: quote.supplierName,
            total: quote.total,
            currency: quote.currency,
            leadTimeDays: quote.leadTimeDays,
            coversEveryLine: quote.lines.every((line) => line.available),
          })),
          recommendedQuoteId: comparison.recommendedQuoteId,
          rationale: comparison.rationale,
          unquotedItems: comparison.unquotedItemNames,
          next: comparison.recommendedQuoteId
            ? "Ask whether to raise a purchase order for the recommended quote, then call request_po_approval with its quoteId."
            : "There is nothing to recommend yet. Do not call request_po_approval.",
        };
      });
    },
  });

  const requestPoApproval = defineChannelTool({
    name: "request_po_approval",
    description:
      "Post an approval card for one quote. This is the ONLY way a purchase order is issued: a human clicks approve, and the click issues it. Call this and then STOP — do not say a PO exists, do not call other write tools, and do not describe the order as placed. The click posts the record itself.",
    parameters: z.object({
      quoteId: z
        .string()
        .describe("The quoteId to order against, from compare_quotes."),
    }),
    async handler({ quoteId }, { thread, user, actor }) {
      return attempt(async () => {
        const requisitionId = await boundRequisitionId(thread);
        if (!requisitionId) return "This thread has no open request.";

        const detail = await api.getRequisition(requisitionId);
        if (!detail) return "That request no longer exists.";
        if (detail.purchaseOrder) {
          return `${detail.requisition.code} already has purchase order ${detail.purchaseOrder.number}. Say so; do not raise another.`;
        }
        const quote = detail.quotes.find(
          (candidate) => candidate.id === quoteId,
        );
        if (!quote) {
          return `No quote ${quoteId} on this request. Call compare_quotes and use a quoteId from it.`;
        }
        const comparison = await api.compareQuotes({ requisitionId });
        const approvedBy = user?.id ?? actor.id;

        // The SDK keeps inline handlers alive after a message is replaced, so
        // queue clicks and settle only once. A second click — or the opposite
        // one — must not issue a second order.
        let settled = false;
        let chain = Promise.resolve();
        const decide = (
          approved: boolean,
          ctx: InteractionContext<boolean>,
        ) => {
          const run = async () => {
            if (settled) return;
            if (!approved) {
              await ctx.thread.update(
                ctx.message.ref,
                `Held by ${ctx.user?.name ?? "the approver"}. No purchase order was issued for ${detail.requisition.code}.`,
              );
              settled = true;
              return;
            }
            try {
              const order = await api.issuePurchaseOrder({
                requisitionId,
                quoteId,
                approvedBy,
              });
              // Replace the approval card first so it cannot be clicked again,
              // then post the record as its own message.
              await ctx.thread.update(
                ctx.message.ref,
                `Approved by ${ctx.user?.name ?? "the approver"} — ${order.number} issued to ${order.supplierName}.`,
              );
              await ctx.thread.post(purchaseOrderCard(order));
              settled = true;
            } catch (error) {
              // No model is in the loop here, so this has to be visible to people.
              const message =
                error instanceof ProcurementApiError
                  ? error.message
                  : "The purchase order could not be issued.";
              await ctx.thread.post(
                `Could not issue the purchase order for ${detail.requisition.code}: ${message}`,
              );
              // Deliberately left unsettled so the approver can retry the click.
            }
          };
          chain = chain.then(run, run);
          return chain;
        };

        await thread.post(
          approvalCard(quote, detail.requisition, comparison, decide),
        );

        // "Stop" on its own reads as "say nothing", which leaves the card sitting
      // in the thread with no sentence around it. Ask for the one line.
      return `Approval card posted for ${quote.supplierName} at ${quote.currency} ${quote.total.toFixed(2)}. Reply with ONE short sentence telling the requester it is waiting on their approval, then stop. Call no further tools. The purchase order is not issued until someone clicks approve, and that click posts the record itself — do not claim an order exists.`;
      });
    },
  });

  /** In the order the flow runs. */
  return [
    browseCatalog,
    addItems,
    resolveLine,
    getRequest,
    findRequests,
    sendForQuotes,
    resendInvitations,
    compareQuotes,
    requestPoApproval,
  ];
}

/** Registered in channel.tsx, against the configured backend. */
export const procurementTools = createProcurementTools();
