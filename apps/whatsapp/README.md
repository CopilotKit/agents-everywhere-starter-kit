# WhatsApp agent with phone approval

An independent **CopilotKit Channels + Meta WhatsApp Cloud API + OpenAI Agents SDK + Auth0** app. Channels receives signed Meta messages and renders replies. OpenAI proposes a named request; Auth0 Guardian CIBA authorizes that exact request before the server saves it locally. No Twilio account or dependency is used.

For example, text `Save a request called team-lunch`. WhatsApp and Guardian display the same `Save:team-lunch:#<request ID>` binding. Approval saves only that local demo record. It does not place an order, transfer money, or make a booking.

## Install and start

Use Node.js 22+. This app has its own install, lockfile and environment, separate from the repository workspaces:

```bash
cd apps/whatsapp
npm ci
cp .env.example .env
npm run typecheck
npm test
# Fill in .env before starting.
npm start
```

The app-scoped `.npmrc` uses `legacy-peer-deps=true`: the runtime's unused optional legacy LangChain connectors request OpenAI 4, while the existing Agents SDK requires OpenAI 7. The installed runtime v2 Channels surface is tested here. Keep Channels **0.9.2**, runtime **1.70.3**, and the **@ag-ui/client 0.0.59** override together; verify deduplication with `npm ls @ag-ui/client`. Do not install this app from the root workspace lockfile.

Expose port **3003** through one HTTPS tunnel, for example `ngrok http 3003`. Set `PUBLIC_BASE_URL` to its exact origin and restart after changing `.env`. `GET http://localhost:3003/health` reports process availability after startup; it does not prove live provider credentials or phone delivery.

## Accounts and configuration

1. **OpenAI:** put a server-side key in `OPENAI_API_KEY` and select an available `OPENAI_MODEL` (default `gpt-4.1-mini`). The model remains the OpenAI Agents SDK planner and never gets a tool that can bypass approval.
2. **Meta:** add WhatsApp to a Meta developer app. In WhatsApp API Setup, select the business/test number and an allowed test recipient. Copy the access token into `WHATSAPP_ACCESS_TOKEN` and the **Phone Number ID** into `WHATSAPP_PHONE_NUMBER_ID`. Copy the app secret from app settings into `WHATSAPP_APP_SECRET`. Temporary test access tokens expire; replace them before the demo when necessary.
3. **Meta webhook:** choose a random `WHATSAPP_VERIFY_TOKEN`. Configure callback `https://YOUR-PUBLIC-ORIGIN/webhooks/whatsapp`, enter the same verification token, verify, and subscribe to **messages**. The token is for the GET challenge; POST authenticity is the Meta `X-Hub-Signature-256` HMAC using the app secret. The API version defaults to `v23.0` and can be changed with `WHATSAPP_API_VERSION`.
4. **CopilotKit Intelligence:** set a project API key (`cpk-<project ID>_...`) as `INTELLIGENCE_API_KEY`. Set `WHATSAPP_CHANNEL_NAME=whatsapp-demo`, unique on this runtime. The real `CopilotRuntime` and `createCopilotNodeListener` own the Channels lifecycle. Direct Meta traffic goes between this app and Meta; it does not use the managed Slack/Teams delivery gateway. The Intelligence control connection is still required.
5. **Auth0:** create a confidential Regular Web Application using **Client Secret (Post)**, enable **Authorization Code** and **Client Initiated Backchannel Authentication**, and allow callback `https://YOUR-PUBLIC-ORIGIN/auth/callback`. Configure the issuer, client ID, client secret and API audience in `.env`. Create an RS256 custom API with `create:requests`, authorize the app/user appropriately, and grant the permission to the test user. Enable **Guardian push only** for CIBA and enroll the user in Guardian. CIBA availability depends on tenant entitlement.

