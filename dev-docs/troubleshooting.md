# Troubleshooting

Ordered by how often each one wastes an afternoon. Every entry here has already
cost somebody real time.

## OpenRouter-only setup asks for an OpenAI key

Set `MODEL_PROVIDER=openrouter` and `OPENROUTER_API_KEY` in root `.env`, choose an
available `MODEL` slug, and restart. `npm run check-env` validates the selected
chat provider. `/voice` separately needs OpenAI Realtime credentials. See
[model switching](model-switching.md).

## Verification versus configured startup

`npm run verify` needs no `.env` or live credentials. `npm run check-env` does:
it validates your selected provider and configured surfaces, without authenticating
against remote services. A successful offline check does not prove live access.

## It boots, reports online, and answers nothing

**1. The Channel is `setup_required`, not `online`.**
`channels.ready()` resolves on `setup_required` too, because a declared-but-
unprovisioned Channel counts as a valid degraded state. `server.ts` gates on
`status().overall === "online"` for exactly this reason — if you removed that
check, put it back.

```bash
npm run channel:status
```

**2. You cannot see the diagnostic.** Lifecycle breadcrumbs are emitted at `warn`
while the runtime logger defaults to `error`, so the single most useful line —
`channel "<name>" requires setup` — is written and discarded.

```dotenv
LOG_LEVEL=debug
```

**3. The bot is not in the channel.** Workspace-installed is not the same as
channel member. Slack emits no `app_mention` event _at all_ for a channel the app
is not in. `/invite @yourbot`.

**4. Another runtime is stealing the delivery.** Two runtimes declaring the same
Channel name in one project race per delivery and the loser gets nothing,
silently. The tell: one runtime logs the delivery while the other never sees it. Give your
laptop its own Intelligence project.

**5. You are testing without a mention.** A non-mentioned turn only ever reaches
`onMessage`, and this kit gates that on `thread.isSubscribed()`. Verify with a
channel mention first.

## The dashboard looks broken but is not

- **Agent run: `—`** even after a successful turn — expected.
- **Overview: `AGENT: Not declared`** — expected.
- **An `…:activation` pseudo-thread** — only means the runtime activated.

The tab that proves a round trip is **Usage**: completed turns, plus non-zero
outbound.

## "Waiting for runtime"

`CHANNEL_CODE` does not match the Channel Code in Intelligence. It is validated
by the runtime at startup, not by `createChannel`, so a typo fails late.
Character for character: lowercase letters and digits, single hyphens, starts
with a letter.

## It will not compile

**`separate declarations of a private property '_debug'`** — two copies of
`@ag-ui/client`. The root `package.json` pins it via `overrides`; check it still
matches what the runtime declares:

```bash
npm ls @ag-ui/client     # every line should read the same version
```

**JSX errors, or props that "don't exist"** — the file must be `.tsx` and the
tsconfig must set `jsxImportSource: "@copilotkit/channels"`. Without it the tree
compiles against React.

**`TS1309: The current file is a CommonJS module`** — `"type": "module"` is
missing from that package.json. The startup code uses top-level `await`.

**A handler "is not assignable to type `() => void`"** — `thread.post()` returns
a `MessageRef`. Use a block body: `async ({ thread }) => { await thread.post(…); }`

## The agent calls one tool and then gives up

`maxSteps` defaults to **1** on `BuiltInAgent`. The kit sets 10 in
`packages/agent-core/src/agent.ts`.

## Research produces a card without source links

`search_web` posts a **Search sources** card directly from Exa's returned URLs before handing the evidence back to the agent. The source buttons remain available when the agent ends with an incident card and no prose. Each search has its own query and references; public documentation does not establish the incident's root cause. Empty searches visibly report **No sources found**.

Search and invalid-source failures post a visible failure notice and preserve the error for the agent. Rejected source-card deliveries propagate as errors. A completed delivery therefore does not necessarily mean research succeeded. If an older runtime still returns no sources, sync `apps/channel/src/search.tsx` and `apps/channel/src/tools.tsx` together and restart it.

