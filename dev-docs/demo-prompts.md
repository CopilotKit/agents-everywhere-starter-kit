# Demo prompts

Thirty seconds from "it's running" to "that's the demo." Invite the bot to a
channel, @-mention it, and try these in order.

## Rung 1 — it's reachable

> @agent are you there?

Proves delivery end to end. If this works, Slack → Intelligence → your process
is wired.

## Rung 2 — it's situated

Paste three or four messages of a fake discussion into a thread first, then:

> @agent recap this thread for someone who just joined

This calls `read_thread`. The demo point is the one to say out loud: **nobody
told it what the thread was about.** Delete the context and the answer changes —
that is the difference between rung 1 and rung 2.

## Rung 3 — it's native

> @agent compare the four surfaces from the hackathon brief as a table

Calls `comparison_table` and renders real Block Kit — not an ASCII table in a
code fence. Then:

> @agent summarise where we landed as a card, with next steps

Calls `brief_card`. Watch the accent rail change with the tone.

## The approval gate

> @agent post this recap to #general

The agent calls `confirm_action` first and stops. You get a card with Approve and
Cancel, and it cannot proceed until someone clicks. **Click Cancel on camera** —
a bot that visibly declines to act is a better demo than one that always says
yes.

## Grounding (needs `EXA_API_KEY`)

> @agent what shipped in the CopilotKit Channels SDK, and when?

Calls `search_web`. With `showToolStatus: true` the audience watches it search.

## Local surface

For iterating on the prompt without a Slack round trip:

```bash
npm run dev:local
```

```
› you're in a Slack thread with three engineers arguing about a rollback. what do you do?
```

Good for tuning tone before you demo it.

## For the two-minute video

1. **Ten seconds of context.** The surface, not the tech. "This is our on-call
   channel at 2am."
2. **One mention, one native card.** No narration over dead air.
3. **The approval gate, declined.** This is the beat that separates you.
4. **Same agent, second surface.** Terminal, phone, or voice — the "one agent,
   every surface" claim, shown rather than asserted.
5. **Say why the context matters.** The submission asks for it explicitly.
