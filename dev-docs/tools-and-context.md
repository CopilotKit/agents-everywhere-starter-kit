# Tools, native UI, and approval gates

This is where rungs 2 and 3 of the Context Ladder get built. All three examples
live in `apps/channel-slack/src/`.

## Tools — `defineChannelTool`

A channel tool handler receives the **live thread**, which is what makes an
approval gate possible: the tool can stop mid-execution, post a card, and block.

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

Turns a component into a tool the agent can call to draw UI itself:

```tsx
export const BriefCard = defineChannelComponent({
  name: "brief_card",
  description: "Render a short brief as a native card.",
  parameters: z.object({ headline: z.string(), summary: z.string() }),
  render({ headline, summary }) {
    return <Message><Header>{headline}</Header><Section>{summary}</Section></Message>;
  },
});
```

Pass via `createChannel({ components: [BriefCard] })`. Registration is also what
lets handlers be recovered after a restart when a durable store is configured.

This kit ships `brief_card` and `comparison_table`. **Ship at least one** — the
setup guide gates success on a component rendering, and a global review will
notice the difference between a text bot and one that renders native cards.

## Approval gates — `awaitChoice`

`thread.awaitChoice<T>(ui)` posts a picker and blocks until someone clicks,
resolving to the clicked button's `value`. Called from inside a tool handler, it
is a hard gate: the agent is mid-tool-call and cannot proceed past a refusal.

See `confirm_action` in `apps/channel-slack/src/tools.tsx`. Button clicks are
delivered on the managed path, so this fires without extra setup.

> Inline `onClick` handlers route **in-process only** and are lost on restart.
> Handlers on a registered component with a durable store survive one — see
> `references/hitl-patterns.md` in the skill.

## Context — `ContextEntry`

`{ description, value }` pairs injected into the agent's prompt per run. Pass at
`createChannel({ context })` or per-run via `thread.runAgent({ context })`. Use it
for the things that make the agent *situated*: which channel, the caller's role,
what the surface can and cannot do.

## Memory

`thread.runAgent({ memory: { user: "read-write", project: "read" } })` grants
Intelligence Memory **for that run only**. Omitting it disables Memory — there is
no implicit access.
