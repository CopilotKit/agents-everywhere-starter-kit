/**
 * Which procurement backend the agent talks to.
 *
 * Set `PROCUREMENT_API_URL` and the tools hit the real service. Leave it unset
 * and they run against the in-memory stand-in, so the Slack flow is buildable,
 * testable and demoable before the backend is reachable — and so `npm run
 * verify` needs no network.
 *
 * Mirrors `capabilities/search.ts`: one `is*Configured()` predicate the Channel
 * reads at startup, so the agent is never handed tools that cannot work.
 */
import { httpProcurementApi, type ProcurementApi } from "./client";
import { createFakeProcurementApi } from "./fake";

export type { ProcurementApi, ItemRequest } from "./client";
export { ProcurementApiError } from "./client";
export { httpProcurementApi } from "./client";
/** Exported for tests and local demos: one fresh in-memory backend per call. */
export { createFakeProcurementApi } from "./fake";
export type * from "./types";

/** True once the real backend is configured. */
export function isProcurementLive(): boolean {
  return Boolean(process.env.PROCUREMENT_API_URL);
}

/**
 * Procurement is always available — the stand-in covers the unconfigured case,
 * so unlike search there is no "tool absent" state. Kept as a named predicate
 * so `channel.tsx` can say which backend it is talking to in its context block.
 */
export function isProcurementConfigured(): boolean {
  return true;
}

/**
 * The stand-in holds state in memory, so it must be one instance per process:
 * a fresh one per turn would forget the requisition between messages.
 */
let fallback: ProcurementApi | undefined;

export function procurementApi(): ProcurementApi {
  const baseUrl = process.env.PROCUREMENT_API_URL;
  if (baseUrl) {
    return httpProcurementApi({
      baseUrl,
      apiKey: process.env.PROCUREMENT_API_KEY,
      ...(process.env.PROCUREMENT_API_TIMEOUT_MS
        ? { timeoutMs: Number(process.env.PROCUREMENT_API_TIMEOUT_MS) }
        : {}),
    });
  }
  fallback ??= createFakeProcurementApi();
  return fallback;
}

/** Injected into the agent's prompt so it never presents sample data as real. */
export const PROCUREMENT_CONTEXT = isProcurementLive()
  ? "Procurement backend: live. Records you create are real."
  : "Procurement backend: in-memory sample data, not a real system. Catalog, suppliers, quotes and purchase orders here are illustrative. If asked whether something is real, say it is sample data.";
