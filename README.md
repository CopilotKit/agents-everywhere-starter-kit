<div align="center">

# Agents, Everywhere — Starter Kit

![Agents, everywhere — build an agent that belongs where people already work](assets/banner.png)

Build an agent that belongs where people already work, talk, and live.

[Channels SDK](#build-with-the-copilotkit-channels-sdk) · [Quickstart](#run-it-locally) · [Choose a surface](#choose-a-surface) · [Sponsor recipes](dev-docs/sponsors.md) · [Demo](dev-docs/demo-prompts.md) · [Submission](SUBMISSION.md)

</div>

Built for **[Agents, Everywhere: Bots, Channels, & More](https://sf.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon)**, the AI Tinkerers global hackathon on **September 12, 2026**. Start with a working example, connect the sponsor tools your idea needs, and make the surrounding context useful. You do not need every sponsor or every surface. See the [official portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) for deadlines and judging, and the [handbook](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM/handbook) for eligibility.

**Build eligibility:** This kit and its incident demo are reusable starting points. Your submitted project and its core functionality must be built during the official hackathon period. A pre-existing project cannot be resubmitted or extended and entered as a new project. Explain what you inherited and what you built during the event in [your submission](SUBMISSION.md#build-eligibility).

## Build with the CopilotKit Channels SDK

**[CopilotKit Channels SDK](https://copilotkit.ai/channels-guide.md) (`@copilotkit/channels`) powers this kit’s conversation-native agent.** Bring your agent into a working thread, give it the surrounding context, and let it respond with native cards, tools, and interactive decisions.

- **Connect the agent:** `createChannel` brings together your agent, tools, components, and context in [channel.tsx](apps/channel-slack/src/channel.tsx).
- **Use the conversation:** Read thread history and follow subscribed conversations so users can ask about work already happening around them.
- **Render native UI:** Define incident cards, timelines, and approval buttons with Channels JSX, alongside the tools that drive the workflow.

Start with the included **Slack** example. The SDK also provides a **Teams** adapter path; Teams needs its own setup and validation. CopilotKit Intelligence manages the connection, so the listener needs no public tunnel.

**[Set up your first Channel](dev-docs/setup.md)** · [Channels SDK guide](https://copilotkit.ai/channels-guide.md) · [Build tools and native UI](dev-docs/tools-and-context.md)

## The demo you can build on

An on-call assistant reads an existing incident thread, researches public sources, and presents a native incident card. Add an Ambiguous AI workspace to create a real follow-up and return its record link to the thread. Or use Trigger.dev to queue approved research and retrieve its sources in that same conversation.

Prefer a browser demo? The included incident workspace gives the agent the selected incident and timeline. Ask it to switch incidents or add a follow-up, then watch the page change. These are sample incidents and session-only tasks; refreshing resets them.

Follow the exact prompts and result checks in [the demo walkthrough](dev-docs/demo-prompts.md). Approval cards alone do not execute a restart or create a task.

## Run it locally

Requires **Node.js 22+** (`nvm use`) and one model-provider account.

```bash
git clone https://github.com/CopilotKit/agents-everywhere-starter-kit.git
cd agents-everywhere-starter-kit
npm install
cp .env.example .env
```

Edit `.env` with **one** of these choices:

| | OpenAI | OpenRouter |
|---|---|---|
| `MODEL_PROVIDER` | `openai` | `openrouter` |
| Credential | `OPENAI_API_KEY` | `OPENROUTER_API_KEY` |
| `MODEL` | `gpt-5.6-sol` | `openai/gpt-5.6-sol` or an available publisher/model slug |
| Get access | [API keys](https://platform.openai.com/api-keys) | [API keys](https://openrouter.ai/keys) · [model catalog](https://openrouter.ai/models) |

Replace the selected provider's placeholder with your key. OpenRouter chat needs no OpenAI key. Explicit selection takes precedence over other saved keys; see [model switching](dev-docs/model-switching.md).

```bash
npm run dev
```

With no Channel configured, this starts terminal chat. Try: “Here is an incident: checkout timeouts began after a deploy, rollback did not help, payment queue depth is rising. What should we investigate?” Terminal chat exercises the model and prompt; it has no Slack history or native cards.

To open the incident workspace instead:

```bash
npm run dev:web
```

Open the localhost URL printed by Next.js. For Slack, run `npm run channel:setup`, configure `CHANNEL_CODE` and `INTELLIGENCE_API_KEY`, then run `npm run dev` and mention the invited bot. The managed listener needs no public tunnel. [Full setup](dev-docs/setup.md)

## Choose a surface

| Where your idea belongs | Start with | What the example supplies |
|---|---|---|
| Team conversations | `apps/channel-slack` · **Channels SDK** | Thread history, incident cards, approvals, optional search and durable research |
| An application | `apps/web` | Incident context, timeline, visible local actions, native cards |
| A quick prompt experiment | `apps/local-chat` | Terminal conversation with your chosen chat provider |
| A spoken conversation | `apps/web` at `/voice` | Separate OpenAI Realtime agent; requires an OpenAI key and microphone |
| An MCP client | `apps/mcp` | Tools and a UI resource; the host supplies the model |
| A mobile application | `apps/mobile` | Separate Expo scaffold; not device-verified |

Capabilities differ by surface. Read [the capability matrix and launch commands](dev-docs/surfaces.md) before choosing a second one. Teams uses the Channels adapter path and requires its own setup and validation.

## Choose the sponsors your demo needs

Each [sponsor recipe](dev-docs/sponsors.md) includes access, configuration, commands, expected output, and a file to customize.

| Sponsor | A useful first result | Recipe |
|---|---|---|
| OpenAI | Reason about supplied incident context | [Chat provider](dev-docs/sponsors.md#openai) |
| CopilotKit | Use **Channels SDK** for thread context and native UI, or CopilotKit for the web workspace | [Channels SDK](#build-with-the-copilotkit-channels-sdk) · [Recipe](dev-docs/sponsors.md#copilotkit) |
| OpenRouter | Run the same scenario with your selected model | [Model choice](dev-docs/sponsors.md#openrouter) |
| Exa | Research with visible source links | [Grounded search](dev-docs/sponsors.md#exa) |
| Trigger.dev | Approve research, keep chatting, retrieve the result | [Durable research](dev-docs/sponsors.md#triggerdev) |
| Auth0 | Deny an unauthenticated action, authorize a service, create a local record | [Runnable M2M example](examples/auth0/README.md) |
| Mozilla.ai | Run an incident tool and save an inspectable agent trace | [Runnable Python example](examples/mozilla/README.md) |
| Ambiguous AI | Create a real workspace follow-up and return its link | [Workplace actions](dev-docs/sponsors.md#ambiguous-ai) |
| Google Cloud Run | Host your configured listener beyond your laptop | [Deployment configuration](dev-docs/sponsors.md#google-cloud-run) |

Auth0 and Mozilla are independent examples. Auth0 demonstrates machine authorization; the separate CIBA consent extension is still unimplemented. Live sponsor calls require your own accounts and are not proven by offline checks. Record organizer-provided offers in [CREDITS.md](CREDITS.md).

## The Context Ladder

Use this **starter-kit design exercise** to sharpen your demo. The [published rubric](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) scores Core Requirements & Functionality, Innovation & Theme Alignment, Technical Execution & Integration, and Usefulness & Agentic Experience from 1–5 each. The ladder supplements that rubric; use the [criterion-by-criterion demo checklist](SUBMISSION.md#evidence-for-the-judging-criteria) to prepare evidence.

| Level | The agent… | Try this |
|---|---|---|
| Reachable | Answers where people already are | Mention it in the chosen surface |
| Situated | Uses surrounding context | Ask about the incident without pasting it into the prompt |
| Native | Renders and acts in the surface's own idioms | Show a card and a visible follow-up or returned research result |

Remove the surrounding context and compare the response. Explain what the agent can do because it belongs there, then demonstrate one complete interaction.

## Verify and customize

```bash
npm run verify
npm run check-env
```

`verify` runs workspace typechecks, tests, and MCP protocol checks without `.env` or live credentials. `check-env` separately validates configured startup; it does not authenticate with sponsors. Optional recipe checks are documented beside their examples. Live Slack delivery, sponsor access, voice, and mobile hardware need separate validation.

Start editing here:

- [Shared agent](packages/agent-core/src/agent.ts) and [prompt](packages/agent-core/src/prompt.ts)
- [Slack tools](apps/channel-slack/src/tools.tsx) and [native cards](apps/channel-slack/src/components.tsx)
- [Incident workspace](apps/web/src/app/page.tsx) and [frontend actions](apps/web/src/components/app-control.tsx)
- [Sponsor recipes](dev-docs/sponsors.md) and [developer docs](dev-docs/README.md)

The repository includes Channels coding guidance in [.agents/skills](.agents/skills/) and conventions in [AGENTS.md](AGENTS.md). Keep secrets server-side and out of your submission.
