# Surfaces

**Read this first: pick one surface and go deep.** The event rewards "a sharp,
working demo" over breadth, and six shallow surfaces is the most common way to
lose a hackathon you were winning at 14:00. The selection table lives in the
[README](../README.md#pick-one-surface).

The reason six exist is that `packages/agent-core` owns the model, the prompt and
the capabilities, so each app in `apps/` is a thin binding — which makes a
*second* surface nearly free once your first one is good. That is a closing shot
for the video, not a second project.

## What ships today

| App | Surface | Status |
|---|---|---|
| `apps/local-chat` | your terminal | working — tier 0 |
| `apps/channel-slack` | Slack, Teams *(swap the adapter)* | working — tier 1 |

## What to add next, and how

### On the web — `apps/web`

Next.js + `@copilotkit/react-core` / `@copilotkit/react-ui` (1.70.1). Point the
runtime at the same `makeAgent`. Generative UI here is a spectrum:

- **Controlled** — `useRenderTool` with your own React components
- **Declarative** — [A2UI](https://a2ui.org/), schema-mapped renderers
- **Open-ended** — MCP Apps / raw HTML in a sandboxed double-iframe

Unlike the Channels listener, a Next.js app deploys fine to Vercel.

### In your pocket — `apps/mobile`

Expo + `@copilotkit/react-native@1.70.1`. Three import surfaces: `/headless`
(provider + hooks, no native peers), the root barrel, and `/components` (the
rendered chat UI). Docs: [docs.copilotkit.ai/react-native](https://docs.copilotkit.ai/react-native)

The interesting build here is not a chat app — it is **notifications**. A short
async moment where the agent reaches you, you tap once, and it continues.

### In the room — `apps/voice`

OpenAI Realtime. Pick the transport deliberately:

- **WebRTC** for browser and mobile clients capturing audio directly
- **WebSocket** when your server receives audio from a media pipeline
- **SIP** for telephony

Models: `gpt-realtime-2.1` (reasoning + tools), `gpt-realtime-1.5` (best pure
audio-in/audio-out), `gpt-live-transcribe`. Mint ephemeral credentials with
`POST /v1/realtime/client_secrets` — never ship the API key to a client. Start at
`reasoning.effort: low`.

Pair with Exa's `instant` profile (~250ms); anything slower breaks the
conversational turn.

### In ChatGPT — `apps/plugin`

An OpenAI **plugin** is three parts: an MCP server, skills, and optional UI.
(The naming moved — what was pitched as the "Apps SDK" is documented at
[developers.openai.com/plugins](https://developers.openai.com/plugins/).)

Start from [/plugins/build/app-quickstart.md](https://developers.openai.com/plugins/build/app-quickstart.md).
If you already have a Claude Code plugin, there is a conversion guide:
[/plugins/guides/submit-claude-plugin.md](https://developers.openai.com/plugins/guides/submit-claude-plugin.md).

## Slack → Teams

Change the adapter when you create the Channel:

```bash
npx copilotkit@latest channels add --name my-agent \
  --display-name "My Agent" --adapter teams --json
```

`apps/channel-slack/src/` needs no change — the same JSX renders as Adaptive
Cards. Teams needs admin consent and a package upload, so it is the slower demo
path. Slack is the safe one.
