<div align="center">

# Agents, Everywhere Hackathon Starter Kit

![Agents, Everywhere hackathon — OpenAI, CopilotKit, OpenRouter, Exa, Auth0, and Ambiguous AI](assets/banner.png)

**Build an agent that belongs where people already work, talk, and live.**

[Overview](#overview) · [Templates](#templates) · [Coding agent](#coding-agent) · [Resources](#resources)

</div>

[Screenshot walkthroughs: Slack, web, and WhatsApp](dev-docs/template-walkthroughs/README.md)

## Overview

Build for **[Agents, Everywhere: Bots, Channels, & More](https://sf.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon)**, the AI Tinkerers global hackathon on **September 12, 2026**. Put an agent inside a conversation, an app, a phone, or a physical environment. Make the context of that place essential to what it can do.

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
using-sponsor-tools.md. Help me choose one template in templates/ for my idea,
then build a new project using its infrastructure. Ask me who it is for and
what the agent should do in that setting. Read the selected template before
editing; for Slack also read .agents/skills/build-channels-agent/SKILL.md.
Use only the integrations the idea needs. Verify a complete interaction and
prepare SUBMISSION.md, distinguishing inherited code from our event work.
```

Your project and its core functionality must be created during the event. Existing libraries, templates, and starter code are allowed; describe what you reuse and what you build. See [the rules](hackathon-rules.md) and the [official portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) for the current deadline and judging criteria.

## Templates

Three starting points for different kinds of context. **CopilotKit Channels** brings the Slack agent into the conversation; **CopilotKit React** connects the web agent to the app people are using.

### 1. Slack — an agent that joins the thread

**OpenAI + CopilotKit Channels + Exa**

An agent reads what people already said, researches with Exa, and answers in the same thread with native cards and source links. Start with a support conversation, a research discussion, or a team decision.

The included Slack app supplies thread history, subscriptions, search, and Channels UI. Configure your model, Exa, and a managed Channel, then run `npm run dev:slack`. No public tunnel is needed.

**[Use the Slack template →](templates/slack.md)** · [Screenshot walkthrough](dev-docs/channels-sdk-walkthrough/README.md) · [Channels guide](https://copilotkit.ai/channels-guide.md)

### 2. Web — an agent inside your app

**OpenAI + CopilotKit React + Ambiguous AI**

An agent sees the page you are on and turns a request into a real workplace record you can still find after a refresh. Adapt it to customer follow-ups, a project workspace, or a personal planning app.

The included web app supplies page context, frontend tools, and agent-rendered UI. Connect an Ambiguous AI workspace for persistent records, then run `npm run dev:web`. The agent prepares a task for review; the page enforces approval before the Ambiguous write and retrieves saved records after refresh. The template explains setup, duplicate protection, and live verification.

**[Use the web template →](templates/web.md)** · [CopilotKit docs](https://docs.copilotkit.ai/) · [Ambiguous AI setup](using-sponsor-tools.md#ambiguous-ai)

### 3. WhatsApp — an agent you can text

**OpenAI Agents SDK + Auth0**

An agent recognizes a linked user and requests approval on their phone before executing a protected action. The included app saves an approved, named request and returns a receipt in the conversation. Adapt that action to your own assistant.

This is an independent app with its own install and configuration. It uses OpenAI Agents SDK directly, Auth0 for identity and approval, and a WhatsApp transport. No CopilotKit account is required for this template.

**[Use the WhatsApp template →](templates/whatsapp.md)**

### The demo you can build on

The supplied on-call assistant is an **infrastructure example**: read ambient context, call a tool, render useful UI, and return a verifiable result. **Branch out from the example app.** Choose a different user, problem, dataset, and interaction; the goal is your own project, not another version of the incident demo.

Use the [demo prompts](dev-docs/demo-prompts.md) to learn how the pieces connect, then replace the incident scenario. Approval cards in the Slack/web reference demo record decisions; they do not execute production actions or enforce authorization around every external tool.

Want another surface? The kit also includes [voice, MCP, mobile, and terminal starting points](dev-docs/surfaces.md). Four event surfaces are inspiration, not separate tracks or a requirement to build four apps.

## Coding agent

Give your agent these files before it starts coding:

| File                                                           | What it provides                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [hackathon-overview.md](hackathon-overview.md)                 | The challenge, four surfaces, and official judging criteria                                         |
| [hackathon-rules.md](hackathon-rules.md)                       | Build eligibility, inherited code, and required deliverables                                        |
| [using-sponsor-tools.md](using-sponsor-tools.md)               | Every sponsor featured in this kit: access, authentication, configuration, and a first working call |
| [AGENTS.md](AGENTS.md)                                         | Repository conventions and verification commands                                                    |
| [Channels skill](.agents/skills/build-channels-agent/SKILL.md) | Verified Channels APIs for the Slack template                                                       |

The [template guides](templates/) provide launch commands, files to customize, and a concrete result to check. Start with one template and add a second surface only if it helps your user.

## Resources

| Need                                 | Go here                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event details, deadline, and judging | [Official portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) · [Handbook](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM/handbook)                                                         |
| OpenAI credits and redemption        | [Credit instructions](CREDITS.md#openai-credits) · [API keys](https://platform.openai.com/api-keys)                                                                                                       |
| OpenAI agent development             | [Agents SDK quickstart](https://openai.github.io/openai-agents-js/guides/quickstart/)                                                                                                                     |
| OpenRouter access and model choice   | [Keys](https://openrouter.ai/keys) · [Model catalog](https://openrouter.ai/models) · [Model switching](dev-docs/model-switching.md)                                                                       |
| CopilotKit app development           | [Docs](https://docs.copilotkit.ai/) · [Tools and context](dev-docs/tools-and-context.md)                                                                                                                  |
| CopilotKit Channels                  | [Channels guide](https://copilotkit.ai/channels-guide.md) · [Screenshot walkthrough](dev-docs/channels-sdk-walkthrough/README.md) · [OpenTag example app](https://github.com/CopilotKit/OpenTag)          |
| Exa quickstart                       | [Search API guide](https://exa.ai/docs/reference/search-api-guide) · [Kit setup](using-sponsor-tools.md#exa)                                                                                              |
| Auth0 quickstarts                    | [Node API](https://auth0.com/docs/quickstart/backend/nodejs) · [Asynchronous authorization](https://auth0.com/ai/docs/get-started/asynchronous-authorization) · [Kit setup](using-sponsor-tools.md#auth0) |
| Ambiguous AI quickstart              | [Developer guide](https://www.ambiguous.ai/llms.txt) · [Kit setup](using-sponsor-tools.md#ambiguous-ai)                                                                                                   |
| Rehearse and debug                   | [Demo prompts](dev-docs/demo-prompts.md) · [Troubleshooting](dev-docs/troubleshooting.md)                                                                                                                 |
| Prepare your entry                   | [Submission checklist](SUBMISSION.md)                                                                                                                                                                     |

For the Slack/web workspaces, `npm run verify` runs typechecks, tests, and MCP checks without credentials. `npm run check-env` validates configured startup. WhatsApp has separate checks in its template. Live sponsor calls and platform delivery require your accounts. See [developer docs](dev-docs/README.md) for detailed setup and deployment.
