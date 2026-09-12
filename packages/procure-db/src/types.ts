// Response shapes shared by the API, the agent tools, and the ERP frontend.
// Type-only: safe to import from browser code. NUMERIC quantities stay strings
// (as Postgres returns them); money is integer cents.

export type RequisitionStatus =
  | "intake"
  | "rfq_dispatched"
  | "comparing"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "po_issued"
  | "closed";

export type RequisitionLineStatus = "pending_resolution" | "resolved" | "unresolved" | "excluded";
export type InvitationStatus = "sent" | "quoted" | "declined" | "no_response" | "send_failed";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PoStatus = "issued" | "closed";

export interface RequisitionListItem {
  id: string;
  summary: string | null;
  requesterId: string;
  status: RequisitionStatus;
  neededBy: string | null;
  waitingOn: string;
  suppliersInvited: number;
  quotesReceived: number;
  poTotalCents: number | null;
  createdAt: string;
}

export interface RequisitionLine {
  id: string;
  rawDescription: string;
  quantityRequested: string;
  category: string | null;
  status: RequisitionLineStatus;
  itemId: string | null;
  itemName: string | null;
  sku: string | null;
  unitOfMeasure: string | null;
}

export interface Invitation {
  id: string;
  supplierId: string;
  supplierName: string;
  status: InvitationStatus;
  sentAt: string;
  expiresAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  sendError: string | null;
}

export interface QuoteLine {
  id: string;
  requisitionLineId: string;
  quantityQuoted: string;
  unit: string;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  currency: string;
  leadTimeDays: number | null;
  terms: string | null;
}

export interface Quote {
  id: string;
  invitationId: string;
  supplierId: string;
  supplierName: string;
  submittedAt: string;
  hasDocument: boolean;
  lines: QuoteLine[];
}

export interface ApprovalRecord {
  id: string;
  amountCents: number;
  currentTier: number;
  assignedApproverId: string;
  status: ApprovalStatus;
  selectedQuoteId: string | null;
  selectedBy: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  requisitionLineId: string;
  itemId: string;
  itemName: string;
  orderedQty: string;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  requisitionId: string;
  supplierId: string;
  supplierName: string;
  status: PoStatus;
  issuedAt: string;
  emailedAt: string | null;
  emailError: string | null;
  totalCents: number;
  lines: PurchaseOrderLine[];
}

export interface RequisitionDetail {
  id: string;
  requesterId: string;
  status: RequisitionStatus;
  neededBy: string | null;
  waitingOn: string;
  createdAt: string;
  updatedAt: string;
  lines: RequisitionLine[];
  rfq: { id: string; dispatchedAt: string; invitations: Invitation[] } | null;
  quotes: Quote[];
  approvals: ApprovalRecord[];
  purchaseOrders: PurchaseOrder[];
}

export interface SupplierCategory {
  category: string;
  preferred: boolean;
}

export interface SupplierListItem {
  id: string;
  name: string;
  email: string | null;
  categories: SupplierCategory[];
}

export interface SupplierDetail extends SupplierListItem {
  contactInfo: Record<string, unknown>;
  invitations: {
    invitationId: string;
    requisitionId: string;
    status: InvitationStatus;
    sentAt: string;
    quoteId: string | null;
  }[];
}

export interface ItemListItem {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unitOfMeasure: string;
  quantityOnHand: string;
}

export interface ItemDetail extends ItemListItem {
  requisitionLines: {
    id: string;
    requisitionId: string;
    rawDescription: string;
    quantityRequested: string;
    status: RequisitionLineStatus;
    createdAt: string;
  }[];
  poLines: {
    id: string;
    poId: string;
    poNumber: string;
    supplierName: string;
    orderedQty: string;
    unitPriceCents: number;
    totalPriceCents: number;
    issuedAt: string;
  }[];
}

export interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  requisitionId: string;
  supplierName: string;
  status: PoStatus;
  issuedAt: string;
  totalCents: number;
  emailedAt: string | null;
  emailError: string | null;
}

export interface QuoteComparisonRow {
  quoteId: string;
  supplierId: string;
  supplierName: string;
  totalCents: number | null;
  leadTimeDays: number | null;
  estimatedDelivery: string | null;
  meetsDeadline: boolean | null;
  complete: boolean;
}

export interface QuoteComparison {
  requisitionId: string;
  neededBy: string | null;
  rows: QuoteComparisonRow[];
  recommendedQuoteId: string | null;
  reason: string;
}

export interface RfqPreview {
  requisition: RequisitionDetail;
  invitees: { id: string; name: string; email: string | null; preferred: boolean }[];
}

export interface RfqDispatchResult {
  requisitionId: string;
  rfqId: string;
  invitations: { supplierId: string; supplierName: string; status: InvitationStatus; error: string | null }[];
}

export interface AwardResult {
  requisitionId: string;
  purchaseOrder: PurchaseOrder;
  emailed: boolean;
  emailError: string | null;
}
