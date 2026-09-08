/**
 * The browser-safe surface of agent-core.
 *
 * `agent-core` (the root export) pulls in @copilotkit/runtime, which pulls in
 * Express and Node's `fs`. A client component that imports the root barrel drags
 * all of that into the browser bundle and the build fails with
 * "Module not found: Can't resolve 'fs'".
 *
 * So anything a client component needs — the prompt, the model notes, the
 * schemas — lives here, and this module imports nothing from Node.
 */
export { SYSTEM_PROMPT, SURFACE_RULES, ONCALL_ROLE } from "./prompt";
export { DEFAULT_MODEL, MODEL_NOTES } from "./model-meta";
export {
  searchWebParameters,
  type SearchWebArgs,
  type SearchHit,
} from "./schemas";
