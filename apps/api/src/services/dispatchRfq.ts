import { DomainError, getRequisitionDetail, selectInvitees, withTransaction, type Invitee } from "procure-db";
import type { RfqDispatchResult } from "procure-db/types";
import type { AppDeps } from "../deps";
import { rfqEmail } from "../emails";
import { mintInvitationToken } from "../lib/magicLink";

const INVITATION_TTL_DAYS = 14;

interface CreatedInvitation {
  id: string;
  expiresAt: string;
  supplier: Invitee;
}

/**
 * Sends RFQs for an `intake` requisition: one invitation per supplier chosen
 * for each line's category, each with its own magic link. Rows are committed
 * before any email goes out; a failed send marks that invitation send_failed.
 */
export async function dispatchRfq(deps: AppDeps, requisitionId: string): Promise<RfqDispatchResult> {
  const { rfqId, invitations } = await withTransaction(deps.pool, async (client) => {
    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM requisitions WHERE id = $1 FOR UPDATE`,
      [requisitionId],
    );
    const requisition = rows[0];
    if (!requisition) throw new DomainError("Requisition not found.", 404);
    if (requisition.status !== "intake") {
      throw new DomainError(`RFQs were already sent for this requisition (status: ${requisition.status}).`, 409);
    }

    const { rows: lines } = await client.query<{ category: string | null }>(
      `SELECT DISTINCT category FROM requisition_lines WHERE requisition_id = $1 AND status = 'resolved'`,
      [requisitionId],
    );
    if (lines.length === 0) throw new DomainError("The requisition has no resolved lines to quote.");
    const uncategorised = lines.some((line) => line.category === null);
    if (uncategorised) throw new DomainError("A line has no category, so no suppliers can be selected.");

    const suppliers = new Map<string, Invitee>();
    for (const { category } of lines) {
      const invitees = await selectInvitees(client, category!);
      if (invitees.length === 0) {
        throw new DomainError(`No suppliers are registered for category "${category}".`, 409);
      }
      for (const invitee of invitees) suppliers.set(invitee.id, invitee);
    }

    const { rows: rfqRows } = await client.query<{ id: string }>(
      `INSERT INTO rfqs (requisition_id) VALUES ($1) RETURNING id`,
      [requisitionId],
    );
    const rfqId = rfqRows[0]!.id;
    const created: CreatedInvitation[] = [];
    for (const supplier of suppliers.values()) {
      const { rows: inv } = await client.query<{ id: string; expiresAt: string }>(
        `INSERT INTO invitations (rfq_id, supplier_id, status, expires_at)
         VALUES ($1, $2, 'sent', now() + make_interval(days => $3))
         RETURNING id, expires_at AS "expiresAt"`,
        [rfqId, supplier.id, INVITATION_TTL_DAYS],
      );
      created.push({ ...inv[0]!, supplier });
    }
    await client.query(
      `UPDATE requisitions SET status = 'rfq_dispatched', updated_at = now() WHERE id = $1`,
      [requisitionId],
    );
    return { rfqId, invitations: created };
  });

  const detail = (await getRequisitionDetail(deps.pool, requisitionId))!;
  const results: RfqDispatchResult["invitations"] = [];
  for (const invitation of invitations) {
    const { supplier } = invitation;
    let error: string | null = null;
    try {
      if (!supplier.email) throw new Error("Supplier has no email address on file.");
      const token = await mintInvitationToken(deps.config.jwtSecret, invitation.id, new Date(invitation.expiresAt));
      await deps.mailer.send(
        rfqEmail({
          to: supplier.email,
          supplierName: supplier.name,
          lines: detail.lines,
          neededBy: detail.neededBy,
          portalUrl: `${deps.config.portalBaseUrl}/portal/${token}`,
          expiresAt: invitation.expiresAt,
        }),
      );
    } catch (sendError) {
      error = (sendError as Error).message;
      deps.log(`RFQ email to ${supplier.name} failed`, sendError);
      await deps.pool.query(`UPDATE invitations SET status = 'send_failed', send_error = $2 WHERE id = $1`, [
        invitation.id,
        error,
      ]);
    }
    results.push({
      supplierId: supplier.id,
      supplierName: supplier.name,
      status: error ? "send_failed" : "sent",
      error,
    });
  }
  return { requisitionId, rfqId, invitations: results };
}
