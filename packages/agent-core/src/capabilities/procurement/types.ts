/**
 * The procurement domain, as the agent sees it.
 *
 * One Slack thread is one requisition. The backend owns that binding (see
 * `getRequisitionByThread`), which is what keeps this agent stateless: a
 * Channel turn can rehydrate everything it needs from the thread id alone,
 * so a retried turn is a genuine from-scratch re-execution.
 */

/** Something that can actually be ordered. Free-text requests are matched against these. */
export type CatalogItem = {
  id: string;
  name: string;
  /** "each", "box of 12", "metre" — shown to the requester, never inferred. */
  unit: string;
  category: string;
  /** Planning figure only. A real price comes from a supplier quote. */
  indicativeUnitPrice?: number;
};

/** A fuzzy-match option offered back to the requester when intake is unsure. */
export type MatchCandidate = {
  itemId: string;
  name: string;
  unit: string;
};

/**
 * Line states. `needs_confirmation` and `unmatched` both mean the agent must
 * ask before proceeding — it must never settle a line on the requester's behalf.
 */
export type LineStatus = "confirmed" | "needs_confirmation" | "unmatched";

export type RequisitionLine = {
  id: string;
  /** Null until the line is settled against the catalog. */
  itemId: string | null;
  /** What the requester asked for, or the catalog name once confirmed. */
  itemName: string;
  quantity: number;
  unit: string;
  status: LineStatus;
  /** Up to three options to offer when `status` is `needs_confirmation`. */
  candidates?: MatchCandidate[];
};

export type RequisitionStatus =
  | "draft"
  | "rfq_sent"
  | "quotes_in"
  | "approved"
  | "ordered"
  | "cancelled";

export type Requisition = {
  id: string;
  /** Human-facing reference, e.g. "REQ-1042". */
  code: string;
  /** Platform user id of whoever opened the thread. */
  requesterId: string;
  title: string;
  status: RequisitionStatus;
  lines: RequisitionLine[];
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  categories: string[];
};

export type InvitationStatus = "sent" | "failed" | "responded";

export type Invitation = {
  supplierId: string;
  supplierName: string;
  status: InvitationStatus;
  /** Present when `status` is `failed`; shown so a resend can be offered. */
  error?: string;
};

export type Rfq = {
  id: string;
  requisitionId: string;
  sentAt: string;
  invitations: Invitation[];
};

export type QuoteLine = {
  lineId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  leadTimeDays: number;
  /** A supplier may quote most of a requisition and skip a line. */
  available: boolean;
};

export type Quote = {
  id: string;
  requisitionId: string;
  supplierId: string;
  supplierName: string;
  lines: QuoteLine[];
  total: number;
  currency: string;
  /** Longest lead time across available lines — the one that gates delivery. */
  leadTimeDays: number;
  submittedAt: string;
  notes?: string;
};

/**
 * A comparison is derived, never stored: the backend recomputes it from the
 * quotes on hand so a late quote cannot leave a stale recommendation behind.
 */
export type Comparison = {
  requisitionId: string;
  quotes: Quote[];
  /** Null when nothing is quotable yet (no quotes, or none fully available). */
  recommendedQuoteId: string | null;
  /** Why that quote won, in one plain sentence. */
  rationale: string;
  /** Lines no supplier could quote. Surfacing these prevents a silent short-order. */
  unquotedItemNames: string[];
};

export type PurchaseOrder = {
  id: string;
  /** Human-facing reference, e.g. "PO-2087". */
  number: string;
  requisitionId: string;
  quoteId: string;
  supplierName: string;
  total: number;
  currency: string;
  issuedAt: string;
  /** Where the record can be opened, when the backend exposes one. */
  url?: string;
};

/** `getRequisition` returns the whole picture — the agent should never stitch this together itself. */
export type RequisitionDetail = {
  requisition: Requisition;
  rfq: Rfq | null;
  quotes: Quote[];
  purchaseOrder: PurchaseOrder | null;
};
