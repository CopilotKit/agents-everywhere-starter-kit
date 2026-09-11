# Template validation evidence

Checked September 11, 2026. This page separates implemented boundaries, local tests, public protocol discovery, and authenticated provider journeys. A mock result or an approval card does not establish that a real external action executed.

## Web

**Implemented:** selected-record page context, proposal-only agent tool, immutable server-held task fields, browser-session consent, same-origin approval endpoint, workspace/identity and expiry checks, live MCP schema validation before writes, atomic attempt claims, reconciliation without blind create retries, and actual provider read-back with field comparison. Refresh reads Ambiguous; no browser/local-storage task fallback exists.

**Local verification:** root `npm run verify` passed 99 tests (56 root, 11 Slack, 32 web), all workspace typechecks, and the real local MCP stdio initialize/tool/resource roundtrip. `npm run build --workspace web` passed. Web tests cover configuration errors, HTTP origin/session and DNS-rebinding checks, edited approval payloads, denial, expiry, workspace changes, concurrency, restart, uncertain writes, schema failures, malformed provider results, unsafe links, and read-back mismatch. Independent review reproduced and verified fixes for session initialization, selected-incident refresh, and overlapping proposal completion races.

**Live public protocol check:** `npm run check:workplace --workspace web` connected to `https://app.ambiguous.ai/mcp` using the MCP SDK, discovered 856 tools, and validated the actual input schemas for `auth_whoami`, `create_task`, `get_task`, and `list_tasks`. This made no workspace tool calls or writes. The [public API contract](https://app.ambiguous.ai/api/openapi.json) confirms wrapped task responses and does not promise a record URL.

**Authenticated OpenAI/browser check:** an existing test credential successfully listed OpenAI models. A real browser run then rendered a card for the selected checkout incident with Maya Chen, 4.8s latency from 420ms, 18% affected requests, and an unconfirmed hypothesis. After selecting the notifications incident, the agent used Alex Rivera, a 2,400-message backlog, no message loss, and oldest-message age improving from 14 to 3 minutes. [Actual screenshots](template-walkthroughs/web/README.md) document this run. A browser retest confirmed readable card text after namespacing CSS variables. Both localhost and 127.0.0.1 proposal requests reached the correct missing-workspace response; an unrelated Origin stayed rejected. A real `propose_followup` call without the Ambiguous key returned the configuration failure, and both chat and page visibly explained that nothing was saved.

**Signed-in Ambiguous setup check:** verified **Admin → People & access → API keys → New API key** in an existing workspace. The [setup screenshot](template-walkthroughs/web/images/05-ambiguous-key-setup.jpg) shows the selected identity, task-only `tasks.read,tasks.write` scopes, expiry, and rate limit before key creation. No credential was generated or exposed in this capture; this verifies onboarding only. A task-scoped key was subsequently created with user approval for the live trial.

**Authenticated Ambiguous persistence check:** `npm run check:workplace --workspace web -- --identity` passed for Jerel Velarde in workspace `cb67313c-970a-4fb1-a6d8-05c8f08d5fc7`. The real OpenAI/CopilotKit agent prepared `[Hackathon demo] Verify checkout latency recovery` through `propose_followup`. Before approval, the UI showed the exact immutable fields and no saved task. Clicking **Approve & save to Ambiguous** created and read back task `5b1f10b9-1f41-44cc-a583-4f4fccfa846c` with the exact title and description. Ambiguous returned no record URL; the UI showed the actual ID and explained that no link was available. A full browser reload retrieved exactly the same one task. A subsequent real `retrieve_followup` call returned that ID with the same title, description, and INC-1042 markers, without creating a duplicate. [Review, saved-record, and retrieval screenshots](template-walkthroughs/web/README.md#4-prepare-and-review-a-task) document the live write.

**Live denial check:** a separate proposal titled `[Hackathon demo] Declined proposal — do not save` was declined. The UI reported no task was created, and refreshing from Ambiguous still returned exactly the original approved task. The [decline screenshot](template-walkthroughs/web/images/10-declined-no-task-created.jpg) shows the status and refreshed list.

**Pending:** live expiry and authenticated provider-error/recovery cases. Local tests cover these boundaries; the authenticated proposal, approval, create, read-back, reload, and agent retrieval journey has passed.

## Slack

**Inherited live evidence:** the [September 10 screenshot walkthrough](channels-sdk-walkthrough/README.md) demonstrates managed Slack setup, a native incident card, thread reading, and contextual follow-up. It also records delivery lifecycle warnings. Those screenshots predate the current Exa journey and do not validate it.

**Current local verification:** 11 Slack tests and its workspace typecheck passed in root `npm run verify`. The tested `@copilotkit/channels` 0.9.2 / `@copilotkit/runtime` 1.70.3 pair is preserved; `@ag-ui/client` 0.0.59 remains deduplicated. No Slack source changes were needed for this follow-up.

**Signed-in Exa setup check:** completed **Codex → JavaScript → Web search tool → Generate Code → Go to Dashboard** in an existing account. The existing default key was available for the runtime; no duplicate key was created. [Actual setup screenshots](template-walkthroughs/slack/README.md#2-configure-and-start-the-template) show onboarding and the dashboard with the key masked. These captures verify setup only.

**Authenticated Exa search:** the actual starter `searchWeb` capability succeeded with the existing key using `fast`, three results, and the query `site:aws.amazon.com builders library timeouts retries backoff jitter connection pool`. It returned AWS’s Java timeout guide, backoff-and-jitter article, and Java retry-strategy guide. The same query succeeded in the signed-in Search playground. [Actual settings and results](template-walkthroughs/slack/README.md#4-research-with-exa-and-inspect-the-sources) document the provider response; two supporting AWS pages were opened and checked. All five workspace typechecks also passed before the live Slack trial.

**Current live Slack context/card check:** in the authorized `#agents-everywhere` test thread, the bot called `read_thread`, `incident_card`, and `timeline`. Its actual native card incorporated the earlier failed rollback, connection-pool wait rising from 20 ms to 1.6 s, retries at about 3× baseline, and steady database CPU, while leaving causality unconfirmed. [Current thread and card screenshots](template-walkthroughs/slack/README.md#3-put-facts-in-the-thread-before-mentioning-the-bot) document the result. A research reply without another mention triggered `read_thread` and three `search_web` calls, then delivered an updated native card; it omitted the requested source URLs. [Tool-call and expanded follow-up screenshots](template-walkthroughs/slack/README.md#5-ask-a-contextual-follow-up-without-another-mention) show the updated card in the same thread. A subsequent unmentioned request for three links invoked tools, but no source URLs were delivered by the end of the trial.

**Pending:** visible source links to complete the current sourced-answer journey. Context reuse, Exa invocation, and native follow-up delivery passed. The [Slack walkthrough](template-walkthroughs/slack/README.md) separates verified steps from pending captures. The live trial also left **hackathon-helper is working…** visible after delivery; observed runtime info output showed no errors, so completion-state behavior remains unresolved.

## WhatsApp

**Current local verification:** independent `npm ci --prefix apps/whatsapp`, `npm run typecheck --prefix apps/whatsapp`, and `npm test --prefix apps/whatsapp` passed, including 21 HTTP integration tests. These use locally signed tokens/provider adapters. This follow-up changes no WhatsApp app code or dependencies.

**Account status:** the user confirmed WhatsApp, Twilio, and Auth0 are not set up yet. No live phone-flow success is available.

**Pending:** a CIBA-enabled/entitled Auth0 tenant, push-only Guardian setup and enrolled device, configured Twilio Sandbox, public HTTPS origin, and an authorized test number. Run the real signed inbound → original-sender account link → OpenAI proposal → Guardian approval → exact local named-request record → status journey. Verify denial and expiry cannot save. The [WhatsApp capture guide](template-walkthroughs/whatsapp/README.md) has concrete setup/run steps and explicitly pending live screens; no simulated success screenshots are supplied.

## Reproduce and record the remaining evidence

Run local checks with Node.js 22+. Keep keys in the documented private environment files. Use a demo workspace and authorized messaging destinations, preserve the web approval metadata directory and WhatsApp data file across restart, and record the actual provider IDs/outcomes. Before publishing a screenshot, exclude credentials, linking codes, private workspace navigation, and unrelated conversations.
