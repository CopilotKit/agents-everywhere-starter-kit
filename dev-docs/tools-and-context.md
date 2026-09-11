# Tools, native UI, and approval gates

The channel template uses CopilotKit Channels for tools, conversation context, and native UI. The examples below live in `apps/channel/src/`.

## Tools — `defineChannelTool`

A channel tool handler receives the **live thread**, so it can post native UI
and return a result to the agent. Managed deliveries finish without waiting for
a later button click.

```ts
const getOncall = defineChannelTool({
  name: "get_oncall",
  description: "Look up who is currently on call for a team.",
  parameters: z.object({ team: z.string() }),
  async handler({ team }, { thread, user, actor, signal, platform }) {
    return await fetchOncall(team);
  },
});
```

Register via `createChannel({ tools })`.

**The return value is what the agent reads back, not what the user sees.** Return
raw data — it is JSON-stringified for you. Do not hand-stringify, and do not
return `{ ok: true }`. For a tool that posts a card, return a short confirmation
like `"Displayed the issue card."` so the model does not restate it. On failure,
return the actual error text so the model can repair and retry.

`maxSteps` on the agent must be greater than 1 or the agent calls one tool and
stops before it sees the result. The kit sets 10.

## Native UI — Channels JSX

One tree renders as Slack Block Kit, Teams Adaptive Cards, and Discord
components. A surface that cannot render a node **skips it** rather than
failing, so rich UI degrades instead of erroring.

Files with JSX must be `.tsx`, and the tsconfig must set
`jsxImportSource: "@copilotkit/channels"`. This is not React.

Vocabulary: `Message` `Header` `Section` `Markdown` `Fields`/`Field` `Context`
`Divider` `Image` `Table`/`Row`/`Cell` `Chart` `Actions` `Button` `Select`
`Input`, plus modal components. **Do not invent tags or props** — see
`.agents/skills/build-channels-agent/references/ui-components.md` for the full
list. A made-up tag does not lower to a valid IR node.

## Agent-rendered components — `defineChannelComponent`

Turns a component into a tool the agent can call to draw UI itself. This minimal
illustration is smaller than the incident schema shipped in `components.tsx`:

```tsx
export const IncidentCard = defineChannelComponent({
  name: "incident_card",
  description: "Render a short brief as a native card.",
  parameters: z.object({ headline: z.string(), summary: z.string() }),
  render({ headline, summary }) {
    return <Message><Header>{headline}</Header><Section>{summary}</Section></Message>;
  },
});
```

Pass via `createChannel({ components: [IncidentCard] })`. Registration is also what
lets handlers be recovered after a restart when a durable store is configured.

This kit ships `incident_card` and `timeline`. Use a native artifact when it makes
the incident easier to understand. Evaluate the resulting interaction using the
[official judging criteria](../hackathon-overview.md#judging-criteria).

## Managed action proposals

`propose_action` uses `thread.post()` with inline `onClick` handlers. It posts a
native card and immediately returns **decision pending**, instructing the agent
to stop without calling write tools. On a later delivery, **Approve** replaces
the card with “Approved proposal. No action was executed.” **Hold** reports that
nothing ran and the action must not be taken. Neither click resumes the agent.
This is a proposal demo, not a production executor or a hard authorization gate
around arbitrary MCP writes.

The installed managed adapter sets `supportsBlockingChoice: false`:
`thread.awaitChoice()` rejects before posting a card. Use blocking `awaitChoice`
only with adapters that support it. Agents that emit interrupts can instead use
`onInterrupt` plus `Thread.resume()` on a later interaction delivery; this kit's
BuiltInAgent proposal tool does not implement that continuation flow.

Run **one listener instance**, and keep it running until the click. Inline
handlers are process-local and cannot be recovered after a restart or by another
replica. To support replicas, use reconstructible registered-component handlers
with shared persistent action bindings; a durable store alone cannot restore an
inline closure.

## Context — `ContextEntry`

`{ description, value }` pairs injected into the agent's prompt per run. Pass at
`createChannel({ context })` or per-run via `thread.runAgent({ context })`. Use it
for the things that make the agent *situated*: which channel, the caller's role,
what the surface can and cannot do.

## Memory

`thread.runAgent({ memory: { user: "read-write", project: "read" } })` grants
Intelligence Memory **for that run only**. Omitting it disables Memory — there is
no implicit access.
