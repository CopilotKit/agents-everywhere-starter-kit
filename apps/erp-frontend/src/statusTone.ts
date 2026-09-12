// Every status enum across the domain (requisitions, lines, invitations,
// approvals, POs, reconciliations) collapses onto one shared four-tone lamp
// system so the whole app reads one status vocabulary instead of a palette
// per entity.
export type LampTone = "progress" | "positive" | "negative" | "neutral";

const TONE_BY_STATUS: Record<string, LampTone> = {
  // requisition status
  intake: "progress",
  rfq_dispatched: "progress",
  comparing: "progress",
  pending_approval: "progress",
  approved: "positive",
  rejected: "negative",
  po_issued: "positive",
  closed: "neutral",
  // requisition line status
  pending_resolution: "progress",
  resolved: "positive",
  unresolved: "negative",
  excluded: "neutral",
  // invitation status
  sent: "progress",
  quoted: "positive",
  declined: "negative",
  no_response: "neutral",
  send_failed: "negative",
  // approval request status
  pending: "progress",
  // po status
  issued: "positive",
  // reconciliation status
  clean: "positive",
  has_discrepancies: "negative",
};

export function statusTone(status: string): LampTone {
  return TONE_BY_STATUS[status] ?? "neutral";
}
