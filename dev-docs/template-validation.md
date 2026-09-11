# Template validation evidence

Checked September 11, 2026. This page separates implemented boundaries, local tests, public protocol discovery, and authenticated provider journeys. A mock result or an approval card does not establish that a real external action executed.

## Web

**Implemented:** selected-record page context, proposal-only agent tool, immutable server-held task fields, browser-session consent, same-origin approval endpoint, workspace/identity and expiry checks, live MCP schema validation before writes, atomic attempt claims, reconciliation without blind create retries, and actual provider read-back with field comparison. Refresh reads Ambiguous; no browser/local-storage task fallback exists.

**Local verification:** root `npm run verify` passed 99 tests (56 root, 11 Slack, 32 web), all workspace typechecks, and the real local MCP stdio initialize/tool/resource roundtrip. `npm run build --workspace web` passed. Web tests cover configuration errors, HTTP origin/session and DNS-rebinding checks, edited approval payloads, denial, expiry, workspace changes, concurrency, restart, uncertain writes, schema failures, malformed provider results, unsafe links, and read-back mismatch. Independent review reproduced and verified fixes for session initialization, selected-incident refresh, and overlapping proposal completion races.

**Live public protocol check:** `npm run check:workplace --workspace web` connected to `https://app.ambiguous.ai/mcp` using the MCP SDK, discovered 856 tools, and validated the actual input schemas for `auth_whoami`, `create_task`, `get_task`, and `list_tasks`. This made no workspace tool calls or writes. The [public API contract](https://app.ambiguous.ai/api/openapi.json) confirms wrapped task responses and does not promise a record URL.

**Authenticated OpenAI/browser check:** an existing test credential successfully listed OpenAI models. A real browser run then rendered a card for the selected checkout incident with Maya Chen, 4.8s latency from 420ms, 18% affected requests, and an unconfirmed hypothesis. After selecting the notifications incident, the agent used Alex Rivera, a 2,400-message backlog, no message loss, and oldest-message age improving from 14 to 3 minutes. [Actual screenshots](template-walkthroughs/web/README.md) document this run. A browser retest confirmed readable card text after namespacing CSS variables. Both localhost and 127.0.0.1 proposal requests reached the correct missing-workspace response; an unrelated Origin stayed rejected. A real `propose_followup` call without the Ambiguous key returned the configuration failure, and both chat and page visibly explained that nothing was saved.

**Pending:** a real Ambiguous demo-workspace credential, authenticated identity check, approved create, exact returned record ID and any provider-returned link, refresh/retrieval without duplication, and live denied/expired/error cases. The app labels a missing returned link explicitly; it never invents a record URL. The approved-write UI and persistence boundary are tested locally, but the full live workplace journey has not passed.

## Slack

**Inherited live evidence:** the [September 10 screenshot walkthrough](channels-sdk-walkthrough/README.md) demonstrates managed Slack setup, a native incident card, thread reading, and contextual follow-up. It also records delivery lifecycle warnings. Those screenshots predate the current Exa journey and do not validate it.

**Current local verification:** 11 Slack tests and its workspace typecheck passed in root `npm run verify`. The tested `@copilotkit/channels` 0.9.2 / `@copilotkit/runtime` 1.70.3 pair is preserved; `@ag-ui/client` 0.0.59 remains deduplicated. No Slack source changes were needed for this follow-up.

**Pending:** an Exa credential and an explicitly authorized Slack test destination for earlier thread facts → `read_thread` → Exa source links → native Channels card → contextual follow-up. The [Slack walkthrough](template-walkthroughs/slack/README.md) identifies precisely which screenshots still need capturing. No new Slack messages were sent during this verification.

## WhatsApp

**Current local verification:** independent `npm ci --prefix apps/whatsapp`, `npm run typecheck --prefix apps/whatsapp`, and `npm test --prefix apps/whatsapp` passed, including 21 HTTP integration tests. These use locally signed tokens/provider adapters. This follow-up changes no WhatsApp app code or dependencies.

**Pending:** a CIBA-enabled/entitled Auth0 tenant, push-only Guardian setup and enrolled device, configured Twilio Sandbox, public HTTPS origin, and an authorized test number. Run the real signed inbound → original-sender account link → OpenAI proposal → Guardian approval → exact local named-request record → status journey. Verify denial and expiry cannot save. The [WhatsApp capture guide](template-walkthroughs/whatsapp/README.md) has concrete setup/run steps and explicitly pending live screens; no simulated success screenshots are supplied.

## Reproduce and record the remaining evidence

Run local checks with Node.js 22+. Keep keys in the documented private environment files. Use a demo workspace and authorized messaging destinations, preserve the web approval metadata directory and WhatsApp data file across restart, and record the actual provider IDs/outcomes. Before publishing a screenshot, exclude credentials, linking codes, private workspace navigation, and unrelated conversations.
