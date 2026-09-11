# Surface map

The starter kit now keeps the three runnable template apps together under `apps/`: channel, web, and mobile. The voice route lives inside the web app. Remote MCP tools, such as Ambiguous AI, are connected through the shared agent factory when configured; the old standalone local MCP host is no longer part of the retained starter layout.

| Surface | Agent and context | UI and actions | Optional capabilities | Limits |
|---|---|---|---|---|
| Channel (Slack / Teams / Discord) | `makeAgent`; `read_thread` plus channel context | `incident_card`, `timeline`, `propose_action` | Exa and Ambiguous MCP | Managed Channel setup required; live platform validation required |
| Web | `makeAgent`; selected sample incident, timeline and Ambiguous follow-ups via `useAgentContext` | Incident cards, timeline, approval UI; `select_incident`, `propose_followup`, `retrieve_followup`, `refresh_followups` | Ambiguous through the server-side approval boundary | Web chat does not register Exa search or raw workplace write tools; approval server is loopback-only by default |
| Voice (`/voice`) | Separate `RealtimeAgent`; shares system prompt | Spoken conversation and transcript | Exa via server search route | OpenAI Realtime key required regardless of chat provider; no incident workspace context, workplace MCP, or approval tools |
| Mobile | Web runtime's `makeAgent` with a mobile prompt; finance app state through frontend tools | Expo chat, native cards, and `add_mobile_expense` approval UI | OpenAI or OpenRouter through the shared model resolver | Separate install; local sample data only; no bank, messaging, or Realtime voice integration |

Managed `propose_action` posts a nonblocking proposal; its later click reports a decision without automatically resuming the agent. There is no production restart implementation. The web template has its own Ambiguous approval boundary for follow-up tasks; other surfaces that expose Ambiguous MCP should use an isolated demo workspace and enforce required write approval in their own code. Auth0's optional docs companion recipe separately verifies a machine token and scope before creating its local record.

## Launch commands

Run these from the repository root after [setup](setup.md):

| Surface | Command | Next step |
|---|---|---|
| Channel | `npm run dev:slack` | Invite and mention the bot in a thread |
| Web | `npm run dev:web` | Open `http://localhost:3100` |
| Voice | `npm run dev:web` | Set `OPENAI_API_KEY`, then open `http://localhost:3100/voice` and allow microphone access |
| Mobile | Start `npm run dev:web`, then `cd apps/mobile && npm ci && npm start` | Configure the runtime URL for your simulator or device; see [mobile setup](../apps/mobile/README.md) |

`npm run verify` covers the retained root workspaces without credentials. Mobile is not an npm workspace member because React Native uses its own dependency versions; run its local install, tests, typecheck, and iOS/Android Metro export checks under `apps/mobile` when validating the mobile template.

## Slack to Teams

Create a separate Channel with the Teams adapter:

```bash
npx copilotkit@latest channels setup --platform teams
```

Then route the same app code through that Channel. Keep the slash-command and mention behavior explicit in your README because users will discover the agent differently than in Slack.
