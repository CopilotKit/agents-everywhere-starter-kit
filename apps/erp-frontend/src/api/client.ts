import type {
  AwardResult,
  ItemDetail,
  ItemListItem,
  PoStatus,
  PurchaseOrder,
  PurchaseOrderListItem,
  QuoteComparison,
  RequisitionDetail,
  RequisitionListItem,
  RequisitionStatus,
  RfqDispatchResult,
  RfqPreview,
  SupplierDetail,
  SupplierListItem,
} from "procure-db/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request to ${path} failed with status ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]));
  const text = search.toString();
  return text ? `?${text}` : "";
};

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

export const fetchRequisitions = (status?: RequisitionStatus) =>
  apiFetch<RequisitionListItem[]>(`/api/requisitions${query({ status })}`);
export const fetchRequisitionDetail = (id: string) =>
  apiFetch<RequisitionDetail>(`/api/requisitions/${encodeURIComponent(id)}`);
export const fetchComparison = (id: string) =>
  apiFetch<QuoteComparison>(`/api/requisitions/${encodeURIComponent(id)}/comparison`);
export const fetchRfqPreview = (id: string) =>
  apiFetch<RfqPreview>(`/api/requisitions/${encodeURIComponent(id)}/rfq-preview`);

export const dispatchRfq = (id: string) => post<RfqDispatchResult>(`/api/requisitions/${encodeURIComponent(id)}/rfq`);
export const awardQuote = (id: string, quoteId: string) =>
  post<AwardResult>(`/api/requisitions/${encodeURIComponent(id)}/award`, { quoteId });

export const fetchSuppliers = (category?: string) => apiFetch<SupplierListItem[]>(`/api/suppliers${query({ category })}`);
export const fetchSupplierDetail = (id: string) => apiFetch<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}`);

export const fetchItems = (params: { category?: string; query?: string } = {}) =>
  apiFetch<ItemListItem[]>(`/api/items${query(params)}`);
export const fetchItemDetail = (id: string) => apiFetch<ItemDetail>(`/api/items/${encodeURIComponent(id)}`);
export const fetchCategories = () => apiFetch<string[]>("/api/categories");

export const fetchPurchaseOrders = (status?: PoStatus) =>
  apiFetch<PurchaseOrderListItem[]>(`/api/purchase-orders${query({ status })}`);
export const fetchPurchaseOrderDetail = (id: string) =>
  apiFetch<PurchaseOrder>(`/api/purchase-orders/${encodeURIComponent(id)}`);