## A Slack run stops after the first native card

A delivered card alone does not prove the same Channel turn can continue after a tool result. With the pinned Channels/runtime pair, the run loop can re-enter the agent as soon as the previous observable completes. CopilotKit's `BuiltInAgent` clears its internal abort controller later, during async cleanup, so reusing the same inner instance can throw `Agent is already running. Call abortRun() first or create a new instance.` before the follow-up answer or status clear is delivered.

The Slack template wraps the shared `makeAgent` factory with `ChannelRunAgent` in `apps/channel/src/agent.ts`. The wrapper keeps the public AG-UI transcript, state, subscribers, clone behavior, and cancellation on the outer agent, but delegates each low-level `run(input)` to a fresh inner `BuiltInAgent`. This is scoped to Channels; web and mobile continue using the shared factory directly.

Run `npm test --workspace channel` to exercise the local lifecycle regression: a real `BuiltInAgent` reproduces the same-tick continuation guard, the channel wrapper continues with tool-result transcript and state intact, and cancellation/teardown are forwarded to the active inner agent. That test proves the local lifecycle boundary only. Actual Slack delivery still requires a live managed Channel run; preserve raw runtime stdout/stderr and Intelligence delivery traces when checking source cards, final answers, and a cleared working indicator.

## Slash commands and modals never fire

They are not delivered on the managed path. Code that registers `onCommand` or
`onModalSubmit` compiles, starts, reports online, and stays silent. Buttons and
selects do work — build the interaction with those.

## An `xapp-` token is in my .env

Remove it. Socket Mode belongs only to the direct-adapter path; a managed
Channel needs no app-level token and the pre-flight check fails on it
deliberately.

## Teams installs cleanly and authenticates nothing

You used a signing secret. Slack authenticates with a signing secret; Teams
authenticates with a Microsoft-signed bearer JWT verified against Entra. Crossing
them is the most expensive failure mode here because it looks like it worked.

## `AI SDK Warning: System messages in the prompt or messages fields…`

Harmless and not yours. `BuiltInAgent`'s `prompt` option becomes a system message
in the messages array, and the AI SDK warns about that pattern generically. It
does not mean your prompt is being injected.

## `npm install` fails with "Cannot read properties of null (reading 'edgesOut')"

You added **vitest**. `@copilotkit/channels` declares `vitest: ^4.0.0` as a peer
dependency, and npm's dependency resolver crashes trying to reconcile that with
vitest as a direct dependency — at the root _or_ in a workspace, and from a
completely clean `node_modules`. The error names nothing useful.

That is why this kit tests with **`node:test`**, Node's built-in runner: no
install, no peer conflict, and `mock.fn()` covers what `vi.fn()` was doing.

```bash
npm test          # node --import tsx --test 'src/**/*.test.tsx'
```

If you genuinely need vitest, `--legacy-peer-deps` gets you past it — put it in
`.npmrc` so it applies to every install, not just the one you remember.

## Still stuck

- `npm run verify` — retained workspace typechecks and offline tests
- `npm run check-env` — numbered list of what is missing
- `npm run channel:status` — real doctor command for the Channel
- `.agents/skills/build-channels-agent/SKILL.md` — the verified API surface plus
  a "common mistakes" list
- The canonical, never-stale setup workflow: <https://copilotkit.ai/channels-guide.md>

> One stale doc to know about: `docs.copilotkit.ai/slack/deploy-and-operate`
> still tells you to install `@copilotkit/channels@0.6.1` with
> `@copilotkit/runtime@1.65.0`. Use the versions in this repo's `package.json`.

## A web follow-up does not appear after refresh

Only approved Ambiguous records should survive refresh. First confirm `AMBIGUOUS_API_KEY` is set, restart `npm run dev:web`, prepare a proposal, and click **Approve & save to Ambiguous** on the page. Then refresh and use the returned record ID or **Refresh from Ambiguous**. If the provider returns no retrievable record, the persistence check has not passed. See [the web template](../apps/web/README.md#prove-a-record-survives-refresh).
