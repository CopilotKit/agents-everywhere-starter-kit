import type { Db } from "procure-db";
import { getQuotesForRequisition } from "procure-db";
import type { InvitationStatus, Quote, RequisitionLine, RequisitionStatus } from "procure-db/types";

export interface PortalContext {
  invitation: {
    id: string;
    status: InvitationStatus;
    expiresAt: string;
    declineReason: string | null;
  };
  supplier: { id: string; name: string };
  requisition: { id: string; status: RequisitionStatus; neededBy: string | null };
  lines: RequisitionLine[];
  quote: Quote | null;
}

export async function loadPortalContext(db: Db, invitationId: string): Promise<PortalContext | null> {
  const { rows } = await db.query<{
    status: InvitationStatus;
    expiresAt: string;
    declineReason: string | null;
    supplierId: string;
    supplierName: string;
    requisitionId: string;
    requisitionStatus: RequisitionStatus;
    neededBy: string | null;
  }>(
    `SELECT inv.status, inv.expires_at AS "expiresAt", inv.decline_reason AS "declineReason",
            s.id AS "supplierId", s.name AS "supplierName",
            r.id AS "requisitionId", r.status AS "requisitionStatus", r.needed_by AS "neededBy"
     FROM invitations inv
     JOIN suppliers s ON s.id = inv.supplier_id
     JOIN rfqs ON rfqs.id = inv.rfq_id
     JOIN requisitions r ON r.id = rfqs.requisition_id
     WHERE inv.id = $1`,
    [invitationId],
  );
  const row = rows[0];
  if (!row) return null;
  const [lines, quotes] = await Promise.all([
    db.query<RequisitionLine>(
      `SELECT rl.id, rl.raw_description AS "rawDescription", rl.quantity_requested::text AS "quantityRequested",
              coalesce(rl.category, i.category) AS category, rl.status, rl.item_id AS "itemId",
              i.name AS "itemName", i.sku, i.unit_of_measure AS "unitOfMeasure"
       FROM requisition_lines rl LEFT JOIN items i ON i.id = rl.item_id
       WHERE rl.requisition_id = $1 AND rl.status = 'resolved'
       ORDER BY rl.created_at`,
      [row.requisitionId],
    ),
    getQuotesForRequisition(db, row.requisitionId),
  ]);
  return {
    invitation: { id: invitationId, status: row.status, expiresAt: row.expiresAt, declineReason: row.declineReason },
    supplier: { id: row.supplierId, name: row.supplierName },
    requisition: { id: row.requisitionId, status: row.requisitionStatus, neededBy: row.neededBy },
    lines: lines.rows,
    // Only this supplier's own quote is ever shown back to them.
    quote: quotes.find((quote) => quote.invitationId === invitationId) ?? null,
  };
}

export function portalBlocker(context: PortalContext): { title: string; message: string } | null {
  if (context.invitation.status === "declined") {
    return { title: "You declined this request", message: "Thanks for letting us know. No further action is needed." };
  }
  if (new Date(context.invitation.expiresAt).getTime() < Date.now()) {
    return { title: "This link has expired", message: "The quotation window has closed. Contact the buyer if you still want to quote." };
  }
  if (context.requisition.status === "po_issued" || context.requisition.status === "closed") {
    return { title: "This request has closed", message: "An order has already been placed for this request." };
  }
  return null;
}
