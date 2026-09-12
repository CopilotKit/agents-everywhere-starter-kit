/**
 * What the Slack tools talk to.
 *
 * Split the same way the ERP is split, and for the same reason:
 *
 *   reads and draft creation  → procure-db, straight to Postgres
 *   writes that send email    → apps/api over HTTP
 *
 * `dispatchRfq` and `issuePurchaseOrder` live in apps/api because they need a
 * mailer, a JWT secret and the portal base URL (see apps/api/src/deps.ts).
 * They are not in procure-db and cannot be called from here directly, so the
 * two of them go over HTTP exactly as erp-frontend's approval cards do.
 *
 * Everything is behind one interface so the tools can be tested without a
 * database or a running API.
 */
import {
  compareQuotes,
  createDraftRequisition,
  getPool,
  getRequisitionDetail,
  listRequisitions,
  listSuppliers,
  searchItems,
  selectInvitees,
  type ItemSearchResult,
  type Invitee,
} from "procure-db";
import type {
  AwardResult,
  QuoteComparison,
  RequisitionDetail,
  RequisitionListItem,
  RequisitionStatus,
  RfqDispatchResult,
  SupplierListItem,
} from "procure-db/types";

export type DraftLine = { itemId: string; quantity: number; rawDescription: string };

export type ProcurementBackend = {
  searchItems(params: { query?: string; category?: string; limit?: number }): Promise<ItemSearchResult[]>;
  findSuppliers(category: string): Promise<{ wouldInvite: Invitee[]; allInCategory: SupplierListItem[] }>;
  listRequisitions(params: { requesterId?: string; status?: RequisitionStatus }): Promise<RequisitionListItem[]>;
  getRequisition(requisitionId: string): Promise<RequisitionDetail | null>;
  createDraft(params: { requesterId: string; neededBy: string | null; lines: DraftLine[] }): Promise<RequisitionDetail>;
  compare(requisitionId: string): Promise<QuoteComparison | null>;
  /** Emails every invited supplier a magic link. Only ever called from a click. */
  dispatchRfq(requisitionId: string): Promise<RfqDispatchResult>;
  /** Creates the purchase order and emails it. Only ever called from a click. */
  awardQuote(requisitionId: string, quoteId: string): Promise<AwardResult>;
};

/** Local calendar date, matching how apps/api and procure-agent compute it. */
export const today = () => new Date().toLocaleDateString("en-CA");

function apiBase(): string {
  const url = process.env.PROCURE_API_URL ?? "http://localhost:3001";
  return url.replace(/\/$/, "");
}

/**
 * A write that reached apps/api and was refused, or never got there.
 *
 * Carries a short reference so the requester can quote it to whoever runs the
 * system. The underlying detail is logged against that reference here and
 * never sent to Slack.
 */
export class BackendError extends Error {
  constructor(
    message: string,
    readonly reference: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

function reference(): string {
  return `PB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** One place that decides what a failure looks like to a person. */
export function describeFailure(cause: unknown, action: string): BackendError {
  const ref = reference();
  console.error(`[${ref}] ${action} failed:`, cause);

  if (cause instanceof BackendError) return cause;

  const message = cause instanceof Error ? cause.message : String(cause);
  // Postgres, unreachable or refusing connections.
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|terminating connection|Connection terminated/i.test(message)) {
    return new BackendError(
      `I could not reach the procurement system, so ${action} did not happen. Nothing was changed. Quote reference ${ref} to whoever runs it.`,
      ref,
      true,
    );
  }
  if (/timeout|ETIMEDOUT|aborted/i.test(message)) {
    return new BackendError(
      `The procurement system did not respond in time, so I cannot confirm whether ${action} went through. Do not assume it did. Reference ${ref}.`,
      ref,
      false,
    );
  }
  return new BackendError(
    `Something went wrong in the procurement system while ${action}. This is a system fault, not something you did. Reference ${ref}.`,
    ref,
    false,
  );
}

async function post<T>(path: string, body: unknown, action: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    throw describeFailure(cause, action);
  }
  if (!response.ok) {
    const ref = reference();
    const detail = await response.text().catch(() => "");
    console.error(`[${ref}] ${action} → HTTP ${response.status}: ${detail.slice(0, 500)}`);
    // apps/api's DomainError messages are written for people; pass those on.
    let refused: string | undefined;
    try {
      const parsed = JSON.parse(detail) as { error?: string; message?: string };
      refused = parsed.error ?? parsed.message;
    } catch {
      /* not JSON */
    }
    if (response.status >= 400 && response.status < 500 && refused) {
      throw new BackendError(refused, ref, false);
    }
    throw new BackendError(
      `The procurement system rejected ${action} (status ${response.status}). This needs someone to look at it. Reference ${ref}.`,
      ref,
      false,
    );
  }
  return (await response.json()) as T;
}

/** The real thing: Postgres for reads, apps/api for the two email writes. */
export function liveBackend(): ProcurementBackend {
  return {
    searchItems: (params) => searchItems(getPool(), params),
    async findSuppliers(category) {
      const pool = getPool();
      const [wouldInvite, allInCategory] = await Promise.all([
        selectInvitees(pool, category),
        listSuppliers(pool, { category }),
      ]);
      return { wouldInvite, allInCategory };
    },
    listRequisitions: (params) => listRequisitions(getPool(), params),
    getRequisition: (requisitionId) => getRequisitionDetail(getPool(), requisitionId),
    createDraft: (params) => createDraftRequisition(getPool(), params),
    compare: (requisitionId) => compareQuotes(getPool(), requisitionId, today()),
    dispatchRfq: (requisitionId) =>
      post<RfqDispatchResult>(`/api/requisitions/${requisitionId}/rfq`, {}, "sending the RFQs"),
    awardQuote: (requisitionId, quoteId) =>
      post<AwardResult>(`/api/requisitions/${requisitionId}/award`, { quoteId }, "issuing the purchase order"),
  };
}
