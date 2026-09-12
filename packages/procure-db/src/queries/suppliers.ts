import type { Db } from "../pool";
import type { SupplierDetail, SupplierListItem } from "../types";

const SUPPLIER_COLUMNS = `
  s.id, s.name, s.contact_info->>'email' AS email,
  coalesce(
    (SELECT json_agg(json_build_object('category', sc.category, 'preferred', sc.preferred)
                     ORDER BY sc.preferred DESC, sc.category)
     FROM supplier_categories sc WHERE sc.supplier_id = s.id),
    '[]'::json
  ) AS categories`;

export async function listSuppliers(
  db: Db,
  { category }: { category?: string } = {},
): Promise<SupplierListItem[]> {
  const { rows } = await db.query<SupplierListItem>(
    `SELECT ${SUPPLIER_COLUMNS}
     FROM suppliers s
     WHERE $1::text IS NULL
        OR EXISTS (SELECT 1 FROM supplier_categories sc WHERE sc.supplier_id = s.id AND sc.category = $1)
     ORDER BY s.name`,
    [category ?? null],
  );
  return rows;
}

export async function getSupplierDetail(db: Db, id: string): Promise<SupplierDetail | null> {
  const { rows } = await db.query<Omit<SupplierDetail, "invitations">>(
    `SELECT ${SUPPLIER_COLUMNS}, s.contact_info AS "contactInfo" FROM suppliers s WHERE s.id = $1`,
    [id],
  );
  const supplier = rows[0];
  if (!supplier) return null;
  const invitations = await db.query<SupplierDetail["invitations"][number]>(
    `SELECT inv.id AS "invitationId", rfqs.requisition_id AS "requisitionId", inv.status,
            inv.sent_at AS "sentAt", q.id AS "quoteId"
     FROM invitations inv
     JOIN rfqs ON rfqs.id = inv.rfq_id
     LEFT JOIN quotes q ON q.invitation_id = inv.id
     WHERE inv.supplier_id = $1
     ORDER BY inv.sent_at DESC
     LIMIT 50`,
    [id],
  );
  return { ...supplier, invitations: invitations.rows };
}

export interface Invitee {
  id: string;
  name: string;
  email: string | null;
  preferred: boolean;
  quotesSubmitted: number;
}

/**
 * Suppliers to invite for one category: every preferred supplier, then the
 * most active non-preferred ones until there are at least `minimum`.
 */
export async function selectInvitees(db: Db, category: string, minimum = 3): Promise<Invitee[]> {
  const { rows } = await db.query<Invitee>(
    `SELECT s.id, s.name, s.contact_info->>'email' AS email, sc.preferred,
            (SELECT count(*)::int FROM invitations inv JOIN quotes q ON q.invitation_id = inv.id
             WHERE inv.supplier_id = s.id) AS "quotesSubmitted"
     FROM supplier_categories sc
     JOIN suppliers s ON s.id = sc.supplier_id
     WHERE sc.category = $1
     ORDER BY sc.preferred DESC, "quotesSubmitted" DESC, s.name`,
    [category],
  );
  const preferred = rows.filter((row) => row.preferred);
  const others = rows.filter((row) => !row.preferred);
  return [...preferred, ...others.slice(0, Math.max(0, minimum - preferred.length))];
}
