# Durable work and the two-tier approval

A Slack turn is a request/response cycle. Anything that takes ten minutes,
survives a restart, or needs retries does not belong inside it — and this is the
one thing a Channels listener genuinely cannot do on its own.

## The two tiers, and why there are two

| Tier | Mechanism | For |
|---|---|---|
| **In-thread** | `confirm_action` → `thread.awaitChoice` blocks the tool | cheap, reversible, seconds |
| **Durable** | `run_deep_work` → Trigger.dev waitpoint | slow, expensive, outlives the conversation |

The second one inverts the usual shape. Instead of the chat turn blocking while
work happens, **the work blocks while the human decides** — and the thread stays
live the whole time.

```
channel tool   wait.createToken()  ─────────────▶  a 30-minute waitpoint
               tasks.trigger("deep-work")  ─────▶  task parks on wait.forToken()
               thread.post(<approval card/>)
               return immediately                  ← the agent does NOT wait

human taps     wait.completeToken(id, { approved, decidedBy })

the task       wakes up, does the long thing, and reports back
```

## Setup

```bash
cd apps/durable
npx trigger.dev@latest dev
```

Two env vars, both in the root `.env`:

```dotenv
TRIGGER_SECRET_KEY=tr_dev_...      # "Trigger only" access, Development env
TRIGGER_PROJECT_REF=proj_...       # from the Trigger.dev dashboard
```

Without `TRIGGER_SECRET_KEY` the `run_deep_work` tool is **not registered at
all** — the agent is never handed a tool that would fail when it called it. The
pre-flight check says so rather than leaving you guessing.

## Things worth knowing

- **Import from `@trigger.dev/sdk`, never `@trigger.dev/sdk/v3`**, and never
  `client.defineJob()` — that is the deprecated v2 API.
- **Trigger tasks with a type-only import** (`import type { deepWork }`) so the
  task's code never gets bundled into the listener.
- **The waitpoint carries the decision, not just a signal.** Completing it with
  `{ approved, decidedBy }` means the durable task has an audit trail without a
  second lookup.
- **Credit the clicker, not the asker.** The `onClick` context carries its own
  `user`, which is not necessarily whoever prompted the agent.
- **`InteractionContext` has no `messageRef`.** It carries `thread`, `message`,
  `action`, `values`, `user`, `actor`, `platform` and an optional `openModal` —
  despite what the UI reference implies. To edit the card you posted, keep the
  `MessageRef` that `thread.post()` returned in a binding the handler closes
  over, which is what `apps/channel-slack/src/durable.tsx` does.
- **Inline handlers route in-process only** and are lost on restart. For
  approvals that must survive a deploy, register the component via
  `createChannel({ components })` and configure a durable store.

## The last mile: out-of-band approval

For actions where "somebody clicked a button in a channel" is not a strong enough
claim about *who* approved, the same waitpoint should be completed by an
out-of-band approval on the person's own device — Auth0 CIBA.

`apps/durable/src/approvals.ts` is that seam, and it is deliberately a **throwing
stub rather than a plausible guess**. The flow is clear (POST `/bc-authorize`,
get an `auth_req_id`, poll `/oauth/token`), but the exact parameter set —
`binding_message`, the `login_hint` format, `audience`, the `grant_type` URN —
and the polling error codes are not in the overview docs, and writing those from
memory is how you get an integration that 400s for reasons nobody can see.

Read [Auth0's async authorization quickstart](https://auth0.com/ai/docs/get-started/asynchronous-authorization),
then complete the waitpoint from your callback:

```ts
await wait.completeToken(tokenId, { approved: true, decidedBy: sub });
```

The durable task is already waiting on it. Nothing else in the chain changes.