The [sponsor setup guide](../../using-sponsor-tools.md#whatsapp-identity-and-phone-approval) covers Auth0 settings, and the [phone walkthrough](../../dev-docs/template-walkthroughs/whatsapp/README.md) tracks account setup and real evidence. SDK API reference: [direct adapters](https://docs.copilotkit.ai/reference/channels/sdk/direct-adapters).

## One public origin, two listeners

The public app on `PORT=3003` owns Auth0 login/callback routes and proxies **only** `/webhooks/whatsapp` to the SDK's `/webhook` listener on `WHATSAPP_WEBHOOK_PORT=3004`. Raw POST bytes, signature headers, GET query/challenge and response status are preserved. The proxy limits requests to 64 KiB, queries to 2 KiB, responses to 8 KiB and forwarding to five seconds. It checks the configured business phone-number ID. Status notifications are ignored as user input; this demo accepts text only.

Keep port 3004 private: the shipped SDK binds all interfaces and has no host option. Tunnel/publish only port 3003; use host/container networking controls to prevent direct access to 3004. The app preflights the internal port, awaits `listener.channels.ready()`, and verifies the internal GET challenge before serving traffic. A direct adapter can be ready while the managed-provider state is `setup_required` (no Slack/Teams attachment); the actual listener must still answer the configured challenge. Shutdown stops both the public listener and `listener.channels.stop()`.

The SDK's internal `listen()` does not reject bind errors through its promise. The preflight catches an already occupied port, but there is a narrow bind race if another process takes that port afterward. A bind error terminates the process; this app does not patch SDK internals or install an exception-swallowing handler.

## Try the phone flow

1. Text `hello` to the Meta test/business WhatsApp number from the allowed recipient phone.
2. Open the returned link, choose **Continue with Auth0**, and sign in. Link previews do not consume the login.
3. Send the displayed `LINK <code>` from the original WhatsApp conversation. A forwarded link/code from another sender cannot link your identity.
4. Text `Save a request called team-lunch`. Labels contain 1–24 ASCII letters, digits, hyphens or underscores.
5. Compare the exact request label and ID in WhatsApp and Guardian, then approve. Verify the saved receipt and its record in `.data/state.json`.
6. Stop and restart the app, then text `STATUS`; the saved result remains. After the one-minute cooldown, try another request and deny it. Try a third and let it expire. Neither creates a record.

There is one pending approval per sender and at most one new approval per minute. Text saying “approved” never grants permission. The server validates Auth0 token signature, issuer, audience, subject and scope, and checks the saved action binding before writing the record.

## Persistence and delivery limits

- `.data/state.json` is atomic local JSON for **one process on one machine**. It stores linked identities, the last 16 planner messages, inbound IDs, approval state, records and outbox status. Protect it as sensitive data; it also contains short-lived login/CIBA material. Set `DATA_FILE` to a persistent absolute path as needed.
- State version 2 binds the store to Meta and its configured business phone-number ID. Existing version 1 Twilio state or a changed business number is refused **without overwriting the file**. Stop the old app, resolve any pending approvals, archive its state, choose a fresh `DATA_FILE`, and sign in/`LINK` again. There is no automatic provider/account migration.
- **The SDK acknowledges Meta before asynchronous dispatch and app persistence.** A crash or failed write in that gap can lose the message after Meta received HTTP 200. This app does not claim persist-before-ACK, durable inbound delivery, or managed gateway retry guarantees. Once intake is persisted, duplicate `wamid.*` IDs cannot repeat planning or the protected action.
- Planner context comes from the persisted authenticated service history. The SDK's separate default quote-reply history is in memory and disappears on restart; quote expansion is therefore best effort. Send explicit request labels and plain `LINK`/`STATUS` messages. This app does not use SDK agent execution or its transient history as approval authority.
- The record and consumed approval are saved together. Pending approvals resume polling after restart with their original expiry. Interrupted model work, CIBA initiation and outbound sends become failed and are never automatically retried. A timeout can leave an external push/reply delivered despite uncertain local status. Text `STATUS` to recover the saved outcome.
- Outbound replies are attempted once, with a ten-second transport timeout. A Meta send failure never undoes an approved record. There is no production delivery retry queue. Replies after the 24-hour customer service window are suppressed until the user texts again. Delivery/status webhooks do not establish authorization.
- There is no public enqueue or record-list endpoint and no automatic relinking. For a clean reset, stop the app and deliberately archive its data, which removes identity/deduplication continuity. Never reset with a pending request. Recycled numbers, retention, rate limits, multi-process transactions and production account recovery need additional product work.
- OpenAI tracing and CopilotKit telemetry export are disabled by the entrypoint. Model inputs still go to OpenAI; messaging and identity data go to their providers. Application diagnostics omit provider bodies, tokens, headers and message content.

## Verification

`npm test` uses the **actual Channels Meta adapter**, real runtime lifecycle, a local Phoenix control server, signed Meta JSON, a local Graph server capturing rendered text, locally signed Auth0/JWKS tokens, and a local OpenAI Responses server. It covers signature/challenge checks, destination isolation, status notifications, sender-bound linking, wrong nonce/subject/audience/scope, exact request hashes, denial/expiry, duplicate delivery, cooldown, reply window, restart and safe diagnostics.

These local fixtures are not evidence of a live Meta phone conversation, Intelligence account access, Guardian approval or funded OpenAI access. Record those separately in the walkthrough using your real accounts. No standalone build output is needed: `tsx` runs the TypeScript app; `npm run typecheck` verifies its build configuration.
