import type { Db } from "../pool";
import type { PoStatus, PurchaseOrder, PurchaseOrderLine, PurchaseOrderListItem } from "../types";

const PO_COLUMNS = `
  pos.id, pos.po_number AS "poNumber", pos.requisition_id AS "requisitionId",
  pos.supplier_id AS "supplierId", s.name AS "supplierName", pos.status,
  pos.issued_at AS "issuedAt", pos.emailed_at AS "emailedAt", pos.email_error AS "emailError",
  coalesce((SELECT sum(total_price_cents) FROM po_lines WHERE po_id = pos.id), 0) AS "totalCents"`;

export async function listPurchaseOrders(
  db: Db,
  { status }: { status?: PoStatus } = {},
): Promise<PurchaseOrderListItem[]> {
  const { rows } = await db.query<PurchaseOrderListItem>(
    `SELECT ${PO_COLUMNS}
     FROM pos JOIN suppliers s ON s.id = pos.supplier_id
     WHERE $1::text IS NULL OR pos.status = $1
     ORDER BY pos.issued_at DESC`,
    [status ?? null],
  );
  return rows;
}

async function withLines(db: Db, headers: Omit<PurchaseOrder, "lines">[]): Promise<PurchaseOrder[]> {
  if (headers.length === 0) return [];
  const { rows } = await db.query<PurchaseOrderLine & { poId: string }>(
    `SELECT pol.id, pol.po_id AS "poId", pol.requisition_line_id AS "requisitionLineId",
            pol.item_id AS "itemId", i.name AS "itemName", pol.ordered_qty::text AS "orderedQty",
            pol.unit_price_cents AS "unitPriceCents", pol.total_price_cents AS "totalPriceCents"
     FROM po_lines pol JOIN items i ON i.id = pol.item_id
     WHERE pol.po_id = ANY($1::uuid[])
     ORDER BY i.name`,
    [headers.map((header) => header.id)],
  );
  return headers.map((header) => ({
    ...header,
    lines: rows.filter((row) => row.poId === header.id).map(({ poId: _poId, ...line }) => line),
  }));
}

export async function getPurchaseOrder(db: Db, id: string): Promise<PurchaseOrder | null> {
  const { rows } = await db.query<Omit<PurchaseOrder, "lines">>(
    `SELECT ${PO_COLUMNS} FROM pos JOIN suppliers s ON s.id = pos.supplier_id WHERE pos.id = $1`,
    [id],
  );
  const [po] = await withLines(db, rows);
  return po ?? null;
}

export async function getPurchaseOrdersForRequisition(
  db: Db,
  requisitionId: string,
): Promise<PurchaseOrder[]> {
  const { rows } = await db.query<Omit<PurchaseOrder, "lines">>(
    `SELECT ${PO_COLUMNS}
     FROM pos JOIN suppliers s ON s.id = pos.supplier_id
     WHERE pos.requisition_id = $1
     ORDER BY pos.issued_at`,
    [requisitionId],
  );
  return withLines(db, rows);
}
