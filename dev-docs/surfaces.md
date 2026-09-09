# Choose a surface

Pick the place where your agent's context already exists. The following matrix describes this kit's implementation, not every feature of the underlying SDKs.

| Surface | Agent and context | UI and actions | Optional capabilities | Limits |
|---|---|---|---|---|
| Terminal | `makeAgent`; messages you type | Text and tool output | Ambiguous MCP through shared factory | No Slack history, incident cards, Exa tool, or approval UI |
| Slack / Teams | `makeAgent`; `read_thread` plus channel context | `incident_card`, `timeline`, `propose_action` | Exa, Ambiguous MCP, Trigger research and `check_deep_work` | Managed Channel setup required; live platform validation required |
| Web | `makeAgent`; selected sample incident, timeline and follow-ups via `useAgentContext` | Incident cards, timeline, approval UI; `select_incident`, `create_followup` | Ambiguous MCP through shared factory | Local follow-ups reset on refresh; web chat does not register Exa search |
| Voice (`/voice`) | Separate `RealtimeAgent`; shares system prompt | Spoken conversation and transcript | Exa via server search route | OpenAI Realtime key required regardless of chat provider; no incident workspace context, workplace MCP, or approval tools |
| MCP | Host's agent/model; server exposes tools | `incident_card` and HTML UI resource | Exa `search_web` | Does not call `makeAgent`; rendering depends on host; no workplace or approval tools |
| Mobile | Web runtime's `makeAgent`; device-context tool | Expo chat and `confirm_action` UI | Shared runtime's Ambiguous MCP | Separate install; no native incident cards, Slack tools, or device verification |

Managed `propose_action` posts a nonblocking proposal; its later click reports a decision without automatically resuming the agent. There is no production restart implementation. Nor is it an authorization wrapper around every Ambiguous MCP tool: use an isolated demo workspace and explicitly approve intended writes. Trigger's worker separately checks its waitpoint decision before Exa research. Auth0's standalone example separately verifies a machine token and scope before creating its local record.

## Launch commands

Run these from the repository root after [setup](setup.md):

| Surface | Command | Next step |
|---|---|---|
| Terminal | `npm run dev:local` | Type the incident context and a question |
| Slack | `npm run dev:slack` | Invite and mention the bot in a thread |
| Web | `npm run dev:web` | Open `http://localhost:3100` |
| Voice | `npm run dev:web` | Run `npm run check-env -- --voice`, then open `http://localhost:3100/voice` and allow microphone access |
| MCP HTTP | `npm run dev:mcp` | Connect an HTTP MCP client to `http://localhost:3200/mcp` |
| Mobile | Start `npm run dev:web`, then `cd apps/mobile && npm install && npm start` | Configure the runtime URL for your simulator or device; see [mobile setup](../apps/mobile/README.md) |

MCP protocol checks are part of `npm run verify`, independent of a live host or its widget rendering. Mobile is not an npm workspace member because React Native uses its own dependency versions.

## Slack to Teams

Create a separate Channel with the Teams adapter:

```bash
npx copilotkit@latest channels add --name my-agent \
  --display-name "My Agent" --adapter teams --json
```

Complete the Teams installation and consent flow and set the resulting Channel code. The JSX uses the SDK's native rendering path; prove the thread, card, and button interactions on your actual platform before recording a demo.

## Customize

The shared factory is [agent.ts](../packages/agent-core/src/agent.ts). Surface-specific tools belong in their respective app. For a new backend, validate AG-UI tool and context behavior rather than assuming identical capabilities across all surfaces.
