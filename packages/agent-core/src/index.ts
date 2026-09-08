/**
 * Server surface. Importing this from a client component pulls
 * @copilotkit/runtime (and Express, and Node's `fs`) into the browser bundle.
 * Client code wants `agent-core/shared`.
 */
export { makeAgent } from "./agent";
export { resolveModel } from "./model";
export { searchWeb, isSearchConfigured } from "./capabilities/search";
export {
  workplaceMcpServers,
  isWorkplaceConfigured,
  WORKPLACE_CONTEXT,
} from "./capabilities/workplace";
export * from "./shared";
