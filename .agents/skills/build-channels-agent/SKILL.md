---
name: build-channels-agent
description: >-
  Write the code for a CopilotKit Channels agent with the Channels SDK
  (@copilotkit/channels) — a platform-agnostic engine that puts one AG-UI agent
  into Slack, Microsoft Teams, Discord, Telegram, and WhatsApp with native
  interactive UI. It's the engine behind OpenTag, the open-source alternative to
  Claude in Slack. Use this whenever the user wants to create, scaffold, or
  extend a Channels agent; wire an agent into Slack/Teams/Discord; add a tool,
  slash command, button, select, modal, or human-in-the-loop confirmation to a
  chat agent; or asks about createChannel, defineChannelTool,
  defineChannelComponent, thread.runAgent, awaitChoice, or the channels-ui JSX
  components. Trigger even when the user says "Slack bot", "Discord bot", or
  "chat agent" without naming the SDK, as long as the context is CopilotKit /
  Channels. The Channels API is new and easy to get wrong from memory — always
  ground code in this skill.
---

# Build a Channels agent

The Channels SDK (`@copilotkit/channels`) is a **platform-agnostic engine** for
agents that live in chat. You write the logic once — handlers, tools, and
JSX-rendered messages — and it runs on any messaging platform. The agent drives
real interactive UI in the conversation (buttons, selects, modals, charts), runs
tools, and can pause for human input mid-run.

This API is recent and not reliably in model memory. **Do not guess it from what
a Slack or Discord SDK usually looks like.** Prefer the exact names here over
anything remembered.

> **Naming.** The word "bot" is not part of this API. The factory is
> `createChannel`, tools are `defineChannelTool`, commands are
> `defineChannelCommand`, and the tool context is `ChannelToolContext`. An
> earlier pre-release used `Bot`-prefixed names (`createBot`, `defineBotTool`,
> `BotToolContext`) and they exist **nowhere** in the shipped packages —
> importing them fails to compile. Name your variable `channel`, not `bot`.

