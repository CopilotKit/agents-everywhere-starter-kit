# Demo prompts

Thirty seconds from "it's running" to "that's the demo." The example agent is an
**on-call assistant** — it lives in the channel where the incident is already
being discussed, which is the whole reason it belongs there.

## Set the scene first

The demo only works if the thread has something in it, because the point is that
the agent reads instead of asking. Paste these into a Slack thread as separate
messages before you mention the bot:

> checkout is timing out for a bunch of EU customers
> started around 02:14, right after the web deploy went out
> rolled web back, didn't help — still seeing 4s+ on /checkout
> queue depth on payments-worker is climbing

## Rung 1 — it's reachable

> @agent you around?

Proves Slack → Intelligence → your process end to end.

## Rung 2 — it's situated

> @agent catch me up

Calls `read_thread`, then `incident_card`. **The line to say out loud: nobody told
it what the incident was.** It knows the impact, the start time, that the rollback
failed, and that the queue is climbing — because it read the thread.

Then the test that separates rung 1 from rung 2:

> @agent what changed right before this started?

It answers "the web deploy at 02:14" from the thread. Delete the thread context
and the same question has no answer.

## Rung 3 — it's native

> @agent build me a timeline

Calls `timeline` and renders real Block Kit — not an ASCII table in a code fence.
This is the artifact handover and the postmortem are written from.

## The moment that wins it

> @agent restart the payments worker

The agent calls `propose_action` and **stops**. You get a card naming the blast
radius and whether it's reversible, with Approve and Hold.

**Click Hold, on camera.** An agent that visibly declines to touch production is a
better demo than one that always says yes — and an outage is exactly when people
feel entitled to skip the gate.

Then, for the durable path (needs `TRIGGER_SECRET_KEY`):

> @agent go trawl the last hour of payments-worker logs

Calls `run_deep_work`: creates a waitpoint, hands the job to Trigger.dev, posts an
approval card, and **returns immediately**. The thread stays usable while a job
that outlives the conversation waits on a human.

## Grounding (needs `EXA_API_KEY`)

> @agent is there a known issue with the Stripe API right now?

Calls `search_web`. With `showToolStatus: true` the room watches it search.

## Iterating without Slack

```bash
npm run dev:local
```

```
› you're in an on-call channel at 2am. three engineers are arguing about whether to fail over. what do you do?
```

Fastest way to tune the prompt — no Slack round trip.

## For the two-minute video

1. **Ten seconds of context.** The surface, not the tech: "this is our on-call
   channel at 2am."
2. **One mention, one native card.** `catch me up` → `incident_card`. No narration
   over dead air.
3. **The gate, declined.** `restart the payments worker` → Hold. This is the beat.
4. **Same agent, second surface.** Ten seconds of the terminal, phone, or voice —
   the "one agent, every surface" claim shown rather than asserted.
5. **Say why the context matters.** The submission asks for it in writing; say it
   out loud too: *nobody had to re-explain the outage.*
