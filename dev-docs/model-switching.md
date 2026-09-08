# Switching models

## Change the model

```dotenv
MODEL=gpt-5.6-sol
```

| Model | Note |
|---|---|
| `gpt-5.6-sol` | the kit default · flagship · $5.00/$30.00 per MTok |
| `gpt-6-astra` | most capable — built for the hardest end-to-end work |
| `gpt-5.6-terra` | balances capability with cost |
| `gpt-5.6-luna` | cheapest · $0.20/$1.20 per MTok |

**On cost:** the default is a flagship model, which is the right call for an agent
that has to read a thread, pick a tool, and render a card in one turn. If you are
running on hackathon credits and watching them drain, `gpt-5.6-luna` is roughly
25x cheaper per token and holds up fine for chat-shaped work — it is a one-line
change and nothing else in the kit cares.

The runtime's resolver normalises `/` and `:`, so `openai/gpt-5.6-luna` and
`openai:gpt-5.6-luna` are the same thing. A bare name gets `openai:` prefixed.

## Change the provider

Name it explicitly and the kit passes it through:

```dotenv
MODEL=anthropic/claude-sonnet-4-6     # needs ANTHROPIC_API_KEY
MODEL=google/gemini-2.5-flash         # needs GOOGLE_API_KEY
```

## Fail over to OpenRouter mid-demo

This is the one to remember. If OpenAI rate-limits you at 14:00 with a demo at
15:30, add one line:

```dotenv
OPENROUTER_API_KEY=sk-or-...
```

`packages/agent-core/src/model.ts` detects it and routes everything through
OpenRouter's OpenAI-compatible endpoint, with cost-optimized routing and provider
fallbacks behind it. `MODEL` is turned into an OpenRouter slug (`gpt-5.6-sol` →
`openai/gpt-5.6-sol`); set a full slug yourself to pick a different vendor:

```dotenv
MODEL=anthropic/claude-sonnet-4-6
```

Attribution headers (`HTTP-Referer`, `X-OpenRouter-Title`) are sent so your build
shows up on OpenRouter's public rankings. Override with `PUBLIC_APP_URL` and
`APP_TITLE`.

> Why a `LanguageModel` instance rather than a model string: the runtime's string
> resolver reads everything before the first separator as the provider name,
> which would eat the `openai/` half of an OpenRouter slug.

## Swap the whole agent

`packages/agent-core/src/agent.ts` returns CopilotKit's `BuiltInAgent`. To use
LangGraph, CrewAI, Mastra, Pydantic AI, or Google ADK instead, return an
`HttpAgent` pointed at your agent's AG-UI endpoint:

```ts
import { HttpAgent } from "@ag-ui/client";
export function makeAgent(threadId: string) {
  return new HttpAgent({ url: process.env.AGENT_URL! });
}
```

Nothing else in the kit changes. That is what AG-UI is for.
