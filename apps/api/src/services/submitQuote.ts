import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DomainError, withTransaction, type Db } from "procure-db";
import type { AppDeps } from "../deps";
import type { ParsedQuote } from "../portal/form";

export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface QuoteDocument {
  buffer: Buffer;
  mimetype: string;
}

async function lockOpenInvitation(client: Db, invitationId: string): Promise<{ requisitionId: string }> {
  const { rows } = await client.query<{ status: string; expired: boolean; requisitionId: string; requisitionStatus: string }>(
    `SELECT inv.status, inv.expires_at < now() AS expired, r.id AS "requisitionId", r.status AS "requisitionStatus"
     FROM invitations inv
     JOIN rfqs ON rfqs.id = inv.rfq_id
     JOIN requisitions r ON r.id = rfqs.requisition_id
     WHERE inv.id = $1
     FOR UPDATE OF inv`,
    [invitationId],
  );
  const row = rows[0];
  if (!row) throw new DomainError("Invitation not found.", 404);
  if (row.status === "quoted") throw new DomainError("A quote has already been submitted for this request.", 409);
  if (row.status === "declined") throw new DomainError("This request was declined.", 409);
  if (row.expired) throw new DomainError("This quotation link has expired.", 409);
  if (row.requisitionStatus === "po_issued" || row.requisitionStatus === "closed") {
    throw new DomainError("This request has closed.", 409);
  }
  return { requisitionId: row.requisitionId };
}

export async function submitQuote(
  deps: AppDeps,
  invitationId: string,
  quote: ParsedQuote,
  document?: QuoteDocument,
): Promise<{ quoteId: string }> {
  const hash = createHash("sha256")
    .update(document ? document.buffer : JSON.stringify(quote))
    .digest("hex");

  const quoteId = await withTransaction(deps.pool, async (client) => {
    const { requisitionId } = await lockOpenInvitation(client, invitationId);

    let documentRef: string | null = null;
    if (document) {
      const extension = ALLOWED_DOCUMENT_TYPES[document.mimetype];
      if (!extension) throw new DomainError("Attach a PDF, PNG, JPEG, or WebP document.");
      const directory = join(deps.config.uploadsDir, invitationId);
      await mkdir(directory, { recursive: true });
      documentRef = join(directory, `${hash}.${extension}`);
      await writeFile(documentRef, document.buffer);
    }

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO quotes (invitation_id, content_hash, raw_document_ref) VALUES ($1, $2, $3) RETURNING id`,
      [invitationId, hash, documentRef],
    );
    const id = rows[0]!.id;
    for (const line of quote.lines) {
      await client.query(
        `INSERT INTO quote_lines
           (quote_id, requisition_line_id, quantity_quoted, unit, unit_price_cents, total_price_cents,
            lead_time_days, terms, valid_until, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confident')`,
        [
          id,
          line.requisitionLineId,
          line.quantityQuoted,
          line.unit,
          line.unitPriceCents,
          line.totalPriceCents,
          line.leadTimeDays,
          quote.terms,
          quote.validUntil,
        ],
      );
    }
    await client.query(`UPDATE invitations SET status = 'quoted', responded_at = now() WHERE id = $1`, [
      invitationId,
    ]);
    await client.query(
      `UPDATE requisitions SET status = 'comparing', updated_at = now()
       WHERE id = $1 AND status = 'rfq_dispatched'`,
      [requisitionId],
    );
    return id;
  });

  try {
    await deps.queue.enqueueQuoteSubmitted(quoteId, `${invitationId}-${hash.slice(0, 16)}`);
  } catch (error) {
    deps.log(`Could not enqueue quote_submitted for ${quoteId}; the quote is saved`, error);
  }
  return { quoteId };
}

export async function declineInvitation(deps: AppDeps, invitationId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new DomainError("Tell the buyer briefly why you are declining.");
  if (trimmed.length > 500) throw new DomainError("Keep the reason under 500 characters.");
  await withTransaction(deps.pool, async (client) => {
    await lockOpenInvitation(client, invitationId);
    await client.query(
      `UPDATE invitations SET status = 'declined', decline_reason = $2, responded_at = now() WHERE id = $1`,
      [invitationId, trimmed],
    );
  });
}