**Every code sample here compiles.** They were transcribed into one project and
typechecked under `strict` against both `@copilotkit/channels@0.7.1` +
`@copilotkit/runtime@1.66.1` and the `0.6.1` + `1.65.0` pair that the
[Slack guide](https://docs.copilotkit.ai/slack) pins — zero errors on both. Every
API here exists in both versions except `defineChannelComponent` and the
native-node helpers, which are **0.7+ only**. Channels and Runtime ship as a pair —
upgrade them together.

## The mental model (five pieces)

1. **Channel** — `createChannel()` returns a `Channel`; you attach handlers to it.
2. **Thread** — the per-conversation handle passed to every handler; you render
   and drive the conversation through it.
3. **Tools** — typed functions the agent can call (`defineChannelTool`).
4. **UI** — JSX from `@copilotkit/channels` that renders natively per platform.
5. **Context** — knowledge injected into the agent's prompt per run.

## Where the boundary sits

You run the agent, the tools, the business logic, and a **long-running process**.
CopilotKit Intelligence owns the platform credentials, ingress, and delivery. A
serverless request handler cannot host a Channel — it needs to own a persistent
gateway connection. **Node.js 22+** is required (the launcher needs global
`WebSocket`).

## Packages

`@copilotkit/channels` is **batteries-included**: one install gives you the
engine, the JSX vocabulary, the UI primitives, the testing API, and every
adapter.

```sh
npm install --save-exact @copilotkit/channels@0.6.1 @copilotkit/runtime@1.65.0
npm pkg set type=module
```

**Dedupe `@ag-ui/client` or the project will not compile.** Channels and Runtime
both depend on one exact version, but a transitive dep (`@ag-ui/mcp-middleware`)
pulls an older one, and npm nests it. Two copies means two separate
`AbstractAgent` declarations, so passing *any* agent to `createChannel({ agent })`
fails with a confusing error about "separate declarations of a private property
`_debug`". Pin one copy:

```json
{ "overrides": { "@ag-ui/client": "0.0.57" } }
```

Use the version Runtime declares (`npm ls @ag-ui/client` shows both), then
reinstall. pnpm uses `pnpm.overrides`, yarn uses `resolutions`. This is the single
most likely reason a correct-looking Channel refuses to typecheck.

- `@copilotkit/channels` — `createChannel`, `defineChannelTool`,
  `defineChannelCommand`, `defineChannelComponent`, `ContextEntry`, **and** the
  UI components (`Message`, `Section`, `Button`, …) all from the root import.
  Adapters live on subpaths: `@copilotkit/channels/slack`, `/teams`, `/discord`,
  `/telegram`, `/whatsapp`. UI is also at `/ui`; test helpers at `/testing`.
- `@copilotkit/runtime` — **required to start a Channel.** The runtime owns the
  Channel lifecycle. Your *agent* can be anything AG-UI compatible (the
  built-in agent, LangGraph, CrewAI, Mastra, custom) via the `agent` factory.

Standalone `@copilotkit/channels-ui` / `-slack` / `-teams` / … packages also
exist and work, but the single umbrella dependency is the documented path.

**A CopilotKit Intelligence API key is required** (free tier available). There is
no standalone or DIY way to run a Channel.

**Reference app:** [OpenTag](https://github.com/CopilotKit/OpenTag) is a
complete, real agent built on this SDK. When a task is close to "a full Slack
agent app", mirror it.

## createChannel — the entry point

**Default to a managed Channel.** Intelligence holds the platform credentials, so
your process carries no Slack or Teams tokens and you add platforms in the
dashboard rather than in code. There is no adapter at all:

```ts
import { createChannel } from "@copilotkit/channels";
import { makeAgent } from "./agent.js";

const channel = createChannel({
  name: process.env.CHANNEL_CODE!, // must equal the Channel Code in Intelligence
  identifyUser: "platform",        // REQUIRED — see below
  agent: makeAgent,                // factory: (threadId) => agent
});
```

- **`identifyUser` is required.** `"platform"` derives the canonical user from
  provider + workspace + platform user id — the right default. Or pass a
  callback `(ctx) => ApplicationUser | null` to map onto your own user table.
  Do **not** confuse this with `CopilotRuntime({ identifyUser })`, which resolves
  the user for *web* requests and must be absent on a Channels-only runtime.
- **`name` must be the exact Channel Code** from Intelligence: 3–64 chars, starts
  with a lowercase letter, lowercase letters and digits separated by single
  hyphens, project-unique, and never the literal `channels`. A mismatch leaves
  the Channel at **Waiting for runtime** — it is validated by the runtime, not by
  `createChannel`, so a typo fails at startup rather than at the call. `name` is
  optional in the types only because purely local/custom-adapter Channels omit it.
- `agent` accepts a factory `(threadId) => agent` **or** a single agent. Prefer
  the factory. Turn concurrency defaults to `"parallel"`, but you do not have to
  hand-manage isolation: Channels clones the agent per turn for *every* configured
  shape (singleton, fresh factory, and a factory returning the same object). What
  it cannot fix is a broken `clone()` — a custom `AbstractAgent` subclass with no
  `clone()`, or one that drops subclass state, fails loudly at turn start.

Other options: `tools`, `context`, `components` (register components so their
handlers survive a restart), `store` (persistence, per-thread state schema,
transcripts, `concurrency`), `commands`, `showToolStatus`, `replyContinuation`,
`sanitizeAgentEvents`.

### The agent factory

Return a **fresh agent per `threadId`**; never share one stateful instance across
conversations. The built-in agent runs in the same Node process, so it needs no
`AGENT_URL` and no second server:

```ts
import { BuiltInAgent } from "@copilotkit/runtime/v2";

export function makeAgent(threadId: string) {
  const agent = new BuiltInAgent({ model: "openai:gpt-5.4-mini" });
  agent.threadId = threadId;
  return agent;
}
```

For a remote AG-UI agent, use `HttpAgent` from `@ag-ui/client` (also re-exported
from `@copilotkit/channels`) pointed at your agent's URL.

### Direct adapter — only when you own the platform connection

Pass `adapters` when *you* hold the platform tokens. This is the secondary path:
platform secrets in your app and per-platform wiring in code. It does **not**
avoid needing Intelligence — the runtime still owns the lifecycle.

Do not reach for this because a managed Channel reports `setup_required` or
because the dashboard is unfamiliar. Swapping to a direct adapter to "make it
work" is a known failure mode, not a fallback. Fix the managed setup instead —
see the `setup-slack-channel` skill.

```ts
import { slack, defaultSlackTools, defaultSlackContext } from "@copilotkit/channels/slack";

const channel = createChannel({
  name: "support-slack",
  identifyUser: "platform",
  adapters: [
    slack({
      botToken: process.env.SLACK_BOT_TOKEN!, // xoxb-…
      appToken: process.env.SLACK_APP_TOKEN!, // xapp-… (Socket Mode)
    }),
  ],
  agent: makeAgent,
  tools: [...defaultSlackTools /* , ...yourTools */],
  context: [...defaultSlackContext /* , ...yourContext */],
});
```

`adapters` is an array — one Channel can run several platforms at once.
`defaultSlackTools` / `defaultSlackContext` add `lookup_slack_user` plus
tagging/mrkdwn/threading guidance; include them for direct Slack.

Socket Mode and its `xapp-` token belong **only** to this direct path. Managed
delivery uses signed HTTPS ingress into Intelligence plus an outbound gateway
socket — a managed setup needs no app token, and managed slash commands are not
part of the product surface.

## Starting it — the runtime owns the lifecycle

**There is no `channel.start()`.** Attach the Channel to a `CopilotRuntime` and
create a listener; creating the listener is what starts the Channel.

```ts
import { createServer } from "node:http";
import { CopilotRuntime, CopilotKitIntelligence } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";

const intelligence = new CopilotKitIntelligence({
  apiKey: required("INTELLIGENCE_API_KEY"),
  // Hosted Intelligence supplies both defaults. Override both together only
  // for self-hosted or non-production — they are separate hosts, so never
  // derive one from the other by swapping the scheme.
  apiUrl: process.env.INTELLIGENCE_API_URL,
  wsUrl: process.env.INTELLIGENCE_GATEWAY_WS_URL,
});

const runtime = new CopilotRuntime({
  agents: {}, // required, even when the Channel supplies the agent
  intelligence,
  channels: [channel],
});

// Wire teardown BEFORE the listener exists, because creating it starts the
// Channel. A Ctrl-C during the connect window then still tears the Channel
// down instead of hitting Node's default handler.
let teardown: (() => Promise<void>) | undefined;
const shutdown = async () => { await teardown?.(); };
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

const listener = createCopilotNodeListener({ runtime, basePath: "/api/copilotkit" });
const channels = listener.channels;
const server = createServer(listener);
teardown = async () => {
  await channels.stop();
  if (server.listening) server.close();
};

// Optional: block startup until activation settles, so a broken deploy fails
// loudly instead of serving as an agent that never answers.
await channels.ready({ timeoutMs: 30_000 });

// `ready()` is NOT proof of life — it resolves on `setup_required` too, because
// a declared-but-unprovisioned Channel is a "valid degraded state". Without
// this check you get a process that starts cleanly, serves HTTP 200, and
// answers nothing.
const status = channels.status();
if (status.overall !== "online") {
  throw new Error(`Channel is not online: ${JSON.stringify(status)}`);
}

server.listen(Number(process.env.PORT ?? 3000));
```

`listener.channels` is **non-optional** when you pass a literal non-empty
`channels: [channel]` array — that shape is branded, so no `!` or `?.` is needed
under `strict`. A dynamically-assembled `Channel[]` falls to the optional
overload and does need `?.`.

Managed delivery arrives over the Channel's own socket, not this HTTP port — but
keep the server: it is how the runtime serves web requests, and most hosts
require a listening port for their health check. The snippet uses top-level
`await`, so the project must be ESM (`npm pkg set type=module`).

### Environment

```dotenv
INTELLIGENCE_API_KEY=<project-api-key>
CHANNEL_CODE=support-slack
PORT=3000

# Optional paired overrides for self-hosted or non-production Intelligence:
# INTELLIGENCE_API_URL=https://intelligence.example.com
# INTELLIGENCE_GATEWAY_WS_URL=wss://realtime.intelligence.example.com
```

Pass bare base URLs — the client appends `/api/...`, `/runner`, `/client`, or
`/channels` itself. Never append those yourself. Create the project-scoped key
from **API Keys** in the Intelligence project sidebar, keep `.env` out of source
control, and never put the Intelligence key or platform tokens in browser code.

Run it with:

```sh
node --env-file=.env --import tsx channel.ts
```

### Reading status

`channels.status()` returns SDK lifecycle values — `"connecting"`, `"online"`,
`"setup_required"`, `"reconnecting"`, `"stopped"`, `"error"` — as `overall` plus a
per-Channel map. These are **not** the same vocabulary as the Intelligence
dashboard's states (Disabled, Setup incomplete, Setup failed, Waiting for
runtime, Conflict, Offline, Delivery failing, Online); for what each dashboard
state means and how to clear it, see the `setup-slack-channel` skill.

| `status().overall` | What it means |
| --- | --- |
| `connecting` | Activation in flight; `ready()` has not settled. |
| `online` | Connected. Send a real provider message to verify the full path. |
| `setup_required` | Declared but unprovisioned — finish the provider setup in Intelligence. `ready()` resolves here. |
| `reconnecting` | The gateway socket dropped; the connection layer is retrying. |
| `error` | Activation failed. `ready()` rejects with the cause. |
| `stopped` | `channels.stop()` was called. |

Activation errors are recorded as status and surfaced through `ready()` /
`status()` — they are not thrown. Only an up-front misconfiguration (a duplicate
or missing Channel name) throws synchronously.

## Channel handlers

Attach these to the object `createChannel` returned, before the runtime starts it.

| Handler | Fires when | Handler gets |
| --- | --- | --- |
| `channel.onMention(fn)` | the agent is @-mentioned (takes priority over `onMessage`) | `{ thread, message }` |
| `channel.onMessage(fn)` | any message the Channel sees | `{ thread, message }` |
| `channel.onThreadStarted(fn)` | a conversation surface opens (e.g. Slack assistant pane) | `{ thread, user, actor }` |
| `channel.onWelcome(fn)` | the app is installed / a conversation is activated | `{ thread, user, actor, platform }` |
| `channel.onCommand(name, fn)` | a slash command runs | `CommandContext` |
| `channel.onInteraction<T>(id, fn)` | a bound action fires (explicit binding) | `InteractionContext<T>` |
| `channel.onInterrupt<T>(event, fn)` | the agent pauses mid-run | `{ payload, thread, user, actor }` |
| `channel.onReaction([emoji,] fn)` | an emoji reaction is added/removed | `ReactionEvent` |
| `channel.onModalSubmit(id, fn)` | a modal is submitted (return `{ errors }` to keep it open) | `ModalSubmitEvent` |
| `channel.onModalClose(id, fn)` | a modal is dismissed | `ModalCloseEvent` |

`onMention` / `onMessage` get `{ thread, message }` only — **no `user`**. Reach the
caller through the message, or use a handler that exposes `user`
(`onThreadStarted`, `onWelcome`, tool context).

The most common shape is: reply on mention by running the agent.

```ts
channel.onMention(async ({ thread }) => {
  await thread.runAgent();
});
```

An omitted `prompt` already defaults to the inbound `message.contentParts` or
`message.text`, so plain `runAgent()` is correct for a mention. Pass `prompt`
explicitly only when the input is not in reconstructed history — slash-command
arguments, or when you want to combine text and attachments yourself:

```ts
channel.onMessage(async ({ thread, message }) => {
  await thread.runAgent({
    prompt: message.contentParts?.length
      ? [
          ...(message.text ? [{ type: "text" as const, text: message.text }] : []),
          ...message.contentParts,
        ]
      : message.text,
    context: [{ description: "Originating platform", value: message.platform }],
  });
});
```

To answer every message in a conversation the agent was invited into rather than
only mentions, mark the conversation subscribed on mention and gate `onMessage`
on it:

```ts
channel.onMention(async ({ thread }) => {
  await thread.subscribe();
  await thread.runAgent();
});

channel.onMessage(async ({ thread }) => {
  if (await thread.isSubscribed()) await thread.runAgent();
});
```

## The Thread API

Every handler receives `thread`. Key methods:

```ts
thread.post(ui)                 // render a JSX message → MessageRef
thread.update(ref, ui)          // replace a previously posted message
thread.delete(ref)              // remove a message
thread.stream(src)              // stream a string / AsyncIterable<string> live
thread.postFile({ ... })        // upload a file
thread.postEphemeral(user, ui, { fallbackToDM })  // one user only; opts required
thread.runAgent(input?)         // run the agent loop (see below)
thread.resume(value, opts?)     // re-enter after an interrupt → MessageRef | undefined
thread.awaitChoice<T>(ui)       // post a picker and BLOCK until the user chooses
thread.subscribe() / unsubscribe() / isSubscribed()  // persisted per-conversation flag
thread.getMessages()            // read the conversation (capability-gated → [])
thread.setTitle(title)          // rename the surface
thread.setSuggestedPrompts(...) // suggest follow-ups
thread.react(ref, emoji) / unreact(ref, emoji)
thread.state<T>() / setState(v) // per-thread state (typed by store.state schema)
thread.lookupUser(query)        // resolve a platform user (capability-gated)
```

Capability-gated methods degrade rather than throw: `getMessages()` returns `[]`
and `lookupUser()` returns `undefined` where the adapter cannot do it.

`runAgent` drives the agent's run / tool-call / interrupt loop and renders each
step as it streams. Prefer it over hand-managing the loop. Its input:

```ts
await thread.runAgent({
  prompt,                       // string | AgentContentPart[]
  context,                      // ContextEntry[] for this run
  tools,                        // extra ChannelTool[] for this run
  transcript: true,             // auto-bridge cross-platform transcripts
  memory: { user: "read-write", project: "read" },  // Intelligence Memory grant
});
```

- **`memory`** grants Intelligence Memory for that run only:
  `{ user?, project? }`, each `"none" | "read" | "read-write"`. **Omitting it
  disables Memory** — there is no implicit access. `resume(value, { memory,
  subject })` takes the same grant.
- **`transcript`** owns the whole transcript bridge (inject history → append the
  user turn → run → append the reply). If you set it, do **not** also append the
  same turns via `channel.transcripts.append`. It no-ops with a warning when
  identity or transcripts aren't configured.

## Tools

Tools are plain functions with a typed parameter schema. Parameters accept any
[Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType).
The handler receives the parsed args and a context with the **live thread** — so a
tool can post UI, ask a question, or run a HITL flow mid-execution.

```ts
import { defineChannelTool } from "@copilotkit/channels";
import { z } from "zod";

const getOncall = defineChannelTool({
  name: "get_oncall",
  description: "Look up who is currently on call for a team.",
  parameters: z.object({ team: z.string() }),
  async handler({ team }, { thread, user, actor, signal, platform }) {
    return await fetchOncall(team); // returned value goes back to the agent
  },
});
```

`ChannelToolContext` = `{ thread, message?, user, actor, signal?, platform }`,
where `user` is `ApplicationUser | null`.

The return value is what the **agent** reads back, not the user. Return the raw
data — it is JSON-stringified for you, so don't hand-stringify and don't return
`{ ok: true }`. For a tool that posts a card, return a short natural-language
confirmation like `"Displayed the issue card."` so the model doesn't restate it.
On failure, return the actual error text so the model can repair and retry.

Register via `createChannel({ tools })`, or `channel.tool(t)` before start.

## Interactive UI — the channels-ui JSX vocabulary

Import components from `@copilotkit/channels` and pass a tree to `thread.post`,
`thread.update`, or `thread.awaitChoice`. The **same tree** renders as Block Kit
on Slack, components on Discord, and Adaptive Cards on Teams. A surface that
can't render a node skips it (the renderer is total), so rich UI degrades
gracefully instead of erroring.

```tsx
import {
  Message, Header, Section, Markdown, Fields, Field,
  Actions, Button, Divider, Image,
} from "@copilotkit/channels";

await thread.post(
  <Message accent="#ff6600">
    <Header>Top story</Header>
    <Section><Markdown>**{story.title}** — {story.points} points</Markdown></Section>
    <Fields>
      <Field label="Author">{story.by}</Field>
      <Field label="Comments">{story.descendants}</Field>
    </Fields>
    <Actions>
      <Button url={story.url}>Open link</Button>
      <Button value={story.id} style="primary" onClick={async ({ action, thread }) => {
        await thread.post(<Section>Summarizing {action.value}…</Section>);
      }}>Summarize</Button>
    </Actions>
  </Message>,
);
```

See [references/ui-components.md](references/ui-components.md) for the full
component list and props (`Select`, `Input`, `Table`, `Chart`, `Modal`, …) and the
cross-platform degradation rules. **Read it before using a component you haven't
used here** — do not invent tag names or props.

### JSX setup (required, easy to miss)

A file containing JSX must be **`.tsx`** and the tsconfig must point the JSX
factory at Channels — this is not React:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "jsxImportSource": "@copilotkit/channels",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "types": ["node"]
  }
}
```

Without `jsxImportSource` the tree compiles against React and fails.

Point it at `@copilotkit/channels` — the package you installed. Do **not** point
it at `@copilotkit/channels-ui` unless that package is a direct dependency: it is
only a transitive dep of the umbrella package, so the import resolves under npm's
hoisted layout and fails under pnpm's isolated one. Same rule for
`import { Message } from "@copilotkit/channels-ui"`.

### Agent-rendered components (0.7+)

`defineChannelComponent` turns a component into a **tool the agent can call** to
render UI itself, with schema-inferred props:

```tsx
import { defineChannelComponent, Message, Header, Context } from "@copilotkit/channels";
import { z } from "zod";

