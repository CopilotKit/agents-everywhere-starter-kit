/**
 * The procurement backend, behind one interface.
 *
 * Every state change goes through here — the agent never holds domain state
 * between turns and never writes anywhere else. Swapping the in-memory
 * implementation for the real service is a one-line change in `index.ts`,
 * which is what lets the Slack surface be built and demoed before the
 * backend exists.
 *
 * Methods take and return domain types only. Nothing platform-specific
 * (thread ids aside, which the backend owns as the requisition binding)
 * leaks into this layer.
 */
import type {
  CatalogItem,
  Comparison,
  PurchaseOrder,
  Requisition,
  RequisitionDetail,
  Rfq,
  Supplier,
} from "./types";

/** One free-text thing the requester asked for, pre-match. */
export type ItemRequest = {
  /** Their words, e.g. "a box of HDMI cables". Matching is the backend's job. */
  text: string;
  quantity?: number;
};

export type ProcurementApi = {
  /** Browse or search what can be ordered. Only catalog items are orderable. */
  listCatalog(params?: { query?: string; limit?: number }): Promise<CatalogItem[]>;

  /**
   * Look one up by its human-facing code ("REQ-1042").
   *
   * This is the recovery path: the thread-to-requisition binding lives in
   * Channel thread state, which is in-memory unless a durable `store` is
   * configured, so a listener restart can orphan an active thread. The
   * requester can then name the code and the agent re-binds.
   */
  getRequisitionByCode(code: string): Promise<Requisition | null>;

  /**
   * Open a new requisition. `threadRef` is opaque traceability metadata for
   * the backend's own records — the binding the agent reads is thread state,
   * because the Channels `Thread` exposes no stable conversation id.
   */
  createRequisition(params: {
    requesterId: string;
    title?: string;
    threadRef?: string;
  }): Promise<Requisition>;

  /**
   * Match free text against the catalog and append lines. Returns the updated
   * requisition; lines the backend could not settle come back as
   * `needs_confirmation` (with candidates) or `unmatched`.
   */
  addItems(params: {
    requisitionId: string;
    requests: ItemRequest[];
  }): Promise<Requisition>;

  /**
   * Settle one line: pick a candidate, change the quantity, or drop it.
   * `itemId: null` drops the line — that is the "none of these" answer.
   */
  resolveLine(params: {
    requisitionId: string;
    lineId: string;
    itemId?: string | null;
    quantity?: number;
  }): Promise<Requisition>;

  /** Everything known about one requisition — lines, RFQ, quotes, PO. */
  getRequisition(requisitionId: string): Promise<RequisitionDetail | null>;

  /** Requisitions matching a filter, newest first. */
  findRequisitions(params?: {
    requesterId?: string;
    status?: Requisition["status"];
  }): Promise<Requisition[]>;

  /** Suppliers the backend would invite for these categories. */
  listSuppliers(params?: { category?: string }): Promise<Supplier[]>;

  /** Dispatch the RFQ. Fails if any line is still unsettled. */
  sendForQuotes(params: {
    requisitionId: string;
    supplierIds?: string[];
  }): Promise<Rfq>;

  /** Re-invite only the suppliers whose invitation failed. */
  resendFailedInvitations(params: { requisitionId: string }): Promise<Rfq>;

  /** Recomputed from the quotes on hand every call — never cached. */
  compareQuotes(params: { requisitionId: string }): Promise<Comparison>;

  /** Issue the PO against a chosen quote. The one genuinely irreversible write. */
  issuePurchaseOrder(params: {
    requisitionId: string;
    quoteId: string;
    approvedBy: string;
  }): Promise<PurchaseOrder>;
};

/**
 * A backend error the model is allowed to see.
 *
 * Tool handlers return the message text so the agent can repair and retry
 * (ask for a missing detail, pick a different line). It carries no response
 * body beyond the message, so a backend that echoes internals cannot leak
 * them into a Slack thread.
 */
export class ProcurementApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProcurementApiError";
  }
}

type HttpOptions = {
  baseUrl: string;
  apiKey?: string;
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * REST client over the backend.
 *
 * Paths follow one convention — `/requisitions/:id/...` for anything scoped to
 * a requisition — so a contract change is a change here and nowhere else.
 */
export function httpProcurementApi(options: HttpOptions): ProcurementApi {
  const { baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 15_000 } = options;
  const root = baseUrl.replace(/\/$/, "");

  async function call<T>(
    path: string,
    init?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> },
  ): Promise<T> {
    const url = new URL(`${root}${path}`);
    for (const [key, value] of Object.entries(init?.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.toString(), {
        method: init?.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
      if (response.status === 404) return null as T;
      if (!response.ok) {
        // Prefer the backend's own message; fall back to the status line.
        const detail = await response.text().catch(() => "");
        let message = `Procurement backend returned ${response.status}`;
        try {
          const parsed = JSON.parse(detail) as { message?: string; error?: string };
          if (parsed.message || parsed.error) message = String(parsed.message ?? parsed.error);
        } catch {
          if (detail) message = detail.slice(0, 300);
        }
        throw new ProcurementApiError(message, response.status);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProcurementApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProcurementApiError(
          `Procurement backend did not respond within ${timeoutMs}ms.`,
          504,
        );
      }
      throw new ProcurementApiError(
        error instanceof Error ? error.message : "Procurement backend is unreachable.",
        503,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    listCatalog: (params) =>
      call("/catalog", { query: { query: params?.query, limit: params?.limit } }),

    getRequisitionByCode: (code) =>
      call("/requisitions/by-code", { query: { code } }),

    createRequisition: (params) =>
      call("/requisitions", { method: "POST", body: params }),

    addItems: ({ requisitionId, requests }) =>
      call(`/requisitions/${requisitionId}/items`, { method: "POST", body: { requests } }),

    resolveLine: ({ requisitionId, lineId, ...rest }) =>
      call(`/requisitions/${requisitionId}/lines/${lineId}`, { method: "PATCH", body: rest }),

    getRequisition: (requisitionId) => call(`/requisitions/${requisitionId}`),

    findRequisitions: (params) =>
      call("/requisitions", {
        query: { requesterId: params?.requesterId, status: params?.status },
      }),

    listSuppliers: (params) => call("/suppliers", { query: { category: params?.category } }),

    sendForQuotes: ({ requisitionId, supplierIds }) =>
      call(`/requisitions/${requisitionId}/rfq`, { method: "POST", body: { supplierIds } }),

    resendFailedInvitations: ({ requisitionId }) =>
      call(`/requisitions/${requisitionId}/rfq/resend`, { method: "POST" }),

    compareQuotes: ({ requisitionId }) => call(`/requisitions/${requisitionId}/comparison`),

    issuePurchaseOrder: ({ requisitionId, quoteId, approvedBy }) =>
      call(`/requisitions/${requisitionId}/purchase-order`, {
        method: "POST",
        body: { quoteId, approvedBy },
      }),
  };
}
