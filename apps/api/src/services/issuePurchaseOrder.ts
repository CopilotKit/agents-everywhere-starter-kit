import { DomainError, getPurchaseOrder, lineTotalCents, withTransaction } from "procure-db";
import type { AwardResult } from "procure-db/types";
import type { AppDeps } from "../deps";
import { purchaseOrderEmail } from "../emails";

interface AwardedLine {
  requisitionLineId: string;
  itemId: string;
  quoteLineId: string | null;
  quantityQuoted: string | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
}

/**
 * Awards a requisition to one quote after the requester's explicit approval:
 * records the approval, issues one PO covering every line, then emails it.
 * The requisition row lock plus the status check make a repeated click a 409.
 */
export async function issuePurchaseOrder(
  deps: AppDeps,
  { requisitionId, quoteId, approvedBy }: { requisitionId: string; quoteId: string; approvedBy: string },
): Promise<AwardResult> {
  const { poId, supplierEmail, neededBy } = await withTransaction(deps.pool, async (client) => {
    const { rows } = await client.query<{ status: string; neededBy: string | null }>(
      `SELECT status, needed_by AS "neededBy" FROM requisitions WHERE id = $1 FOR UPDATE`,
      [requisitionId],
    );
    const requisition = rows[0];
    if (!requisition) throw new DomainError("Requisition not found.", 404);
    if (requisition.status === "po_issued") {
      throw new DomainError("A purchase order has already been issued for this requisition.", 409);
    }
    if (requisition.status !== "rfq_dispatched" && requisition.status !== "comparing") {
      throw new DomainError(`This requisition cannot be awarded in status ${requisition.status}.`, 409);
    }

    const { rows: quoteRows } = await client.query<{ supplierId: string; supplierEmail: string | null }>(
      `SELECT inv.supplier_id AS "supplierId", s.contact_info->>'email' AS "supplierEmail"
       FROM quotes q
       JOIN invitations inv ON inv.id = q.invitation_id
       JOIN rfqs ON rfqs.id = inv.rfq_id
       JOIN suppliers s ON s.id = inv.supplier_id
       WHERE q.id = $1 AND rfqs.requisition_id = $2`,
      [quoteId, requisitionId],
    );
    const quote = quoteRows[0];
    if (!quote) throw new DomainError("That quote does not belong to this requisition.", 404);

    const { rows: lines } = await client.query<AwardedLine>(
      `SELECT rl.id AS "requisitionLineId", rl.item_id AS "itemId", ql.id AS "quoteLineId",
              ql.quantity_quoted::text AS "quantityQuoted", ql.unit_price_cents AS "unitPriceCents",
              ql.total_price_cents AS "totalPriceCents"
       FROM requisition_lines rl
       LEFT JOIN quote_lines ql ON ql.requisition_line_id = rl.id AND ql.quote_id = $2
       WHERE rl.requisition_id = $1 AND rl.status = 'resolved'`,
      [requisitionId, quoteId],
    );
    const priced = lines.map((line) => {
      const total =
        line.quantityQuoted === null
          ? null
          : lineTotalCents({
              requisitionLineId: line.requisitionLineId,
              quantityQuoted: line.quantityQuoted,
              unitPriceCents: line.unitPriceCents,
              totalPriceCents: line.totalPriceCents,
              leadTimeDays: null,
            });
      return { ...line, total };
    });
    if (priced.length === 0 || priced.some((line) => line.total === null)) {
      throw new DomainError("That quote does not price every line, so it cannot be awarded.", 409);
    }
    const amountCents = priced.reduce((sum, line) => sum + line.total!, 0);

    const { rows: tiers } = await client.query<{ tier: number }>(
      `SELECT tier_number AS tier FROM thresholds
       WHERE min_amount_cents <= $1 AND (max_amount_cents IS NULL OR $1 < max_amount_cents)
       ORDER BY tier_number LIMIT 1`,
      [amountCents],
    );
    await client.query(
      `INSERT INTO approval_requests
         (requisition_id, amount_cents, current_tier, assigned_approver_id, status, responded_at,
          selected_quote_id, selected_by)
       VALUES ($1, $2, $3, $4, 'approved', now(), $5, $4)`,
      [requisitionId, amountCents, tiers[0]?.tier ?? 1, approvedBy, quoteId],
    );

    const { rows: poRows } = await client.query<{ id: string }>(
      `INSERT INTO pos (requisition_id, supplier_id, status) VALUES ($1, $2, 'issued') RETURNING id`,
      [requisitionId, quote.supplierId],
    );
    const poId = poRows[0]!.id;
    for (const line of priced) {
      const quantity = Number(line.quantityQuoted);
      const unitPrice = line.unitPriceCents ?? Math.round(line.total! / quantity);
      await client.query(
        `INSERT INTO po_lines
           (po_id, requisition_line_id, item_id, awarded_quote_line_id, ordered_qty, unit_price_cents, total_price_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [poId, line.requisitionLineId, line.itemId, line.quoteLineId, line.quantityQuoted, unitPrice, line.total],
      );
    }
    await client.query(`UPDATE requisitions SET status = 'po_issued', updated_at = now() WHERE id = $1`, [
      requisitionId,
    ]);
    return { poId, supplierEmail: quote.supplierEmail, neededBy: requisition.neededBy };
  });

  let emailError: string | null = null;
  try {
    if (!supplierEmail) throw new Error("Supplier has no email address on file.");
    const po = (await getPurchaseOrder(deps.pool, poId))!;
    await deps.mailer.send(purchaseOrderEmail({ to: supplierEmail, po, neededBy }));
    await deps.pool.query(`UPDATE pos SET emailed_at = now(), email_error = NULL WHERE id = $1`, [poId]);
  } catch (error) {
    emailError = (error as Error).message;
    deps.log(`Purchase order email for ${poId} failed`, error);
    await deps.pool.query(`UPDATE pos SET email_error = $2 WHERE id = $1`, [poId, emailError]);
  }

  const purchaseOrder = (await getPurchaseOrder(deps.pool, poId))!;
  return { requisitionId, purchaseOrder, emailed: emailError === null, emailError };
}