const IssueCard = defineChannelComponent({
  name: "issue_card",
  description: "Render an issue as a card.",
  parameters: z.object({ id: z.string(), title: z.string() }),
  render({ id, title }, { platform, signal }) {
    return <Message><Header>{title}</Header><Context>{id}</Context></Message>;
  },
});
```

Pass it via `createChannel({ components: [IssueCard] })`. Registration also lets
keyed handlers be recovered after a restart when the store is durable.

## Human-in-the-loop

Two patterns. Use `awaitChoice` for a simple picker; use `onInterrupt` + `resume`
when the agent itself pauses (e.g. a LangGraph interrupt).

```tsx
const ok = await thread.awaitChoice<boolean>(
  <Message accent="#E01E5A">
    <Section><Markdown>Deploy to **production**? This is irreversible.</Markdown></Section>
    <Actions>
      <Button value={true} style="primary">Ship it</Button>
      <Button value={false} style="danger">Cancel</Button>
    </Actions>
  </Message>,
);
if (!ok) return "User cancelled; nothing was deployed.";
```

`awaitChoice<T>` blocks the handler until the user clicks; the clicked `Button`'s
`value` (typed as `T`) is what it resolves to. Because a tool handler gets the
live `thread`, call it directly inside a `defineChannelTool` handler to gate a
destructive tool on approval. See
[references/hitl-patterns.md](references/hitl-patterns.md) for `onInterrupt` /
`resume` and for why action handlers survive restarts (content-stable IDs + a
durable store).

## Context

`ContextEntry` values are `{ description: string; value: string }` pairs injected
into the agent's prompt per run — the channel, the caller's role, anything that
grounds the turn. Pass them at `createChannel({ context })` or per-run via
`thread.runAgent({ context })`.

## Slash commands

```ts
channel.onCommand("top", async ({ thread, text }) => {
  const stories = await fetchTopStories(Number(text) || 5);
  await thread.post(/* a <Message> listing them */);
});
```

Arguments arrive on `CommandContext` as **`text`** — the raw string after the
command name — not `args`. `options` holds the parsed, typed form and is only
populated by surfaces that deliver structured arguments natively (Discord); on
text-only surfaces like Slack it is empty, so read `text` there. The context also
carries `command`, `user`, `actor`, `platform`, and an optional `openModal(view)`
(`undefined` where the surface has no trigger for it).

Command args are never posted to the channel, so they are not in reconstructed
history — pass them explicitly when handing off to the agent:

```ts
await thread.runAgent({ prompt: `Triage: ${text}` });
```

For richer command metadata (description, an `options` schema registered with the
platform), use `defineChannelCommand` and pass it via `commands`.

## Tool-call progress

Managed Slack hides tool-call progress by default, so the conversation ends with
a clean result; the lifecycle events still land in Intelligence history and are
available on replay. Opt in per Channel when the live timeline is useful:

```ts
const channel = createChannel({ /* … */ showToolStatus: true });
```

`showToolStatus` is **ignored for direct-adapter Channels** — configure those with
`slack({ showToolStatus: true })` instead. Other managed providers keep their own
default when it is unset.

## Long replies

Providers cap how much text one message holds. Past that the reply is split
across continuation messages, and past a ceiling it is truncated with a visible
marker. Tune with `createChannel({ replyContinuation: { messageByteLimit,
maxMessages, truncationMarker } })` — honoured by managed and direct Slack today.

## Adding a new platform

If the user needs a surface with no adapter yet, they implement `PlatformAdapter`
— the engine and Channel logic don't change. Advanced path; read
[references/adapter-authoring.md](references/adapter-authoring.md) only when the
task is specifically "add support for platform X".

## Getting Slack actually connected

Creating the Slack app, storing its credentials, creating the managed Channel,
and lining it up with a local runtime is a setup workflow rather than an API
question. Use the **`setup-slack-channel`** skill for that, and for diagnosing a
Channel stuck at `setup_required`, sitting at Waiting for runtime, or Online but
silent.

## Common mistakes to avoid

- Do **not** use `createBot`, `defineBotTool`, `defineBotCommand`, or
  `BotToolContext` — they do not exist. Use `createChannel`,
  `defineChannelTool`, `defineChannelCommand`, `ChannelToolContext`.
- Do **not** call `channel.start()` / `channel.stop()` — there is no public
  lifecycle method. Attach the Channel to `CopilotRuntime` and create a listener.
- Do **not** omit `identifyUser` on `createChannel` — it is required. And do not
  put it on `CopilotRuntime` instead: that one is for web requests and must be
  absent on a Channels-only runtime.
- Do **not** treat `await ready()` as proof of life — it resolves on
  `setup_required`. Gate on `status().overall === "online"`.
- Do **not** pass `provider: "slack"` to `createChannel` — no such option. The
  platform comes from the adapter, or from Intelligence for a managed Channel.
- Do **not** use a Socket Mode `xapp-` token for a managed Channel — Socket Mode
  belongs only to the direct-adapter path.
- Do **not** call `new Bot()` or `channel.on("message", …)` — use the named
  `onMention` / `onMessage` / `onCommand` handlers.
- Do **not** hand-build Block Kit / embeds / Adaptive Cards JSON — render JSX
  from `@copilotkit/channels` and let the adapter translate it.
- Do **not** derive `wsUrl` from `apiUrl` by swapping the scheme — separate
  hosts. Override both or neither, as bare base URLs.
- Do **not** set `runAgent({ transcript: true })` *and* append the same turns
  manually — the flag owns the bridge.
- Do **not** expect Memory without a `memory` grant — omission disables it.
- Prefer a factory `agent: (threadId) => agent` over a shared agent instance.
- Prefer `thread.runAgent()` over manually looping over agent events.
- Do **not** write a handler as a concise arrow returning `thread.post(...)` —
  handlers must return `void | Promise<void>` and `post` returns a `MessageRef`,
  which fails under `strict`. Use a block body and `await` it:
  `async ({ thread }) => { await thread.post(…); }`.
- Do **not** read slash-command arguments from `args` — there is no such field.
  Use `text` (raw) or `options` (typed, structured surfaces only).
- A file that contains JSX must be **`.tsx`** with
  `jsxImportSource: "@copilotkit/channels"` — otherwise it won't compile.
- Do **not** leave `@ag-ui/client` duplicated. Two copies produce two
  `AbstractAgent` types and every `createChannel({ agent })` fails on a private
  `_debug` property. Add an `overrides` pin.
- Do **not** build a modal as `<Modal>` JSX — `JSX.Element` is `ChannelNode`, so
  it won't satisfy `openModal`'s `ModalView`. Call `Modal({ …, children: [...] })`.
- Do **not** forget `"type": "module"`. The startup snippet uses top-level
  `await`; without ESM you get `TS1309: The current file is a CommonJS module`.
- Do **not** host a Channel in a serverless handler — it needs a long-running
  process to own the gateway connection. Node.js 22+.
