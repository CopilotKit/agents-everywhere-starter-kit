# Template 3: An agent you can text

**OpenAI Agents SDK + Auth0**, delivered through the Twilio WhatsApp Sandbox.

A separate, runnable app that links a WhatsApp sender to an authenticated person, uses their recent conversation, and asks for phone approval before saving a named request. This template uses OpenAI Agents SDK directly and has no CopilotKit dependency. CopilotKit powers the kit's [Slack](slack.md) and [web](web.md) templates.

[Step-by-step screenshot walkthrough](../dev-docs/template-walkthroughs/whatsapp/README.md) · [Verification evidence and live gaps](../dev-docs/template-validation.md)

## Start it

You need an OpenAI API key, a Twilio WhatsApp Sandbox joined from your phone, and an Auth0 tenant with **CIBA enabled and a Guardian device enrolled**. Check CIBA entitlement before choosing the phone demo; a default free tenant is insufficient for this flow.

From the repository root, with Node.js 22+:

```bash
npm ci --prefix apps/whatsapp
cp apps/whatsapp/.env.example apps/whatsapp/.env
npm run typecheck --prefix apps/whatsapp
npm test --prefix apps/whatsapp
```

Follow [the consolidated sponsor setup](../using-sponsor-tools.md#whatsapp-identity-and-phone-approval) for all account settings, environment variables, and webhook/callback URLs. This app uses its own `.env`, not the root Slack/web settings.

```bash
npm start --prefix apps/whatsapp
```

The app listens on port **3003**. WhatsApp ingress and the Auth0 callback need a public HTTPS origin; for local development, connect an HTTPS tunnel and configure its URL in the two dashboards. Keep one app process running.

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
Keep OpenAI Agents SDK for reasoning and Auth0 for identity and phone consent.
Preserve signed webhooks, sender-bound account linking, exact-action approval,
server-side permission checks, and duplicate protection. Replace the demo action
with our intended action and update the consent message to describe it fully.
Test denial, expiry, restart, and duplicate delivery before the live phone demo.
Do not apply the Channels skill or add CopilotKit to this independent template.
```

[Full app operation and limitations](../apps/whatsapp/README.md) · [Sponsor setup](../using-sponsor-tools.md#whatsapp-identity-and-phone-approval) · [Submission checklist](../SUBMISSION.md)

Offline HTTP integration tests cover the gate; live WhatsApp delivery and Guardian approval require your accounts and device. The app's JSON storage is for one process with a persistent disk, not replicas or a stateless host.
