import type pg from "pg";
import { DomainError } from "../errors";
import { withTransaction, type Db } from "../pool";
import type {
  ApprovalRecord,
  Invitation,
  RequisitionDetail,
  RequisitionLine,
  RequisitionListItem,
  RequisitionStatus,
} from "../types";
import { getPurchaseOrdersForRequisition } from "./purchaseOrders";
import { getQuotesForRequisition } from "./quotes";

export async function listRequisitions(
  db: Db,
  { status, requesterId, limit = 50 }: { status?: RequisitionStatus; requesterId?: string; limit?: number } = {},
): Promise<RequisitionListItem[]> {
  const { rows } = await db.query<RequisitionListItem>(
    `SELECT o.requisition_id AS id, o.items_summary AS summary, o.requester_id AS "requesterId",
            o.status, r.needed_by AS "neededBy", o.waiting_on AS "waitingOn",
            o.suppliers_invited AS "suppliersInvited", o.quotes_received AS "quotesReceived",
            o.po_total_cents AS "poTotalCents", o.created_at AS "createdAt"
     FROM reporting.requisition_overview o
     JOIN requisitions r ON r.id = o.requisition_id
     WHERE ($1::text IS NULL OR o.status = $1)
       AND ($2::text IS NULL OR o.requester_id = $2)
     ORDER BY o.created_at DESC
     LIMIT $3`,
    [status ?? null, requesterId ?? null, limit],
  );
  return rows;
}

export async function getRequisitionDetail(db: Db, id: string): Promise<RequisitionDetail | null> {
  const { rows } = await db.query<
    Omit<RequisitionDetail, "lines" | "rfq" | "quotes" | "approvals" | "purchaseOrders">
  >(
    `SELECT r.id, r.requester_id AS "requesterId", r.status, r.needed_by AS "neededBy",
            o.waiting_on AS "waitingOn", r.created_at AS "createdAt", r.updated_at AS "updatedAt"
     FROM requisitions r
     JOIN reporting.requisition_overview o ON o.requisition_id = r.id
     WHERE r.id = $1`,
    [id],
  );
  const header = rows[0];
  if (!header) return null;

  const [lines, rfq, invitations, quotes, approvals, purchaseOrders] = await Promise.all([
    db.query<RequisitionLine>(
      `SELECT rl.id, rl.raw_description AS "rawDescription",
              rl.quantity_requested::text AS "quantityRequested",
              coalesce(rl.category, i.category) AS category, rl.status, rl.item_id AS "itemId",
              i.name AS "itemName", i.sku, i.unit_of_measure AS "unitOfMeasure"
       FROM requisition_lines rl LEFT JOIN items i ON i.id = rl.item_id
       WHERE rl.requisition_id = $1
       ORDER BY rl.created_at`,
      [id],
    ),
    db.query<{ id: string; dispatchedAt: string }>(
      `SELECT id, dispatched_at AS "dispatchedAt" FROM rfqs WHERE requisition_id = $1`,
      [id],
    ),
    db.query<Invitation>(
      `SELECT inv.id, inv.supplier_id AS "supplierId", s.name AS "supplierName", inv.status,
              inv.sent_at AS "sentAt", inv.expires_at AS "expiresAt", inv.responded_at AS "respondedAt",
              inv.decline_reason AS "declineReason", inv.send_error AS "sendError"
       FROM invitations inv
       JOIN rfqs ON rfqs.id = inv.rfq_id
       JOIN suppliers s ON s.id = inv.supplier_id
       WHERE rfqs.requisition_id = $1
       ORDER BY s.name`,
      [id],
    ),
    getQuotesForRequisition(db, id),
    db.query<ApprovalRecord>(
      `SELECT id, amount_cents AS "amountCents", current_tier AS "currentTier",
              assigned_approver_id AS "assignedApproverId", status,
              selected_quote_id AS "selectedQuoteId", selected_by AS "selectedBy",
              created_at AS "createdAt", responded_at AS "respondedAt"
       FROM approval_requests WHERE requisition_id = $1 ORDER BY created_at`,
      [id],
    ),
    getPurchaseOrdersForRequisition(db, id),
  ]);

  const rfqRow = rfq.rows[0];
  return {
    ...header,
    lines: lines.rows,
    rfq: rfqRow ? { ...rfqRow, invitations: invitations.rows } : null,
    quotes,
    approvals: approvals.rows,
    purchaseOrders,
  };
}

export interface DraftLineInput {
  itemId: string;
  quantity: number;
  rawDescription: string;
}

export interface DraftRequisitionInput {
  requesterId: string;
  /** YYYY-MM-DD */
  neededBy: string | null;
  lines: DraftLineInput[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Creates an `intake` requisition whose lines are already resolved to catalog
 * items. Nothing is sent to suppliers; that happens on RFQ dispatch.
 */
export async function createDraftRequisition(
  pool: pg.Pool,
  input: DraftRequisitionInput,
): Promise<RequisitionDetail> {
  if (input.lines.length === 0) throw new DomainError("A requisition needs at least one line.");
  if (input.neededBy !== null && !ISO_DATE.test(input.neededBy)) {
    throw new DomainError(`neededBy must be YYYY-MM-DD, got "${input.neededBy}".`);
  }
  for (const line of input.lines) {
    if (!(line.quantity > 0)) throw new DomainError(`Quantity must be positive, got ${line.quantity}.`);
  }

  const id = await withTransaction(pool, async (client) => {
    const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
    const { rows: items } = await client.query<{ id: string; category: string | null }>(
      `SELECT id, category FROM items WHERE id = ANY($1::uuid[])`,
      [itemIds],
    );
    const categories = new Map(items.map((item) => [item.id, item.category]));
    const missing = itemIds.filter((itemId) => !categories.has(itemId));
    if (missing.length > 0) throw new DomainError(`Unknown catalog item id(s): ${missing.join(", ")}.`, 404);

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO requisitions (requester_id, status, needed_by) VALUES ($1, 'intake', $2) RETURNING id`,
      [input.requesterId, input.neededBy],
    );
    const requisitionId = rows[0]!.id;
    for (const line of input.lines) {
      await client.query(
        `INSERT INTO requisition_lines
           (requisition_id, raw_description, item_id, quantity_requested, category, status)
         VALUES ($1, $2, $3, $4, $5, 'resolved')`,
        [requisitionId, line.rawDescription, line.itemId, line.quantity, categories.get(line.itemId)],
      );
    }
    return requisitionId;
  });

  return (await getRequisitionDetail(pool, id))!;
}
