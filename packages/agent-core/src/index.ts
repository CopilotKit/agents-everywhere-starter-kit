/**
 * Server surface. Importing this from a client component pulls
 * @copilotkit/runtime (and Express, and Node's `fs`) into the browser bundle.
 * Client code wants `agent-core/shared`.
 */
export { makeAgent } from "./agent";
export { MOBILE_FINANCE_PROMPT } from "./mobile-finance-prompt";
export { resolveModel } from "./model";
export { searchWeb, isSearchConfigured } from "./capabilities/search";
export {
  workplaceMcpServers,
  isWorkplaceConfigured,
  WORKPLACE_CONTEXT,
} from "./capabilities/workplace";
export * from "./shared";
export { PROCUREMENT_PROMPT } from "./procurement-prompt";
export {
  procurementApi,
  isProcurementConfigured,
  isProcurementLive,
  PROCUREMENT_CONTEXT,
  ProcurementApiError,
  httpProcurementApi,
  createFakeProcurementApi,
} from "./capabilities/procurement";
export type {
  ProcurementApi,
  ItemRequest,
  CatalogItem,
  Comparison,
  PurchaseOrder,
  Quote,
  Requisition,
  RequisitionDetail,
  RequisitionLine,
  Rfq,
  Supplier,
} from "./capabilities/procurement";
