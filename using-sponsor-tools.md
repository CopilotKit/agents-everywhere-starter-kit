# Using sponsor tools

One setup reference for the six sponsors featured in this kit. Choose the tools your workflow needs. **OpenAI** is the marquee sponsor; **CopilotKit and OpenRouter** share the next tier; **Exa, Auth0, and Ambiguous AI** provide additional capabilities. This is the kit's selected lineup; the [event portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) maintains the full event roster.

Use Node.js 22+. For Slack/web, run the homepage's clone/install steps and keep credentials in root `.env`. WhatsApp has its own `apps/whatsapp/.env`. Never put keys in frontend code or a submission. `npm run verify` covers offline behavior, not live account access.

| Sponsor                       | Used by                                    | First result                                             |
| ----------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| [OpenAI](#openai)             | Slack, web, WhatsApp                       | A model response to supplied context                     |
| [CopilotKit](#copilotkit)     | Slack, web, WhatsApp                              | A contextual answer and native UI                        |
| [OpenRouter](#openrouter)     | Optional model gateway for all three templates | A response from your chosen catalog model             |
| [Exa](#exa)                   | Slack template                             | Research with inspectable sources                        |
| [Auth0](#auth0)               | WhatsApp; standalone protected-API example | Verified identity and approval before a protected action |
| [Ambiguous AI](#ambiguous-ai) | Web template; optional Slack integration   | A real workplace record that survives refresh            |

## OpenAI

**Access and authentication.** Follow [OpenAI credit instructions](CREDITS.md#openai-credits), then create a server-side [API key](https://platform.openai.com/api-keys) in the funded organization/project. Credit redemption and key creation are separate steps.

**Configure Slack/web** in root `.env`:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
```

`MODEL` is the kit's configured model; choose one available to your API account. WhatsApp uses the same `MODEL_PROVIDER`, `OPENAI_API_KEY`, and `MODEL` settings in `apps/whatsapp/.env`, with `gpt-4.1-mini` as its default. Its legacy `OPENAI_MODEL` setting still works when `MODEL` is absent.

**First call.** From root, make a small Responses API request using the configured key and model:

```bash
node --env-file=.env --input-type=module <<'JS'
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.MODEL,
    input: 'A team already tried a rollback and it did not help. What should an assistant remember when suggesting the next step?',
    max_output_tokens: 1024,
  }),
});
if (!response.ok) throw new Error(`OpenAI request failed: HTTP ${response.status}`);
const result = await response.json();
const answer = result.output.flatMap(item => item.content ?? [])
  .filter(item => item.type === 'output_text').map(item => item.text).join('\n');
if (!answer) throw new Error(`OpenAI returned no text; response status: ${result.status}`);
console.log(answer);
JS
```

**Check:** the response accounts for the failed rollback; confirm usage in the correct API project. Then run `npm run dev:local`, `npm run dev:slack`, or `npm run dev:web`. These use the [shared model adapter](packages/agent-core/src/model.ts). The [WhatsApp app](apps/whatsapp/README.md) uses OpenAI Agents SDK directly. [Agents SDK quickstart](https://openai.github.io/openai-agents-js/guides/quickstart/)

## CopilotKit

**Access and authentication.** The React web template needs only your model-provider account. The Slack template additionally uses [CopilotKit Intelligence](https://intelligence.copilotkit.ai/) to manage the Channel and Slack installation. Create a Channel with `npm run channel:setup`; follow [setup](dev-docs/setup.md) or the [illustrated walkthrough](dev-docs/channels-sdk-walkthrough/README.md).

**Configure Slack** in root `.env`, alongside the model settings:

```dotenv
CHANNEL_CODE=your-channel-code
INTELLIGENCE_API_KEY=your-project-scoped-key
LOG_LEVEL=debug
```

The Channel Code must match Intelligence exactly. Use a project-scoped API key from that project's API Keys page. Managed Slack requires no `xapp-` token or public tunnel. The WhatsApp template uses a direct Meta adapter with its own Intelligence key, Meta credentials, and public HTTPS webhook; follow [its complete setup](#whatsapp-transport-setup-meta--copilotkit-channels).

**First call, Slack:**

```bash
npm run check-env
npm run dev:slack
```

Invite the bot and add a few facts to a thread before asking: “Read this thread and show an incident card.” **Check:** `read_thread` uses earlier messages and `incident_card` renders in Slack. Customize [the Channel](apps/channel-slack/src/channel.tsx), [tools](apps/channel-slack/src/tools.tsx), and [components](apps/channel-slack/src/components.tsx).

**First call, React:** run `npm run dev:web`, open `http://localhost:3100`, select an incident, then ask: “What is happening with the selected incident? Show a card.” **Check:** the answer matches the current page without pasting its contents. [AppControl](apps/web/src/components/app-control.tsx) registers page context and frontend tools; [GenerativeUI](apps/web/src/components/generative-ui.tsx) registers React components.

Keep the tested Channels/runtime versions and the `@ag-ui/client` override. Before editing the Slack template, read the [Channels skill](.agents/skills/build-channels-agent/SKILL.md). [CopilotKit docs](https://docs.copilotkit.ai/) · [Channels guide](https://copilotkit.ai/channels-guide.md)

## OpenRouter

**Access and authentication.** Create an [API key](https://openrouter.ai/keys), choose a model from the [catalog](https://openrouter.ai/models), and check any event offer in [CREDITS.md](CREDITS.md#other-sponsor-access). Use a model that supports tools for Slack/web workflows, or structured outputs for WhatsApp proposals.

**Configure** root `.env` for Slack/web, or `apps/whatsapp/.env` for WhatsApp:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MODEL=openai/gpt-4.1-mini
```

Replace `MODEL` with an available catalog slug. All three chat templates only require the selected model provider's key; keep their other sponsor credentials. WhatsApp still uses OpenAI Agents SDK, with Chat Completions and a strict proposal schema. It requires endpoints supporting the schema through `provider.require_parameters=true` and validates the result before requesting Auth0 approval. See [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). The independent browser voice route still requires OpenAI Realtime credentials.

**First call:** from the repository root. For WhatsApp, change `--env-file=.env` below to `--env-file=apps/whatsapp/.env`.

```bash
node --env-file=.env --input-type=module <<'JS'
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.MODEL,
    messages: [{ role: 'user', content: 'Suggest one useful action for an assistant in a team research thread.' }],
  }),
});
if (!response.ok) throw new Error(`OpenRouter request failed: HTTP ${response.status}`);
const result = await response.json();
console.log(result.choices[0].message.content);
JS
```

**Check:** inspect the response and selected model in your account, then run the same template scenario after restarting the app. [Quickstart](https://openrouter.ai/docs/quickstart) · [Provider precedence and switching](dev-docs/model-switching.md)

## Exa

**Access and authentication.** Sign into your existing [Exa dashboard](https://dashboard.exa.ai/). The following onboarding flow was checked in a signed-in account on September 11, 2026:

1. If **Create your setup prompt** appears, select **Codex**, **JavaScript**, and **Web search tool**. Select **Generate Code**, then **Go to Dashboard**. If your account already opens the dashboard, continue there.
2. Find **Get your API Key** on the home page, or open **Management → API Keys**. A default key was already available in the verified account; reuse a suitable existing key.
3. Copy the key privately into root `.env` as `EXA_API_KEY`. Keep it masked in screenshots and out of generated code that you share. The starter already includes the Exa integration.
4. Run the first-call example below, inspect its returned source URLs, and restart the Slack listener after changing its environment.

The [Slack screenshot guide](dev-docs/template-walkthroughs/slack/README.md#2-configure-and-start-the-template) shows the actual onboarding form and dashboard with the key masked. Those screens verify account setup; the authenticated search and Slack delivery checks are separate. Exa supplies public web evidence; it does not read your private incident logs.

**Configure** root `.env`:

```dotenv
EXA_API_KEY=your-key
EXA_SEARCH_TYPE=fast
```

**First call**, using the same SDK as the kit:

```bash
node --env-file=.env --input-type=module <<'JS'
import { Exa } from 'exa-js';
const exa = new Exa(process.env.EXA_API_KEY);
const result = await exa.searchAndContents('site:aws.amazon.com builders library timeouts retries backoff jitter connection pool', {
  type: 'fast',
  numResults: 3,
  highlights: { numSentences: 2, highlightsPerUrl: 1 },
});
console.log(result.results.map(({ title, url, highlights }) => ({ title, url, highlights })));
JS
```

**Verified search:** the query above succeeded through the starter’s `searchWeb` capability and in Exa’s signed-in Search playground with **Fast** search and **3** results. The trial returned the AWS SDK for Java timeout guide, the AWS backoff-and-jitter article, and the AWS SDK for Java retry-strategy guide. [Actual search screenshots](dev-docs/template-walkthroughs/slack/README.md#4-research-with-exa-and-inspect-the-sources) show settings and returned sources. Results may change.

**Check:** open the returned URLs and compare their evidence with the answer. In Slack ask the agent to research the question in the thread and include sources. The [search capability](packages/agent-core/src/capabilities/search.ts) is registered by the Slack template when the key exists. It also appears in MCP and voice search; ordinary web chat does not register Exa. [Search API quickstart](https://exa.ai/docs/reference/search-api-guide)

## Auth0

### WhatsApp identity and phone approval

You need an OpenAI or OpenRouter key, a CopilotKit Intelligence key, a Meta app with WhatsApp Cloud API access, and an Auth0 tenant with **CIBA** access. Auth0 documents an Enterprise plan or appropriate add-on requirement. The development trial checked for this guide accepted CIBA configuration; verify availability in your own tenant and do not assume ongoing free access. Enable Guardian push and enroll your test user before testing approvals. See [Auth0 CIBA configuration](https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication) and [Guardian enrollment](https://auth0.com/docs/secure/multi-factor-authentication/auth0-guardian).

#### Auth0 application and user

1. In **Applications → Applications**, create a first-party, OIDC-conformant **Regular Web Application**. Open its **Credentials → Authentication Methods** and select **Client Secret (Post)** (`client_secret_post`). In **Grant Types**, enable **Authorization Code** and **Client Initiated Backchannel Authentication**, then save. Use this same confidential client for login and CIBA. See [application credentials](https://auth0.com/docs/get-started/applications/credentials).
2. Set the Allowed Callback URL to `https://YOUR-PUBLIC-ORIGIN/auth/callback`. Set `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` in `apps/whatsapp/.env`. The issuer must be the exact tenant/custom domain used for login and token issuance.
3. Create a custom API with identifier `https://whatsapp-demo.example` (or your own value), **RS256** signing, and permission **`create:requests`**. Set `AUTH0_AUDIENCE` to its identifier. Enable API RBAC. Under **Application Access**, edit your Regular Web Application, select **User-Delegated Access**, choose **Grant Access**, select `create:requests`, and save. Confirm **1 / 1 permissions granted**. Under **User Management → Roles**, create a requester role, add this API permission, and assign the role to the test user after their first application login. Dashboard account membership does not create an application user. The app checks the access token’s `scope`; authentication alone is insufficient.
4. In the app’s settings, open **Client Initiated Backchannel Authentication (CIBA)** and enable **Guardian push only**. Disable the email notification channel so an unenrolled user cannot fall back to email approval. In **Security → Multi-factor Auth → Push Notification using Auth0 Guardian**, enable the factor, set **Push Notification App** to **Auth0 Guardian**, and save. Require MFA for the test login to prompt enrollment. Check the test user under **User Management → Users** and confirm Guardian enrollment before trying CIBA. This app requests up to 300 seconds for the push approval.

The login uses authorization code + PKCE, state, browser cookie, and validated ID token nonce. It never trusts a user-supplied Auth0 subject. After login, the browser displays a confirmation code that must be sent from the original WhatsApp sender before linking takes effect. See [Auth0 authorization code with PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce/call-your-api-using-the-authorization-code-flow-with-pkce).

CIBA calls `POST /bc-authorize` using an `iss_sub` login hint for the linked subject, your API audience, `openid create:requests`, and the exact action’s binding message. The worker polls `POST /oauth/token` with the returned `auth_req_id`, respecting `interval` and `slow_down`. Approval requires a valid RS256 access token for the expected issuer, audience, client, subject, expiry, and permission. Access tokens are used for that exchange only and are not stored or accepted from WhatsApp. See [Auth0 CIBA push flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-initiated-backchannel-authentication-flow/mobile-push-notifications-with-ciba) and [access token validation](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens).

#### WhatsApp transport setup (Meta + CopilotKit Channels)

Use a Meta developer account and a WhatsApp-enabled app. Follow [Meta’s Cloud API setup](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) to obtain a test business number and verify the recipient phone. The [Channels direct adapter reference](https://docs.copilotkit.ai/reference/channels/sdk/direct-adapters) describes the supported adapter; a CopilotKit Intelligence key is still required for its runtime lifecycle.

1. In Meta’s WhatsApp API setup, copy the access token and **Phone number ID** privately into `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Use the ID, not the displayed phone number. Copy the Meta application secret into `WHATSAPP_APP_SECRET`. Temporary test access tokens expire; use the credential appropriate to your deployment.
2. Choose a private random `WHATSAPP_VERIFY_TOKEN`. Keep the same value in the app and Meta’s webhook configuration. This verifies webhook setup; the app secret verifies incoming message signatures.
3. Start the app behind a public HTTPS origin, then configure Meta’s callback as `https://YOUR-PUBLIC-ORIGIN/webhooks/whatsapp` and supply the verify token. Subscribe to WhatsApp **messages** events for the selected business number/account.
4. Set `INTELLIGENCE_API_KEY` from your [CopilotKit Intelligence account](https://intelligence.copilotkit.ai/) and use a distinct channel name such as `whatsapp-demo`. This direct connection keeps Meta ingress and replies in the app process.

The main server forwards the raw signed JSON to the SDK webhook listener after checking the business phone-number ID. Channels handles verification and renders replies through Meta. Free-form replies use the open 24-hour customer-service window. The SDK acknowledges inbound messages before its asynchronous handler persists them; an HTTP 200 is receipt evidence, not proof that the request was processed or saved. Run one durable app process and inspect its status and saved receipt.

#### OpenAI Agents SDK

Set `MODEL_PROVIDER=openai` with `OPENAI_API_KEY`, or `MODEL_PROVIDER=openrouter` with `OPENROUTER_API_KEY`. Choose `MODEL` with structured-output support. Defaults are `gpt-4.1-mini` for OpenAI and `openai/gpt-4.1-mini` for OpenRouter; the legacy `OPENAI_MODEL` setting remains a fallback when `MODEL` is absent. [agent.ts](apps/whatsapp/src/agent.ts) uses the actual `@openai/agents` `Agent` and `run()` APIs with either provider. It receives the authenticated display name and recent conversation and returns a validated proposal. The model has no privileged execution tool. See the [Agents SDK quickstart](https://openai.github.io/openai-agents-js/guides/quickstart/), [structured output guide](https://openai.github.io/openai-agents-js/guides/agents/), and [provider switching](dev-docs/model-switching.md).

#### Environment and first working call

This app has its own dependencies and environment. From the repository root:

```bash
npm ci --prefix apps/whatsapp
cp apps/whatsapp/.env.example apps/whatsapp/.env
npm run typecheck --prefix apps/whatsapp
npm test --prefix apps/whatsapp
```

Fill in `apps/whatsapp/.env` with the values from the steps above:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
MODEL=gpt-4.1-mini
PUBLIC_BASE_URL=https://your-public-origin.example
AUTH0_ISSUER_BASE_URL=https://your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-regular-web-app-client-id
AUTH0_CLIENT_SECRET=your-regular-web-app-client-secret
AUTH0_AUDIENCE=https://whatsapp-demo.example
INTELLIGENCE_API_KEY=your-copilotkit-intelligence-key
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
WHATSAPP_PHONE_NUMBER_ID=your-meta-phone-number-id
WHATSAPP_APP_SECRET=your-meta-app-secret
WHATSAPP_VERIFY_TOKEN=your-private-random-verify-token
WHATSAPP_API_VERSION=v23.0
WHATSAPP_CHANNEL_NAME=whatsapp-demo
PORT=3003
WHATSAPP_WEBHOOK_PORT=3004
```

For OpenRouter, replace the three model lines with the [OpenRouter configuration](#openrouter), keeping the other settings. Use the business phone-number ID from your Meta app. The default record store is `apps/whatsapp/.data/state.json`; optionally set `DATA_FILE` to an absolute persistent path. Run one process against that file. If upgrading an existing Twilio demo, archive its state and choose a fresh `DATA_FILE`, then link your user again; identities are not migrated across messaging providers or business numbers. Changing only the model provider does not require relinking.

```bash
npm start --prefix apps/whatsapp
```

Expose port 3003 through a public HTTPS tunnel or deploy the app with a persistent disk. Set `PUBLIC_BASE_URL` to that origin and use it for the Auth0 callback and Meta webhook. Keep the SDK listener port 3004 private. For a local tunnel, `ngrok http 3003` is one option. Restart after editing the environment. `GET http://localhost:3003/health` verifies the process, not external account access.

**First successful call:** send `hello` from the verified recipient phone to your Meta test business number, open the returned link, select **Continue with Auth0**, and sign in. Send the browser's `LINK <code>` from the original WhatsApp conversation. Then text `Save a request called team-lunch`. Match its label and request ID to the Guardian push on your phone and approve. The reply contains the saved local record ID. Text `STATUS` after restarting to retrieve the same outcome.

**Permission check:** after one minute, request a different label and deny the push. No record should be created. An expired request must also leave no record. A text saying “approved” is not an Auth0 approval. Labels are limited to 1–24 ASCII letters, digits, hyphens, or underscores so the entire action fits in the consent message.

This is a persistent **local demo request**, not an external booking, purchase, or scheduled notification. The server owns the protected write and verifies the scoped token from the exact CIBA request. Offline tests exercise local HTTP adapters; live Meta delivery, Channels startup, model-provider access, and Auth0 Guardian approval require your accounts. See the [WhatsApp app](apps/whatsapp/README.md) for operational limits and restart behavior.

### Standalone protected API call

Use this smaller example to learn Auth0 API authorization independently. It is machine-to-machine authorization, not the WhatsApp human-approval flow.

**Access and configure:** in Auth0, create an RS256 API with identifier `https://agents-everywhere.example/api`, add permission `create:followups`, and grant it to a Machine to Machine application. The identifier is an audience string and does not need a hosted URL. Add these values to root `.env`:

```dotenv
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://agents-everywhere.example/api
AUTH0_CLIENT_ID=your-m2m-client-id
AUTH0_CLIENT_SECRET=your-m2m-client-secret
```

**First working call:**

```bash
npm ci --prefix examples/auth0
npm test --prefix examples/auth0
# Terminal 1, from root:
node --env-file=.env examples/auth0/server.mjs
# Terminal 2, from root:
node --env-file=.env examples/auth0/client.mjs
```

**Check:** the client first gets `401` without authorization, then `201` and a local record with an Auth0 service identity. Tokens are not printed. Records last until the server stops. A `403` indicates missing scope; check the API grant. Customize [client.mjs](examples/auth0/client.mjs) and [server.mjs](examples/auth0/server.mjs). The server validates signature, issuer, audience, expiry, and scope before the write. [Node API quickstart](https://auth0.com/docs/quickstart/backend/nodejs) · [Client credentials flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-credentials-flow/call-your-api-using-the-client-credentials-flow)

## Ambiguous AI

**Access and authentication.** Sign into [Ambiguous](https://app.ambiguous.ai/) and select the existing demo workspace you intend to use. The following existing-account flow was checked in the signed-in interface on September 11, 2026:

1. Open **Admin → People & access → API keys**. If a suitable key already exists in your private environment or secret store, reuse it; do not create a duplicate just because its value is not visible in the list.
2. Select **New API key**. In the **User** selector, choose the identity the web template should act as in this workspace. If you cannot access this administration page, ask the workspace administrator to create the scoped key.
3. Set **API key name** to `Hackathon web template`.
4. Replace the default `*` in **Scopes** with `tasks.read,tasks.write`. This is a comma-separated text field. These API-key scopes permit task retrieval and creation; the wildcard is unnecessary for this template. OAuth's wildcard grant is a different authentication path.
5. Set an expiry after your demo; for the September 12 event, `2026-09-18` is an example. Keep the displayed **Rate limit** value of `100` for the initial demo unless your workspace administrator specifies otherwise.
6. Review the workspace, selected user, scopes, and expiry, then select **Create API key**. Creation grants access for that identity; a human should approve the selected scope before an agent creates it.
7. Copy the generated key privately into root `.env` as `AMBIGUOUS_API_KEY`. Keep the value out of chat, screenshots, recordings, frontend code, and commits. Restart the web app after updating its environment.

The kit sends the key as a Bearer credential to `https://app.ambiguous.ai/mcp`. `AMBIGUOUS_API_KEY` is this kit's setting; the vendor CLI manages credentials separately. [Authentication and API-key scopes](https://www.ambiguous.ai/auth.md) · [MCP guide](https://www.ambiguous.ai/agents/mcp)

**Configure** root `.env`:

```dotenv
AMBIGUOUS_API_KEY=your-workspace-api-key
```

**First call:** confirm the credential's identity before creating data:

```bash
node --env-file=.env --input-type=module <<'JS'
const response = await fetch('https://app.ambiguous.ai/api/users/me', {
  headers: { Authorization: `Bearer ${process.env.AMBIGUOUS_API_KEY}` },
});
if (!response.ok) throw new Error(`Ambiguous identity check failed: HTTP ${response.status}`);
console.log(await response.json());
JS
```

**Check:** the returned identity belongs to the intended demo workspace. Run `npm run check:workplace --workspace web` to discover and validate the public MCP input schemas, then add `-- --identity` to verify your authenticated workspace. These commands never create tasks.

Run `npm run dev:web` and follow [the web template's create/read-back sequence](templates/web.md#prove-a-record-survives-refresh). The agent's `propose_followup` prepares the exact fields; the page's **Approve & save to Ambiguous** button authorizes the server to write them. The web runtime has no raw MCP write tools. Saved tasks are retrieved from Ambiguous after refresh; consent/attempt metadata needs persistent disk. See [web operation](templates/web.md#failure-and-deployment-behavior).

Tool names and inputs come from the live MCP catalog. The adapter uses `auth_whoami`, `create_task`, `get_task`, and `list_tasks`, verified on September 11, 2026. The published Task response supplies a real ID but does not guarantee a record URL. Display a provider-returned link when present and identify its absence when missing; never manufacture a URL.

The [shared MCP connection](packages/agent-core/src/capabilities/workplace.ts) remains available to Slack and terminal chat when configured. Unlike the web's narrow approval path, those surfaces expose the general workspace tools; their proposal cards do not enforce approval around every MCP call. A `401` needs valid credentials; a `403` needs appropriate permissions. Creating a new workspace does not repair access to the intended one.

[Developer guide](https://www.ambiguous.ai/llms.txt) · [API schemas](https://app.ambiguous.ai/api/openapi.json) · [Task-only disposable sandbox](https://www.ambiguous.ai/sandbox.md) (separate credentials, no MCP)
