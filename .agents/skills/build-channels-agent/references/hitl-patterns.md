# Human-in-the-loop patterns

A Channels agent can pause mid-run and wait for a human, then continue. There are
two mechanisms; pick by where the pause originates.

## 1. `awaitChoice` — your code asks

Use when *your code* wants to ask the user something and block on the answer.
Common for confirming an irreversible action inside a tool handler.

```tsx
import { Message, Section, Markdown, Actions, Button } from "@copilotkit/channels";
import type { Thread } from "@copilotkit/channels";

async function confirmDeploy(thread: Thread, env: string) {
  const ok = await thread.awaitChoice<boolean>(
    <Message accent="#E01E5A">
      <Section><Markdown>Deploy to **{env}**? This is irreversible.</Markdown></Section>
      <Actions>
        <Button value={true} style="primary">Ship it</Button>
        <Button value={false} style="danger">Cancel</Button>
      </Actions>
    </Message>,
  );
  return ok;
}
```

- `awaitChoice<T>(ui)` posts `ui` and **blocks** until the user activates a
  control, resolving to that control's `value` (typed as `T`).
- There are **no lowercase intrinsic tags** — this JSX runtime declares an empty
  `IntrinsicElements`, so `<b>`, `<span>`, `<div>` are compile errors. Emphasis
  goes inside `<Markdown>`.
- Because a tool handler gets the live `thread`, you can call `awaitChoice`
  directly inside `defineChannelTool(...).handler` to gate the tool on approval.

## 2. `onInterrupt` + `resume` — the agent pauses

Use when the *agent* pauses itself (e.g. a LangGraph-style interrupt during
`thread.runAgent()`). Register a handler for the interrupt, render a prompt, then
`resume` with the value the agent expects.

```ts
channel.onInterrupt<{ question: string }>("ask_human", async ({ thread, payload }) => {
  const answer = await thread.awaitChoice<string>(
    /* a <Select> or <Button> group built from payload.question */
  );
  await thread.resume(answer); // agent continues from where it paused
});
```

- The interrupt `event` name matches what the agent emits.
- `thread.resume(value)` re-enters the run loop with `value`; it returns the next
  `MessageRef` (or `undefined`).

## Why handlers survive (or don't) a restart

Interactive handlers are keyed by **content-stable IDs**:
`"ck:" + sha1(name | path | stableStringify(props)).slice(0, 16)`. The same
rendered control always produces the same ID, so a click maps back to the right
handler.

The binding itself lives in the configured store:

- Default is the in-memory `MemoryStore` — ephemeral; bindings are lost on
  restart, so a button clicked after a redeploy won't resolve.
- For durability, implement the `StateStore` interface (persist to Redis,
  Postgres, etc.) and pass it as `createChannel({ store: { adapter } })`:

  ```ts
  const channel = createChannel({
    identifyUser: "platform",
    store: {
      adapter: myRedisStore,
      actionRetentionMs: 7 * 24 * 60 * 60 * 1000, // default 7 days
    },
    components: [IssueCard], // register components so handlers can be re-bound
  });
  ```

  `createChannel({ actionStore })` still works but is **deprecated** — prefer
  `store.adapter`.
- Durability also requires registering the component via
  `createChannel({ components })`. Without registration, a click on a message
  posted before the restart degrades to "action expired".

Rule of thumb: for a demo or a short-lived prompt, in-memory is fine. For buttons
that must work hours later or across deploys, configure a durable store and use
registered components rather than one-off inline closures.
