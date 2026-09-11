# Template 1: Slack thread agent

**OpenAI + CopilotKit Channels + Exa**

Model choice: OpenAI directly or **OpenRouter**.

Build an agent that reads an existing conversation, researches what matters, and replies with native cards and source links. Try a team research discussion, support handoff, or project decision. The included incident scenario shows how the infrastructure fits together; replace it with your own workflow.

[Step-by-step screenshot walkthrough](../dev-docs/template-walkthroughs/slack/README.md) · [Verification evidence and live gaps](../dev-docs/template-validation.md)

## Start it

Complete the homepage's clone/install steps, then configure root `.env` using [OpenAI](../using-sponsor-tools.md#openai), [CopilotKit](../using-sponsor-tools.md#copilotkit), and [Exa](../using-sponsor-tools.md#exa):

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
CHANNEL_CODE=your-channel-code
INTELLIGENCE_API_KEY=your-project-key
EXA_API_KEY=your-key
EXA_SEARCH_TYPE=fast
```

Choose an OpenAI model available to your account. Create the managed Channel using `npm run channel:setup`; the [setup guide](../dev-docs/setup.md) and [screenshot walkthrough](../dev-docs/channels-sdk-walkthrough/README.md) cover the platform installation.

To use **OpenRouter**, replace the three model settings above in root `.env` with:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-key
MODEL=openai/gpt-4.1-mini
```

Keep the Channel, Intelligence, and Exa settings. Choose a [catalog model](https://openrouter.ai/models) with tool calling so it can read the thread and use Exa. This chat path only needs the selected provider's key. See [model switching](../dev-docs/model-switching.md) for defaults and other model slugs.

```bash
npm run check-env
npm run dev:slack
```

Invite the bot to a Slack channel and mention it in a populated thread. CopilotKit Intelligence manages the connection; this listener needs no public tunnel.

## What is included

| Piece                       | Implementation                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Agent and model             | [Shared agent factory](../packages/agent-core/src/agent.ts), using CopilotKit's built-in agent with OpenAI |
| Conversation                | [Channel](../apps/channel-slack/src/channel.tsx): mention, subscribe, respond to subscribed messages       |
| Thread context and research | [Tools](../apps/channel-slack/src/tools.tsx): `read_thread` and Exa-backed `search_web`                    |
| Native cards                | [Components](../apps/channel-slack/src/components.tsx): incident card and timeline via Channels JSX        |
| Prompt                      | [Shared prompt](../packages/agent-core/src/prompt.ts)                                                      |

This template uses CopilotKit's built-in agent with the selected model provider. The [WhatsApp template](whatsapp.md) demonstrates OpenAI Agents SDK directly. Both support [OpenRouter](../using-sponsor-tools.md#openrouter).

## Prove the interaction

1. Add two or three facts to a Slack thread before mentioning the agent.
2. Ask it to catch up using the thread and render a card. Verify facts came from earlier messages rather than your last prompt.
3. Ask it to research a related question with Exa. Open the returned sources and distinguish published evidence from facts in your thread.
4. Ask a follow-up that relies on the discussion. Check the answer and card remain in the same thread.

Use [demo prompts](../dev-docs/demo-prompts.md#slack-context-sources-card-follow-up) for exact incident inputs. If you add an external write, enforce the relevant approval in code before that write. The included proposal card records a decision without executing a production action.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, and AGENTS.md.
Read .agents/skills/build-channels-agent/SKILL.md before changing Slack code.
Adapt apps/channel-slack to our project's user and conversation. Preserve
read_thread, use Exa when research helps, and render results with Channels JSX.
Replace incident-specific schemas, tools, and prompts with our own workflow.
Demonstrate that earlier messages change the answer and return source links.
Run npm run verify and document the live Slack checks separately.
```

Keep the pinned Channels/runtime pair and the `@ag-ui/client` override. The [Channels skill](../.agents/skills/build-channels-agent/SKILL.md) supplies the verified API vocabulary. [Channels guide](https://copilotkit.ai/channels-guide.md) · [OpenTag reference app](https://github.com/CopilotKit/OpenTag)
