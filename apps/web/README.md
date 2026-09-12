# An agent inside your web app

**OpenAI + CopilotKit React + Ambiguous AI**

Build an agent that sees the selected record or page, helps the user act on it, and creates a workplace record that remains after a refresh. Try a customer workspace, project review page, or personal planning app. Replace the sample incident domain with your own project.

[![Web app agent demo](../../assets/demos/web.gif)](../../assets/demos/web.mp4)

_Ask for a follow-up, approve it, and reload to find the saved task in Ambiguous. Preview at 3× speed; click for the full MP4._

## Get started

Use Node.js 22+, then clone and install the kit:

```bash
git clone https://github.com/CopilotKit/agents-everywhere-starter-kit.git
cd agents-everywhere-starter-kit
npm ci
cp .env.example .env
```

Run the commands below from the repository root. Configure root `.env` with [OpenAI](../../using-sponsor-tools.md#openai) and [Ambiguous AI](../../using-sponsor-tools.md#ambiguous-ai):

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
AMBIGUOUS_API_KEY=your-workspace-key
```

## Acordate: Telegram channel

The hackathon project uses Telegram as its conversation surface. Persona 1 owns
`POST /api/telegram/webhook`: it validates Telegram's optional secret header,
maps `message.from.id` to the stable application `userId`, calls the agent
contract, and replies to `message.chat.id`. Non-text updates are acknowledged
without running the agent.

Add these root `.env` values before connecting the bot:

```dotenv
TELEGRAM_BOT_TOKEN=token-from-botfather
TELEGRAM_WEBHOOK_SECRET=a-long-random-value
```

For a safe local webhook check, set `TELEGRAM_DRY_RUN=true`; the endpoint will
process the update and log the outgoing reply without contacting Telegram.

Deploy first, then configure Telegram with the public HTTPS URL:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook&secret_token=<WEBHOOK_SECRET>
```

The initial adapter in `src/lib/telegram/agent.ts` is deliberately a mock.
Persona 2 replaces it with the AI/tool implementation while preserving
`({ userId, message }) => Promise<{ text }>`. `sendTelegramMessage` in
`src/lib/telegram/client.ts` is also the integration point for the scheduler.

Choose an OpenAI model your account can use. Use a demo workspace you control for the first write. This web template needs no managed Channel or Intelligence account.

For CopilotKit onboarding, use the [official prompt](../../README.md#onboarding-prompt).

To use OpenRouter, follow the [shared provider settings](../../using-sponsor-tools.md#openrouter): set `MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and a `MODEL` slug with tool support. Keep the Ambiguous workspace key; an OpenAI key is not required for OpenRouter chat.

```bash
npm run dev:web
```

Open `http://127.0.0.1:3100` or `http://localhost:3100` and select an incident. The dev and start scripts bind the credential-backed approval server to loopback by default; keep that boundary unless you add your own authentication and trusted-origin policy.

## Try the flow

1. Ask: “What's happening here?” Check the answer against the incident currently selected.
2. Ask: “Create a follow-up for this incident.”
3. Review the page proposal. Click **Approve & save to Ambiguous** only if the fields are correct. The app should return the actual record ID and any provider link.
4. Refresh the browser. Ask the agent to retrieve the saved task by its ID from Ambiguous, or click **Refresh from Ambiguous**. Check the same record returns without creating a duplicate.
5. Repeat with **Decline** and confirm no task is created.

The result should be a retrievable Ambiguous record with the same ID after refresh. An assistant message saying it saved something is not sufficient.

## Customize these files

| Piece | File |
| --- | --- |
| App and selected record | [src/app/page.tsx](src/app/page.tsx) and [src/lib/incidents.ts](src/lib/incidents.ts) |
| Context and frontend tools | [src/components/app-control.tsx](src/components/app-control.tsx): `useAgentContext`, `select_incident`, `propose_followup`, `retrieve_followup`, and `refresh_followups` |
| Approval UI and provider reads | [src/components/workplace-followups.tsx](src/components/workplace-followups.tsx) and [src/lib/use-workplace.ts](src/lib/use-workplace.ts) |
| Server approval boundary | [src/app/api/followups/route.ts](src/app/api/followups/route.ts) and [src/lib/server/followups.ts](src/lib/server/followups.ts) |
| Ambiguous MCP adapter | [src/lib/server/workplace.ts](src/lib/server/workplace.ts), reads workspace context and saves approved tasks |
| CopilotKit React UI | [src/components/generative-ui.tsx](src/components/generative-ui.tsx) and [src/components/providers.tsx](src/components/providers.tsx) |
| Agent endpoint | [src/app/api/copilotkit/[[...path]]/route.ts](src/app/api/copilotkit/[[...path]]/route.ts), configured without raw workplace write tools |

The web chat does not receive raw Ambiguous write tools. It can propose a task and read or refresh existing records through frontend tools; the server writes only after the user clicks **Approve & save to Ambiguous**. Tool schemas come from the MCP server at write time, and returned links must come from Ambiguous rather than being invented.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, and AGENTS.md.
Adapt apps/web to our user and workflow. Keep CopilotKit React for page context,
frontend tools, agent-rendered UI, and page approval. Use Ambiguous AI for
persistent records. Do not expose raw write tools to the web chat when the page
approval path is required. Return the real record ID/link and verify read-back
after refresh. Keep credentials server-side and enforce authorization at the
write boundary. Run npm run verify and npm run build --workspace web, then
document the live record create/read/decline checks.
```

## Verify and limits

Run `npm run verify` and `npm run build --workspace web` for local checks. Then try the create/read/decline flow with your own workspace. Offline tests cover the approval boundary and error handling; they do not make live provider calls.

[CopilotKit docs](https://docs.copilotkit.ai/) · [Sponsor authentication and first calls](../../using-sponsor-tools.md) · [Demo prompts](../../dev-docs/demo-prompts.md)
