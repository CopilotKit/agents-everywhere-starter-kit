# CopilotKit — global sponsor (and the spine of this hackathon's theme)

The event is literally named **"Bots, Channels, & More."** CopilotKit shipped the **Channels SDK** in early August 2026. That is not a coincidence — Channels is the reference answer to "put an agent where work already happens," and the kit should treat it as the default backbone for the *At work* and *In your pocket* surfaces.

## Channels SDK — the headline

- **Repo:** [CopilotKit/channels-sdk](https://github.com/CopilotKit/channels-sdk) · MIT
- **Docs:** [docs.copilotkit.ai/slack](https://docs.copilotkit.ai/slack)
- **Canonical, never-stale setup workflow:** <https://copilotkit.ai/channels-guide.md>
- **Try it without building:** <https://www.copilotkit.ai/try-channels>
- Announced [Aug 2026](https://www.copilotkit.ai/blog/channels-sdk); [MarkTechPost coverage](https://www.marktechpost.com/2026/08/04/copilotkit-open-sources-channels-sdk/)

### Verified versions (npm, checked 2026-09-08)

> Snapshot, not live. `@copilotkit/runtime` published **1.70.2** later the same
> day; the kit tracks that. Treat the repo's `package.json` as the source of
> truth and re-run `npm view` rather than trusting this table.

| Package | Version |
|---|---|
| `@copilotkit/channels` | **0.9.2** (2026-09-03) |
| `@copilotkit/runtime` | **1.70.1** (2026-09-03) |
| `@copilotkit/react-core` / `react-ui` / `react-native` | **1.70.1** |
| `@copilotkit/angular` | 0.5.1 |
| `@ag-ui/client` | **0.0.59** — the exact pin `runtime@1.70.1` bundles |
| CLI (unscoped) | `copilotkit@4.9.37` |

`@copilotkit/channels@0.9.2` is a meta-package that pulls in `channels-core`, `channels-ui`, `channels-slack`, `channels-teams`, `channels-discord`, `channels-telegram`, `channels-whatsapp` — all lockstep at 0.9.2.

> **Two pinning rules for the kit.** (1) Channels and Runtime ship as a *tested pair* — bump together, `--save-exact`. (2) Pin `@ag-ui/client` to exactly what runtime bundles (0.0.59) or you get `AbstractAgent` type errors.
>
> **Stale docs warning:** `docs.copilotkit.ai/slack/deploy-and-operate` still tells you to install `channels@0.6.1` + `runtime@1.65.0`. Ignore it; use the npm versions above.

### Architecture — why this is a zero-tunnel path

Delivery is **two legs, neither is Socket Mode**:

1. **Provider → Intelligence** is inbound HTTPS to a CopilotKit-hosted request URL. Slack authenticates with a **signing secret** Intelligence holds; Teams authenticates with a **Microsoft-signed bearer JWT** verified against Entra.
2. **Intelligence → your runtime** is an **outbound websocket** from your machine, authenticated by `INTELLIGENCE_API_KEY`.

**Consequence: no tunnel, no public URL of your own, no `xapp-` app-level token.** This is the single biggest time-saver available on the day, and it is why Channels should be the kit's default rather than raw Bolt/discord.js.

> Reaching for a signing secret on Teams, or a bearer JWT on Slack, produces an app that installs cleanly and authenticates nothing — the guide calls this the most expensive failure mode because it looks like it works.

### Setup path (order matters)

**Create the Channel first** — the wizard *generates* the provider app manifest already pointed at the right request URL. The Channel's **Code** (lowercase kebab-case) must match `createChannel({ name })` character for character.

```sh
# Fastest: install the setup skill and let a coding agent drive the consoles
npx copilotkit@latest channels setup

# Or drive the Intelligence side directly
npx copilotkit@latest channels add --name <slug> --display-name "<name>" --adapter slack --json
npx copilotkit@latest channels status --json   # a real doctor command
```

CLI JSON envelope: `completed` / `blocked` (normal pause, exits 0, read `nextAction`) / `failed`. **No CLI flag accepts a credential value** — tokens stay in your `.env`.

### Minimal listener (from the SDK README, current API)

```ts
import { createServer } from "node:http";
import { createChannel } from "@copilotkit/channels";
import { BuiltInAgent, CopilotKitIntelligence, CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";

const channel = createChannel({
  name: required("CHANNEL_CODE"),
  identifyUser: "platform",
  agent: (threadId) => {
    const agent = new BuiltInAgent({ model: "openai:gpt-5.4-mini" });
    agent.threadId = threadId;
    return agent;
  },
});

channel.onMessage(async ({ thread, message }) => {
  await thread.runAgent({
    prompt: message.text,
    context: [{ description: "Originating platform", value: message.platform }],
  });
});

const runtime = new CopilotRuntime({
  agents: {},
  intelligence: new CopilotKitIntelligence({ apiKey: required("INTELLIGENCE_API_KEY") }),
  identifyUser: () => ({ id: "channels-runtime", name: "Channels Runtime" }),
  channels: [channel],
});

const listener = createCopilotNodeListener({ runtime, basePath: "/api/copilotkit" });
await listener.channels.ready({ timeoutMs: 30_000 });
if (listener.channels.status().overall !== "online") throw new Error("not online");
createServer(listener).listen(Number(process.env.PORT ?? 3000));
```

Swap `BuiltInAgent` for `new HttpAgent({ url: AGENT_URL })` to point at any AG-UI agent — LangGraph, CrewAI, Mastra, Pydantic AI, Google ADK, or a plain HTTP agent you wrote.

### Channels JSX — native UI per platform

Write one component; the renderer emits **Slack Block Kit** or **Teams Adaptive Cards**. Set `@copilotkit/channels` as the JSX import source in `tsconfig.json`.

Primitives: `Message`, `Header`, `Section`, `Fields`/`Field`, `Actions`/`Button`, `Table`/`Row`/`Cell`, `Image`, `Divider`, `Context`, `Select`, `Input`. Unsupported nodes are **omitted, not fatal** (e.g. `Chart` drops on Slack). `defineChannelComponent` returns a `MessageRef` you can update within the delivery cycle.

**At least one `defineChannelComponent` must render** — the setup guide gates success on it, and judges will notice the difference between a text bot and one that renders native cards with buttons.

### Traps that all look like success (hard-won; put these in the kit's troubleshooting doc)

| Trap | Tell | Fix |
|---|---|---|
| `controls.ready()` resolves on `setup_required` too | Bot silent, everything "green" | Read `controls.status()` → `{ overall, channels }`; only `online` delivers |
| Runtime logger defaults to `error`; every Channel lifecycle breadcrumb is emitted at `warn` | `channel "<name>" requires setup` written and discarded | `LOG_LEVEL=debug` |
| Two runtimes declaring the same Channel name in one project | Slack replies your terminal knows nothing about — claim-based delivery, loser gets nothing silently | One project per local runtime |
| Workspace-installed ≠ channel member | No `app_mention` event at all | `/invite @Bot` |
| Asymmetric turn routing | A *mentioned* turn hits `onMention` if registered, else falls back to `onMessage`; a *non-mentioned* turn only ever hits `onMessage` | Verify with a channel mention first |
| Dashboard "Agent run" reads `—`, Overview says `AGENT: Not declared` | Looks broken, isn't | The **Usage** tab (Completed turns + non-zero Outbound) proves a round trip |

**Not delivered on the managed path:** slash commands and modal submissions (`view_submission`). Mentions, messages, reactions, and **button/select clicks all work** — which is what makes HITL approval gates fire. Code that registers `onModalSubmit` or slash commands compiles, starts, reports online, and never fires.

### Deploy

A Channels listener is a **long-running worker with an outbound websocket** — deploy it like a queue consumer, *not* a serverless handler. Node.js 22+ required (global `WebSocket`).

- **Good:** Railway, Google Cloud Run (min-instances ≥ 1, CPU always allocated), Fly.io, Render, plain Docker
- **Bad:** Vercel/Netlify serverless functions
- Liveness ≠ readiness. Status values: `connecting`, `online`, `setup_required`, `reconnecting`, `error`, `stopped`. Don't restart on `reconnecting` (bounded ~60s reconnect); alert on `error`.
- Replicas are fine — claim-based delivery means one runtime claims each delivery. Run identical builds.

## The rest of the CopilotKit surface worth pulling in

| Piece | Why it matters here |
|---|---|
| **Generative UI** — `useRenderTool`, MCP Apps, [A2UI](https://a2ui.org/) | The *On the web* surface. Controlled → declarative → open-ended spectrum. |
| **AG-UI protocol** | The neutral agent interface; lets one agent serve web + Slack + mobile unchanged. |
| **Intelligence** | Durable threads (Postgres), managed channel connections, hosted inspection. |
| **`@copilotkit/react-native@1.70.1`** | The *In your pocket* surface. Three import surfaces: `/headless` (provider + hooks, no native peers), root barrel, `/components`. Docs: [docs.copilotkit.ai/react-native](https://docs.copilotkit.ai/react-native) |
| **`@copilotkit/angular@0.5.1`** | Alternative web frontend. |
| **OpenTag** — [CopilotKit/OpenTag](https://github.com/CopilotKit/OpenTag) | The flagship Channels app: self-hosted on-call triage assistant for Slack + Teams, Python LangGraph agent over AG-UI. Vendored into channels-sdk as a git submodule. **This is the closest existing thing to what the new kit should ship.** |
| **Docs MCP server** — `https://mcp.copilotkit.ai/mcp` | Live docs access for coding agents. |
| **Skills** — [CopilotKit/skills](https://github.com/CopilotKit/skills) | `npx skills add copilotkit/skills --full-depth -y`. The channels-sdk repo ships a `build-channels-agent` skill (30KB SKILL.md + references + evals). |

## Examples in channels-sdk

- `examples/minimal-channel` — the smallest complete listener (`createChannel` + `HttpAgent` + `onMention`/`onMessage` with `thread.subscribe()` / `thread.isSubscribed()`)
- `examples/mastra-sandbox` — Mastra agent on managed Slack, with a command sandbox, discoverable skills, an unsubscribe tool, and an agent-rendered bar chart
- `examples/OpenTag` — git submodule (`git submodule update --init examples/OpenTag`)
