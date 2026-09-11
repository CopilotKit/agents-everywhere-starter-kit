# Template 3: An agent you can text

**OpenAI Agents SDK + CopilotKit Channels + Auth0**, delivered directly through Meta’s WhatsApp Cloud API.

Model choice: OpenAI directly or **OpenRouter**, both through OpenAI Agents SDK.

A separate, runnable app that links a WhatsApp sender to an authenticated person, uses their recent conversation, and asks for phone approval before saving a named request. CopilotKit Channels receives and renders WhatsApp messages through its direct Meta adapter. OpenAI Agents SDK proposes the action; Auth0 verifies the user's identity and consent.

[Step-by-step screenshot walkthrough](../dev-docs/template-walkthroughs/whatsapp/README.md) · [Verification evidence and live gaps](../dev-docs/template-validation.md)

## Start it

You need an OpenAI or OpenRouter API key, a CopilotKit Intelligence key, a Meta app with WhatsApp API access and a verified test recipient, and an Auth0 tenant with **CIBA enabled and a Guardian device enrolled**. Check CIBA availability in your tenant before choosing the phone demo; the trial configuration used in this guide does not establish ongoing free access.

From the repository root, with Node.js 22+:

```bash
npm ci --prefix apps/whatsapp
cp apps/whatsapp/.env.example apps/whatsapp/.env
npm run typecheck --prefix apps/whatsapp
npm test --prefix apps/whatsapp
```

Follow [the consolidated sponsor setup](../using-sponsor-tools.md#whatsapp-identity-and-phone-approval) for all account settings, environment variables, and webhook/callback URLs. This app uses its own `.env`, not the root Slack/web settings.

Choose one model configuration in `apps/whatsapp/.env`. For **OpenAI**:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
MODEL=gpt-4.1-mini
```

Or for **OpenRouter**:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-key
MODEL=openai/gpt-4.1-mini
```

Only the selected model provider's key is required. Keep the Meta, Intelligence, and Auth0 settings in the same file. Choose an OpenRouter model/provider endpoint that supports [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs); the app requires that support and validates the proposal before requesting approval. Changing the model keeps the Auth0 approval gate. See [model switching](../dev-docs/model-switching.md) for defaults and the legacy `OPENAI_MODEL` setting.

```bash
npm start --prefix apps/whatsapp
```

The app listens on port **3003**. WhatsApp ingress and the Auth0 callback need a public HTTPS origin; for local development, connect an HTTPS tunnel and configure its URL in the two dashboards. Keep one app process running and keep the SDK listener on port **3004** private.

## What is included

| Piece                                        | Implementation                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Agent conversation and proposed action       | [OpenAI Agents SDK agent](../apps/whatsapp/src/agent.ts)                                             |
| Signed WhatsApp messages and account linking | [HTTP app and worker](../apps/whatsapp/src/service.ts)                                               |
| Authenticated identity and phone consent     | [Auth0 authorization code and CIBA flow](../apps/whatsapp/src/auth0.ts)                              |
| Persistent requests and approval state       | [Atomic local store](../apps/whatsapp/src/store.ts)                                                  |
| Startup and configuration                    | [Entrypoint](../apps/whatsapp/src/index.ts) and [environment example](../apps/whatsapp/.env.example) |

The model proposes a short request label. It cannot execute the protected write. The server waits for the linked user's approval of that exact action and verifies the resulting Auth0 permission before saving it.

## Prove the interaction

1. Text `hello`, open the returned sign-in link, and select **Continue with Auth0**.
2. Sign in, then send the displayed `LINK <code>` in the original WhatsApp conversation. Confirm the bot recognizes your display name.
3. Text `Save a request called team-lunch`. Check the exact label and request ID in the WhatsApp reply and Guardian prompt.
4. Approve on your phone. Verify the saved receipt in WhatsApp and the record in the app's local store.
5. Restart the app and text `STATUS`. Confirm the same request remains saved.
6. After one minute, request a different label and deny it. Let another request expire. Neither should create a record.

The demo saves a local request with a label of 1–24 ASCII letters, digits, hyphens, or underscores. It does not schedule reminders or write to a real booking service. Your own project can replace the action while preserving the enforced approval boundary.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, and AGENTS.md, then
apps/whatsapp/README.md. Adapt the WhatsApp app to our own user and task.
Use CopilotKit Channels with its direct Meta adapter for WhatsApp delivery.
Keep OpenAI Agents SDK for reasoning and Auth0 for identity and phone consent.
Preserve signed webhooks, sender-bound account linking, exact-action approval,
server-side permission checks, and duplicate protection. Replace the demo action
with our intended action and update the consent message to describe it fully.
Test denial, expiry, restart, and duplicate delivery before the live phone demo.
Follow this app’s direct adapter setup; the bundled Channels skill is for Slack.
```

[Full app operation and limitations](../apps/whatsapp/README.md) · [Sponsor setup](../using-sponsor-tools.md#whatsapp-identity-and-phone-approval) · [Submission checklist](../SUBMISSION.md)

Offline HTTP integration tests cover the gate; live WhatsApp delivery and Guardian approval require your accounts and device. The app's JSON storage is for one process with a persistent disk, not replicas or a stateless host.
