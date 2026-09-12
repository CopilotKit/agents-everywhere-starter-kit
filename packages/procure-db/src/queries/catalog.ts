import type { Db } from "../pool";
import type { ItemDetail, ItemListItem } from "../types";

const ITEM_COLUMNS = `
  i.id, i.sku, i.name, i.description, i.category,
  i.unit_of_measure AS "unitOfMeasure",
  i.quantity_on_hand::text AS "quantityOnHand"`;

/** Lowercased alphanumeric tokens with a naive plural strip ("pens" → "pen"). */
export function searchTokens(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
    .map((token) =>
      token.length > 3 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token,
    );
  return [...new Set(tokens)];
}

export type ItemSearchResult = ItemListItem & { matchScore: number };

/**
 * Items ranked by how many query tokens appear in name, description, or SKU.
 * With no usable query, lists every item (optionally within one category).
 */
export async function searchItems(
  db: Db,
  { query, category, limit = 25 }: { query?: string; category?: string; limit?: number },
): Promise<ItemSearchResult[]> {
  const tokens = query ? searchTokens(query) : [];
  const { rows } = await db.query<ItemSearchResult>(
    `SELECT ${ITEM_COLUMNS}, s.score AS "matchScore"
     FROM items i
     CROSS JOIN LATERAL (
       SELECT count(*)::int AS score
       FROM unnest($1::text[]) AS t(token)
       WHERE (i.name || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.sku, ''))
             ILIKE '%' || t.token || '%'
     ) s
     WHERE ($2::text IS NULL OR i.category = $2)
       AND (cardinality($1::text[]) = 0 OR s.score > 0)
     ORDER BY s.score DESC, i.category, i.name
     LIMIT $3`,
    [tokens, category ?? null, limit],
  );
  return rows;
}

export async function getItemDetail(db: Db, id: string): Promise<ItemDetail | null> {
  const { rows } = await db.query<ItemListItem>(`SELECT ${ITEM_COLUMNS} FROM items i WHERE i.id = $1`, [
    id,
  ]);
  const item = rows[0];
  if (!item) return null;
  const [requisitionLines, poLines] = await Promise.all([
    db.query<ItemDetail["requisitionLines"][number]>(
      `SELECT rl.id, rl.requisition_id AS "requisitionId", rl.raw_description AS "rawDescription",
              rl.quantity_requested::text AS "quantityRequested", rl.status, rl.created_at AS "createdAt"
       FROM requisition_lines rl
       WHERE rl.item_id = $1
       ORDER BY rl.created_at DESC
       LIMIT 50`,
      [id],
    ),
    db.query<ItemDetail["poLines"][number]>(
      `SELECT pol.id, pos.id AS "poId", pos.po_number AS "poNumber", s.name AS "supplierName",
              pol.ordered_qty::text AS "orderedQty", pol.unit_price_cents AS "unitPriceCents",
              pol.total_price_cents AS "totalPriceCents", pos.issued_at AS "issuedAt"
       FROM po_lines pol
       JOIN pos ON pos.id = pol.po_id
       JOIN suppliers s ON s.id = pos.supplier_id
       WHERE pol.item_id = $1
       ORDER BY pos.issued_at DESC
       LIMIT 50`,
      [id],
    ),
  ]);
  return { ...item, requisitionLines: requisitionLines.rows, poLines: poLines.rows };
}

export async function listCategories(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ category: string }>(
    `SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category`,
  );
  return rows.map((row) => row.category);
}
