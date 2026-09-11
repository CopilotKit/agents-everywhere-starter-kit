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

## A delivered Slack card still says “working”

A visible card alone does not prove the native status cleared. With the pinned Channels `0.9.2`, the offline managed-delivery regression exercises a real AG-UI search, an incident card, and an agent finish without prose. It verifies empty `slack.thread.status` effects, stream closure, and a final complete terminal packet in sequence. Run it with `npm test --workspace channel`.

This does not verify Slack applied those effects. The SDK treats native status updates as best effort and logs a rejected clear with `[slack-renderer] setStatus failed:` via `console.debug`. Preserve raw runtime stdout/stderr when reproducing; this console diagnostic is independent of `LOG_LEVEL`. Set `LOG_LEVEL=info` or `debug` to retain the runtime's transport warnings too. Correlate the affected delivery's status-clear and terminal acknowledgements in Intelligence, especially after `packet_out_of_order`.

The pinned renderer also has a retry gap: a rejected clear after starting a native stream can leave its internal “reply posted” flag set, so later finish callbacks can skip another clear. Subsequent tool events can change that path; it is not a confirmed explanation for the live multi-tool trial. This template has no public `Thread.setStatus` hook, and this change does not claim to fix the lingering indicator or change the paired SDK/runtime pins.

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
