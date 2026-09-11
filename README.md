<div align="center">

# Agents, Everywhere Hackathon Starter Kit

![Agents, Everywhere hackathon — OpenAI, CopilotKit, OpenRouter, Exa, Auth0, and Ambiguous AI](assets/banner.png)

**Build an agent that belongs where people already work, talk, and live.**

[Overview](#overview) · [Templates](#templates) · [Coding agent](#coding-agent) · [Resources](#resources)

</div>

## Overview

Build for **[Agents, Everywhere: Bots, Channels, & More](https://sf.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon)**, the AI Tinkerers global hackathon on **September 12, 2026**. Put an agent inside a conversation, an app, a phone, or a physical environment. Make the context of that place essential to what it can do.

**Main communication channel:** Use the [hackathon Discord channel](https://discord.com/channels/1122926057641742418/1548038338848489532) for announcements, questions, and team coordination.

This kit gives you **templates to start from, files to hand to your coding agent, and sponsor resources** to connect the pieces. Pick a user, a problem, and one complete interaction. You can use any stack; you do not need every sponsor or every surface.

**Start with your coding agent.** Clone the kit with Node.js 22+ installed:

```bash
git clone https://github.com/CopilotKit/agents-everywhere-starter-kit.git
cd agents-everywhere-starter-kit
npm ci
cp .env.example .env
```

Then paste this into your coding agent:

```text
Read AGENTS.md, hackathon-overview.md, hackathon-rules.md, and
using-sponsor-tools.md. Help me choose one template app README for my idea,
then build a new project using its infrastructure. Ask me who it is for and
what the agent should do in that setting. Read the selected template before
editing; for Slack also read .agents/skills/build-channels-agent/SKILL.md.
Use only the integrations the idea needs. Verify a complete interaction and
prepare SUBMISSION.md, distinguishing inherited code from our event work.
```

Your project and its core functionality must be created during the event. Existing libraries, templates, and starter code are allowed; describe what you reuse and what you build. See [the rules](hackathon-rules.md) and the [official portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) for the current deadline and judging criteria.

## Templates

These starting points serve different kinds of context. **CopilotKit Channels** brings the Slack agent into the conversation; **CopilotKit React** connects the web agent to the app people are using; **CopilotKit React Native** brings the same agent pattern onto a phone.

### 1. Slack — an agent that joins the thread

**OpenAI + CopilotKit Channels + Exa**

An agent reads what people already said, researches with Exa, and answers in the same thread with native cards and source links. Start with a support conversation, a research discussion, or a team decision.

The included Slack app supplies thread history, subscriptions, search, and Channels UI. Configure your model, Exa, and a managed Channel, then run `npm run dev:slack`. No public tunnel is needed.

**[Use the Slack template →](apps/channel/README.md)** · [Screenshot walkthrough](dev-docs/channels-sdk-walkthrough/README.md) · [Channels guide](https://copilotkit.ai/channels-guide.md)

### 2. Web — an agent inside your app

**OpenAI + CopilotKit React + Ambiguous AI**

An agent sees the page you are on and turns a request into a real workplace record you can still find after a refresh. Adapt it to customer follow-ups, a project workspace, or a personal planning app.

The included web app supplies page context, frontend tools, agent-rendered UI, and a browser approval step. Connect an Ambiguous AI workspace, then run `npm run dev:web`; approved follow-ups are saved through the server and can be read back after refresh.

**[Use the web template →](apps/web/README.md)** · [CopilotKit docs](https://docs.copilotkit.ai/) · [Ambiguous AI setup](using-sponsor-tools.md#ambiguous-ai)

### 3. React Native — an agent in your pocket

**OpenAI or OpenRouter + CopilotKit React Native**

A mobile agent reads app state, renders native cards, and waits for a tap before changing local sample data. Start with a personal finance assistant, a field checklist, an inventory counter, or any workflow where phone context and approval matter.

The included Expo app supplies seeded finance state, native rendered tool UI, a human-in-the-loop expense approval, and a mobile-specific CopilotKit runtime endpoint served by the web app. Configure your model provider, start `npm run dev:web`, then run the mobile app from `apps/mobile`.

**[Use the React Native template →](apps/mobile/README.md)**

### The demo you can build on

The supplied on-call assistant is an **infrastructure example**: read ambient context, call a tool, render useful UI, and return a verifiable result. **Branch out from the example app.** Choose a different user, problem, dataset, and interaction; the goal is your own project, not another version of the incident demo.

Use the [demo prompts](dev-docs/demo-prompts.md) to learn how the pieces connect, then replace the incident scenario. Approval cards in the Slack/web reference demo record decisions; they do not execute production actions or enforce authorization around every external tool.

Want another surface pattern? The web app also includes a voice route, and the shared agent can connect to remote MCP tools when configured. The event surfaces are inspiration, not separate tracks or a requirement to build multiple apps.

## Coding agent

Give your agent these files before it starts coding:

| File | What it provides |
|---|---|
| [hackathon-overview.md](hackathon-overview.md) | The challenge, four surfaces, and official judging criteria |
| [hackathon-rules.md](hackathon-rules.md) | Build eligibility, inherited code, and required deliverables |
| [using-sponsor-tools.md](using-sponsor-tools.md) | Every sponsor featured in this kit: access, authentication, configuration, and a first working call |
| [AGENTS.md](AGENTS.md) | Repository conventions and verification commands |
| [Channels skill](.agents/skills/build-channels-agent/SKILL.md) | Verified Channels APIs for the Slack template |

The app READMEs provide launch commands, files to customize, and a concrete result to check. Start with one template and add a second surface only if it helps your user.

## Resources

| Need | Go here |
|---|---|
| Event details, deadline, and judging | [Official portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) · [Handbook](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM/handbook) |
| OpenAI credits and redemption | [Credit instructions](CREDITS.md#openai-credits) · [API keys](https://platform.openai.com/api-keys) |
| OpenAI agent development | [Agents SDK quickstart](https://openai.github.io/openai-agents-js/guides/quickstart/) |
| OpenRouter access and model choice | [Keys](https://openrouter.ai/keys) · [Model catalog](https://openrouter.ai/models) · [Model switching](dev-docs/model-switching.md) |
| CopilotKit app development | [Docs](https://docs.copilotkit.ai/) · [Tools and context](dev-docs/tools-and-context.md) |
| CopilotKit Channels | [Channels guide](https://copilotkit.ai/channels-guide.md) · [Screenshot walkthrough](dev-docs/channels-sdk-walkthrough/README.md) · [OpenTag example app](https://github.com/CopilotKit/OpenTag) |
| Exa quickstart | [Search API guide](https://exa.ai/docs/reference/search-api-guide) · [Kit setup](using-sponsor-tools.md#exa) |
| Auth0 API authorization | [Node API](https://auth0.com/docs/quickstart/backend/nodejs) · [Kit setup](using-sponsor-tools.md#auth0) |
| Ambiguous AI quickstart | [Developer guide](https://www.ambiguous.ai/llms.txt) · [Kit setup](using-sponsor-tools.md#ambiguous-ai) |
| Rehearse and debug | [Demo prompts](dev-docs/demo-prompts.md) · [Troubleshooting](dev-docs/troubleshooting.md) |
| Prepare your entry | [Submission checklist](SUBMISSION.md) |

For the Slack/web workspaces, `npm run verify` runs typechecks and offline tests without credentials. The mobile app has its own install, tests, typecheck, and Metro export checks under `apps/mobile`. `npm run check-env` validates configured startup. Live sponsor calls and platform delivery require your accounts. See [developer docs](dev-docs/README.md) for detailed setup and deployment.
