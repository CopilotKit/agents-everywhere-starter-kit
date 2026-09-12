import { defineTool } from "@copilotkit/runtime/v2";
import {
  compareQuotes,
  createDraftRequisition,
  DomainError,
  getPool,
  getRequisitionDetail,
  listRequisitions,
  listSuppliers,
  searchItems,
  selectInvitees,
  WEB_REQUESTER_ID,
} from "procure-db";
import type { RequisitionStatus } from "procure-db/types";
import { z } from "zod";

// Reads and draft creation only. Sending RFQs and issuing POs are frontend
// approval tools (propose_rfq / propose_award) that call the api after a click.

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "expected a UUID from a previous tool result");
const today = () => new Date().toLocaleDateString("en-CA");

async function guard<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

const browseCatalog = defineTool({
  name: "browse_catalog",
  description:
    "Search the item catalog by the words in a request (e.g. 'ballpoint pens'), optionally within a category. Returns best matches first with a matchScore. Always call this before creating a requisition.",
  parameters: z.object({
    query: z.string().optional().describe("Words from the request, without quantities or dates"),
    category: z.string().optional().describe("office_supplies, it_equipment, or facilities"),
  }),
  execute: async ({ query, category }) => {
    const items = await searchItems(getPool(), { query, category, limit: 10 });
    return items.length ? items : { items: [], note: "No catalog items matched. Ask the requester to rephrase." };
  },
});

const findSuppliers = defineTool({
  name: "find_suppliers",
  description:
    "List the suppliers that would receive an RFQ for a category (preferred first, filled to at least three), plus every supplier in that category.",
  parameters: z.object({ category: z.string() }),
  execute: async ({ category }) => {
    const pool = getPool();
    const [invitees, all] = await Promise.all([selectInvitees(pool, category), listSuppliers(pool, { category })]);
    return { category, wouldInvite: invitees, allInCategory: all.map(({ id, name }) => ({ id, name })) };
  },
});

const findRequests = defineTool({
  name: "find_requests",
  description: "List recent requisitions with what each is waiting on (supplier quotes, award decision, delivery...).",
  parameters: z.object({
    status: z
      .enum(["intake", "rfq_dispatched", "comparing", "pending_approval", "approved", "rejected", "po_issued", "closed"])
      .optional(),
  }),
  execute: async ({ status }) => listRequisitions(getPool(), { status: status as RequisitionStatus | undefined, limit: 20 }),
});

const getRequest = defineTool({
  name: "get_request",
  description:
    "Full record for one requisition: lines, invited suppliers and their status, quotes, approvals, and purchase orders.",
  parameters: z.object({ requisitionId: id }),
  execute: async ({ requisitionId }) =>
    (await getRequisitionDetail(getPool(), requisitionId)) ?? { error: "Requisition not found." },
});

const createRequisition = defineTool({
  name: "create_requisition",
  description:
    "Create a draft requisition from resolved catalog items. Sends nothing to suppliers. Follow it with find_suppliers and propose_rfq.",
  parameters: z.object({
    neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Concrete date YYYY-MM-DD, or null"),
    lines: z
      .array(
        z.object({
          itemId: id,
          quantity: z.number().positive(),
          rawDescription: z.string().describe("The requester's own words for this line"),
        }),
      )
      .min(1),
  }),
  execute: async ({ neededBy, lines }) =>
    guard(async () => {
      const draft = await createDraftRequisition(getPool(), { requesterId: WEB_REQUESTER_ID, neededBy, lines });
      return {
        requisitionId: draft.id,
        status: draft.status,
        neededBy: draft.neededBy,
        lines: draft.lines.map(({ id, itemName, sku, quantityRequested, unitOfMeasure, category }) => ({
          id,
          itemName,
          sku,
          quantityRequested,
          unitOfMeasure,
          category,
        })),
        next: "Call find_suppliers for each category, then propose_rfq.",
      };
    }),
});

const compare = defineTool({
  name: "compare_quotes",
  description:
    "Rank the quotes received for a requisition: complete quotes first, then those arriving by the needed-by date, then lowest total, then shortest lead time. Returns rows, the recommended quote id, and the reason. Draw the result with quote_comparison.",
  parameters: z.object({ requisitionId: id }),
  execute: async ({ requisitionId }) => {
    const pool = getPool();
    const [comparison, detail] = await Promise.all([
      compareQuotes(pool, requisitionId, today()),
      getRequisitionDetail(pool, requisitionId),
    ]);
    if (!comparison || !detail) return { error: "Requisition not found." };
    const outstanding = (detail.rfq?.invitations ?? [])
      .filter((invitation) => invitation.status === "sent" || invitation.status === "send_failed")
      .map((invitation) => `${invitation.supplierName} (${invitation.status})`);
    return { ...comparison, today: today(), outstanding, alreadyOrdered: detail.purchaseOrders.map((po) => po.poNumber) };
  },
});

export const procurementTools = [browseCatalog, findSuppliers, findRequests, getRequest, createRequisition, compare];
