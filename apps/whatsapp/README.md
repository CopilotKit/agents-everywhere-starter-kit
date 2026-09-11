# WhatsApp agent with phone approval

A runnable, independent **OpenAI Agents SDK + Auth0** app. Text it on WhatsApp, connect your account through Auth0, and approve a concrete action on your phone. It uses Twilio’s WhatsApp testing environment and Auth0 Guardian. This app has no CopilotKit dependency.

The demo action saves a named request in local storage. It does not place orders, move money, or call a booking service. For example, text `Save a request called team-lunch`; Guardian shows `Save:team-lunch:#<request ID>`. The same label and ID appear in WhatsApp. Only that request can execute after approval.

## Run locally

Use Node.js 22 or later. From the repository root:

```bash
npm ci --prefix apps/whatsapp
cp apps/whatsapp/.env.example apps/whatsapp/.env
npm test --prefix apps/whatsapp
npm run typecheck --prefix apps/whatsapp
```

Fill in `apps/whatsapp/.env` using the [sponsor setup](../../using-sponsor-tools.md#whatsapp-identity-and-phone-approval), then:

```bash
npm start --prefix apps/whatsapp
```

The server listens on port **3003**. `GET http://localhost:3003/health` returns `{"ok":true}`. Startup validates configuration; it does not send a message or provision anything. The health endpoint checks process availability, not provider credentials.

Expose port 3003 through an HTTPS tunnel, for example `ngrok http 3003`. Set `PUBLIC_BASE_URL` to its exact HTTPS origin. Restart the app after editing `.env`; update both dashboards when the tunnel URL changes.

## Provider setup

Follow [Auth0 identity, phone approval, and WhatsApp transport setup](../../using-sponsor-tools.md#whatsapp-identity-and-phone-approval) in the consolidated sponsor guide. That section contains the exact Auth0 application/API settings, Twilio webhook URL, environment variables, and first successful call. [OpenAI access and credits](../../using-sponsor-tools.md#openai) are in the same file.

## Try the full flow

1. Text `hello` to your Twilio WhatsApp sender.
2. Open the returned link, select **Continue with Auth0**, and sign in. Link previews do not consume the login link.
3. Send the displayed `LINK <code>` in the original WhatsApp conversation. The bot confirms your display name.
4. Text `Save a request called team-lunch`. Labels are 1–24 ASCII letters, digits, hyphens, or underscores.
5. Read the exact request label and code in WhatsApp and Guardian. Approve it on your phone. The bot replies with the saved record ID; `.data/state.json` now contains the record, associated with your Auth0 subject.
6. After one minute, try another name and **deny** it. Try a third and allow it to expire. Neither creates a record. Text `STATUS` to retrieve the latest five outcomes at any time.

Only one pending approval per sender is allowed, and new approval requests are limited to one per minute. A text message saying “approved” never grants permission. A changed label or mismatched identity cannot use an existing approval.

## Storage, restart, and limits

- `.data/state.json` is an atomic JSON file for **one process on one machine**. Do not run replicas, multiple workers, or two processes against it. It stores linked identities, the last 16 conversation messages, webhook IDs, requests, pending approvals, and outbound status. Use `DATA_FILE` for a different persistent path. This is sensitive local data; short-lived login material and CIBA request IDs are also present while needed.
- Webhooks are persisted before acknowledgment and deduplicated by Twilio Message SID. A record and its consumed approval are saved together. Pending approvals resume polling after restart, subject to the original expiry. No work runs while the process is stopped.
- An interrupted model call, CIBA initiation, or outbound send is marked failed on restart. It is not automatically repeated. A provider timeout can leave a push or reply delivered even though its local status is uncertain. Ask the bot for `STATUS`; start a fresh request only when needed. Duplicate delivery cannot repeat the protected action.
- Outbound replies are attempted once. A Twilio send failure does not undo an approved local record. `STATUS` recovers the result when messaging is available. Replies outside the customer service window are suppressed until the user texts again. There is no delivery-status callback, retry queue, or production delivery guarantee.
- There is no automatic account relinking or public record-list endpoint. For a clean demo reset, stop the server and deliberately remove its `.data` directory; this deletes identities, requests, and deduplication history. Never reset while a request is pending. Treat recycled phone numbers and production account recovery as separate product work.
- The JSON file grows with requests and webhook history; production requires a transactional database, retention policy, appropriate rate limits, and a supervised worker. SDK trace export is disabled; model inputs still go to OpenAI and messaging/identity data goes to the respective providers.

## Verification

`npm test --prefix apps/whatsapp` exercises the real HTTP app with local Auth0/JWKS, Twilio, and OpenAI Responses servers. It uses locally signed JWTs and no live credentials. Coverage includes signed webhooks, account linking and callback replay, nonce mismatch, model proposals, pending/denied/expired approvals, wrong subject/audience/permission, polling backoff, duplicate delivery, restart, and bounded action parameters.

The app has been typechecked and exercised against those local adapters. **Live Twilio delivery, Auth0 tenant configuration/Guardian approval, and OpenAI account access still need validation with your own accounts.** No external resources have been provisioned and no live messages were sent as part of repository validation.
