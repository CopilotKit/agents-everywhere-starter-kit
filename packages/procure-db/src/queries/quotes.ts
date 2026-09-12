import type { Db } from "../pool";
import { rankQuotes, type RankableQuote } from "../rank";
import type { Quote, QuoteComparison, QuoteLine } from "../types";

export async function getQuotesForRequisition(db: Db, requisitionId: string): Promise<Quote[]> {
  const { rows: headers } = await db.query<Omit<Quote, "lines">>(
    `SELECT q.id, q.invitation_id AS "invitationId", inv.supplier_id AS "supplierId",
            s.name AS "supplierName", q.submitted_at AS "submittedAt",
            (q.raw_document_ref IS NOT NULL) AS "hasDocument"
     FROM quotes q
     JOIN invitations inv ON inv.id = q.invitation_id
     JOIN rfqs ON rfqs.id = inv.rfq_id
     JOIN suppliers s ON s.id = inv.supplier_id
     WHERE rfqs.requisition_id = $1
     ORDER BY q.submitted_at`,
    [requisitionId],
  );
  if (headers.length === 0) return [];
  const { rows: lines } = await db.query<QuoteLine & { quoteId: string }>(
    `SELECT ql.id, ql.quote_id AS "quoteId", ql.requisition_line_id AS "requisitionLineId",
            ql.quantity_quoted::text AS "quantityQuoted", ql.unit,
            ql.unit_price_cents AS "unitPriceCents", ql.total_price_cents AS "totalPriceCents",
            ql.currency, ql.lead_time_days AS "leadTimeDays", ql.terms
     FROM quote_lines ql
     WHERE ql.quote_id = ANY($1::uuid[])`,
    [headers.map((header) => header.id)],
  );
  return headers.map((header) => ({
    ...header,
    lines: lines.filter((line) => line.quoteId === header.id).map(({ quoteId: _quoteId, ...line }) => line),
  }));
}

/** Ranks every quote on a requisition; null when the requisition does not exist. */
export async function compareQuotes(
  db: Db,
  requisitionId: string,
  today: string,
): Promise<QuoteComparison | null> {
  const { rows } = await db.query<{ neededBy: string | null; lineIds: string[] }>(
    `SELECT r.needed_by AS "neededBy",
            coalesce(array_agg(rl.id) FILTER (WHERE rl.status = 'resolved'), '{}') AS "lineIds"
     FROM requisitions r
     LEFT JOIN requisition_lines rl ON rl.requisition_id = r.id
     WHERE r.id = $1
     GROUP BY r.id`,
    [requisitionId],
  );
  const requisition = rows[0];
  if (!requisition) return null;
  const quotes = await getQuotesForRequisition(db, requisitionId);
  const rankable: RankableQuote[] = quotes.map((quote) => ({
    quoteId: quote.id,
    supplierId: quote.supplierId,
    supplierName: quote.supplierName,
    lines: quote.lines,
  }));
  const ranked = rankQuotes({
    quotes: rankable,
    requisitionLineIds: requisition.lineIds,
    neededBy: requisition.neededBy,
    today,
  });
  return { requisitionId, neededBy: requisition.neededBy, ...ranked };
}
