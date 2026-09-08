# OpenAI — marquee sponsor

Four distinct OpenAI surfaces map onto the four hackathon contexts. Picking the right one per template is most of the kit's value.

## Model catalog (verified against [developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models), 2026-09-08)

| Family | IDs | Notes |
|---|---|---|
| GPT-6 | `gpt-6-astra` | Most capable; hardest end-to-end work |
| GPT-5.6 | `gpt-5.6-sol` (alias `gpt-5.6`), `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.6-cyber` | Luna is the cheapest at **$0.20 / $1.20** per MTok; 1.05M context on the family |
| GPT-5.5 | `gpt-5.5` | Previous flagship, $5.00 / $30.00 |
| GPT-5.4 | `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.4-pro` | Mini is $0.38 / $2.25 |
| Realtime | `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `gpt-realtime-2`, `gpt-realtime-1.5`, `gpt-realtime-translate` | 2.1 = reasoning + tools; 1.5 = best pure audio-in/audio-out |
| Speech | `gpt-transcribe`, `gpt-live-transcribe`, `gpt-realtime-whisper`, `gpt-4o-mini-tts` | |
| Image | `gpt-image-2` | |

**Kit recommendation:** default to **`gpt-5.4-mini`** for chat. It is the house default across these projects, it is what the Channels SDK README ships, and it is proven with `BuiltInAgent`'s `openai:` prefix. Document `gpt-5.6-luna` as the cheaper swap and `gpt-5.6-sol` as the smarter one — one-line changes.

Pricing has four tiers (Batch, Flex, Standard, Priority); Batch halves every rate, Fast doubles. Cached input bills at 10% on GPT-6 / 5.6 / 5.5 / 5.4.

## 1. Agents SDK — the agent brain

`npm install @openai/agents` (**0.17.1**, published 2026-09-08 — actively moving) / Python equivalent.

Primitives: **Agent**, **Runner** (`run()`), **tools** (function, MCP, built-in code interpreter + file search), **handoffs**, **guardrails**, **sessions**. Plus realtime/voice agents over WebSocket + WebRTC, MCP servers (stdio/SSE/HTTP), human-in-the-loop approvals, and span-based tracing.

Docs: [openai.github.io/openai-agents-js](https://openai.github.io/openai-agents-js/) · [developers.openai.com/api/docs/guides/agents](https://developers.openai.com/api/docs/guides/agents)

> Caution: the auto-summarized JS docs handed back a `model: "gpt-4"` example. Treat any model string in scraped docs as stale — use the catalog above.

## 2. Realtime API — the *In the room* surface

Models: `gpt-realtime-2.1` (low-latency voice agents with reasoning), `gpt-realtime-translate`, `gpt-live-transcribe`.

Three transports, and the choice is not stylistic:
- **WebRTC** — browser/mobile clients capturing or playing audio directly
- **WebSocket** — your server receives audio from a media pipeline or call system
- **SIP** — telephony voice agents

Three session types: voice-agent (`/v1/realtime`), translation (`/v1/realtime/translations`), transcription.

Key details for the kit: mint **ephemeral credentials** via `POST /v1/realtime/client_secrets` for browser/mobile — never ship the API key. Configure audio under `session.audio.output`. Start with `reasoning.effort: low` and raise it only if quality demands. Send `OpenAI-Safety-Identifier` with a hashed user id.

Docs: [developers.openai.com/api/docs/guides/realtime](https://developers.openai.com/api/docs/guides/realtime)

## 3. Plugins (formerly "Apps SDK") — the ChatGPT surface

**Naming has moved.** The developer docs now say **Plugins** at [developers.openai.com/plugins](https://developers.openai.com/plugins/). A plugin is three parts:

1. **MCP server** — tools and access to external systems
2. **Skills** — repeatable workflows wrapped around those tools
3. **Optional UI** — resources returned from selected MCP tools, rendered in ChatGPT

Highest-value pages for a 4-hour build:
- Quickstart: [/plugins/quickstart.md](https://developers.openai.com/plugins/quickstart.md) — "connect an MCP server and test the resulting plugin in ChatGPT Work"
- MCP + UI quickstart: [/plugins/build/app-quickstart.md](https://developers.openai.com/plugins/build/app-quickstart.md)
- Add UI to your MCP server: [/plugins/build/chatgpt-ui.md](https://developers.openai.com/plugins/build/chatgpt-ui.md)
- Build skills: [/plugins/build/skills.md](https://developers.openai.com/plugins/build/skills.md)
- Reference (schema/API fields for tools, resources, components): [/plugins/reference.md](https://developers.openai.com/plugins/reference.md)
- Single-file export for coding agents: [/plugins/llms-full.txt](https://developers.openai.com/plugins/llms-full.txt)
- **Convert a Claude Code plugin/connector into an OpenAI-submittable plugin:** [/plugins/guides/submit-claude-plugin.md](https://developers.openai.com/plugins/guides/submit-claude-plugin.md)

There are also conversion specs (product checkout, restaurant reservation, local-services quote) — genuinely interesting for a *transact on the web* project, though heavier than a 4-hour build.

## 4. Workspace Agents — backend-triggered ChatGPT agents

New surface at [developers.openai.com/workspace-agents](https://developers.openai.com/workspace-agents). ChatGPT agents "triggered from backend systems and automations," authenticated with **Workspace Agent access tokens** (bearer). Docs: [authentication.md](https://developers.openai.com/workspace-agents/authentication.md), [trigger-runs.md](https://developers.openai.com/workspace-agents/trigger-runs.md), [llms-full.txt](https://developers.openai.com/workspace-agents/llms-full.txt).

Worth a mention in the kit as a *notifications / async moments* option — a cron or webhook kicks a ChatGPT agent run rather than your own runtime.

## Deprecated — do not build on

- **Agent Builder** is marked *Legacy* in the docs nav and is **shutting down November 30, 2026.** Existing users get a transition window. Keep it out of the kit entirely.
- **Evals** and **Fine-tuning** guides are also tagged Legacy in the nav.

## Also available
`ChatKit` ([guides/chatkit](https://developers.openai.com/api/docs/guides/chatkit)) for drop-in chat UI with widgets and actions; `Guardrails` ([guides/agents/guardrails-approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)); MCP & Connectors ([guides/tools-connectors-mcp](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)); Codex at [developers.openai.com/codex](https://developers.openai.com/codex).
