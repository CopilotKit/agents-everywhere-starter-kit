# channels-ui component reference

All components import from `@copilotkit/channels` (the root import re-exports
them; `@copilotkit/channels/ui` is the same surface). Only import from
`@copilotkit/channels-ui` directly if you installed that package as a direct
dependency — otherwise it resolves under npm and fails under pnpm.

You describe a message as a
JSX tree and pass it to `thread.post`, `thread.update`, or `thread.awaitChoice`.
The engine lowers the tree to a platform-neutral IR (`ChannelNode[]`); each adapter
renders what its surface supports and **skips nodes it can't render** — the
renderer is total, so a rich tree degrades gracefully instead of throwing.

Children may be nested elements, strings, numbers, or conditionals
(`false` / `null` / `undefined` render nothing), plus arrays thereof.

## Layout & content components

| Component | Props | Notes |
| --- | --- | --- |
| `<Message>` | `accent?: string` (hex, e.g. `#27AE60`), `onReaction?` | Top-level wrapper; `accent` sets a colored rail. `onReaction(emoji, ctx)` fires when a user reacts. |
| `<Header>` | children | Bold title row. |
| `<Section>` | children | A block of content. |
| `<Markdown>` | children | Markdown text. |
| `<Fields>` | children (`<Field>`) | Groups key/value fields. |
| `<Field>` | `label?: string`, children | Label rendered on Slack/Discord/Teams; surfaces without field labels fall back to the value text alone. |
| `<Context>` | children | Small secondary/muted context text. |
| `<Divider />` | none | Horizontal rule. |
| `<Image>` | `url: string`, `alt?: string` | Image block. |
| `<Table>` | `columns?: { header, align? }[]`, children (`<Row>`) | |
| `<Row>` | children (`<Cell>`) | |
| `<Cell>` | children | |
| `<Chart>` | `type?`, `title?`, `xAxisTitle?`, `yAxisTitle?`, `data: {label,value}[]` | `type`: `verticalBar` (default), `horizontalBar`, `line`, `pie`, `donut`. Platforms without native charts skip the node. |

## Interactive components

| Component | Props | Notes |
| --- | --- | --- |
| `<Actions>` | children | Container for interactive controls. |
| `<Button>` | `onClick?`, `value?`, `url?`, `style?: "primary" \| "danger"` | Click dispatches `onClick(ctx)` with `ctx.action.value` typed from `value`. If `url` is set it becomes a **link button** and `onClick`/`value` are ignored. `style` is a Slack accent. |
| `<Select>` | `onSelect?`, `options: {label,value}[]`, `placeholder?`, `multi?` | `onSelect(ctx)` gets `ctx.action.value`: a `string`, or `string[]` when `multi`. Multi renders as `multi_static_select` (Slack), max-values (Discord), `isMultiSelect` (Teams); Telegram/WhatsApp degrade to single-select. |
| `<Input>` | `onSubmit?`, `placeholder?`, `multiline?`, `name?` | `onSubmit(ctx)` gets `ctx.action.value` = the entered text. |

## Modal components

A modal is a **separate IR root** (`ModalView`), not a message. Build it with
`<Modal>` and open it with `ctx.openModal(view)` from a `CommandContext` — it is
`undefined` on surfaces with no trigger for it. Submissions and dismissals route
back to `channel.onModalSubmit(callbackId, …)` / `channel.onModalClose(callbackId, …)`
by `callbackId`, **not** to inline handlers. Return `{ errors }` from a submit
handler to keep the modal open. An adapter throws `ModalRenderError` if the view
uses an element its surface can't express — unlike message rendering, this is not
skip-and-degrade.

| Component | Props | Notes |
| --- | --- | --- |
| `<Modal>` | `callbackId: string`, `title: string`, `submitLabel?`, `closeLabel?`, `notifyOnClose?`, `privateMetadata?` | The view root. `notifyOnClose` makes Slack emit `view_closed`. `privateMetadata` is an opaque string echoed back to the handlers. |
| `<TextInput>` | `id: string`, `label: string`, `placeholder?`, `multiline?`, `optional?`, `maxLength?`, `initialValue?` | Free-text field. Read it from `evt.values[id]`. |
| `<ModalSelect>` | `id: string`, `label: string`, `placeholder?`, `optional?`, `initialOption?` | Children are `<ModalSelectOption>`. `initialOption` is an option's `value`. |
| `<ModalSelectOption>` | `label: string`, `value: string` | |
| `<RadioButtons>` | `id: string`, `label: string`, `optional?`, `initialOption?` | Children are `<ModalSelectOption>`. |

### Call `Modal(...)`, don't write `<Modal>`

This JSX runtime declares `JSX.Element = ChannelNode`, so **every** JSX expression
is typed `ChannelNode` — which erases the `ModalView` narrowing that `openModal`
requires. `<Modal …/>` therefore fails under `strict`:

```
error TS2345: Argument of type 'ChannelNode' is not assignable to parameter of type 'ModalView'.
```

Call the component as a plain function and pass `children` as a prop. Its children
can still be JSX, because only the root needs to stay a `ModalView`:

```tsx
channel.onCommand("feedback", async ({ openModal }) => {
  await openModal?.(
    Modal({
      callbackId: "feedback",
      title: "Send feedback",
      submitLabel: "Send",
      children: [
        <TextInput id="body" label="What happened?" multiline />,
        <RadioButtons id="severity" label="Severity">
          <ModalSelectOption label="Blocking" value="high" />
          <ModalSelectOption label="Annoying" value="low" />
        </RadioButtons>,
      ],
    }),
  );
});

channel.onModalSubmit("feedback", async ({ values, thread }) => {
  if (!values.body) return { errors: { body: "Tell us what happened." } };
  await thread?.post(<Section>Thanks — logged it.</Section>);
});
```

`openModal` is optional on `CommandContext`, so keep the `?.` — and note `thread`
is optional on `ModalSubmitEvent` too, since a submission may arrive without a
conversation context.

## Handler context (onClick / onSelect / onSubmit / onReaction)

Inline handlers receive a context with (at least) `{ action, thread, messageRef, user }`:

- `action.value` — the value echoed back (typed from the `value`/selection).
- `thread` — the live thread, so a handler can `thread.post(...)`,
  `thread.update(messageRef, ...)`, or run a HITL flow.
- `messageRef` — a ref to the message the control lives in (for `update`).

```tsx
<Actions>
  <Button value="approve" style="primary"
    onClick={async ({ action, thread, messageRef }) => {
      await thread.update(messageRef, <Section>Approved ✓</Section>);
    }}>
    Approve
  </Button>
  <Select
    placeholder="Pick an environment"
    options={[{ label: "Staging", value: "staging" }, { label: "Production", value: "production" }]}
    onSelect={async ({ action, thread }) => {
      await thread.post(<Section>Selected {String(action.value)}</Section>);
    }}
  />
</Actions>
```

## Durability of handlers

Inline `onClick`/`onSelect` handlers are bound by **content-stable IDs** — a hash
of the component's name, path, and props. A button clicked long after it was
posted still resolves to the right handler *as long as the binding still exists*.

- Inline handlers route **in-process only** — they're lost on restart.
- Handlers on a **registered component** (`createChannel({ components })`) with a
  durable store configured (`createChannel({ store: { adapter } })`) survive a
  restart. See `hitl-patterns.md` for the store.

## Choosing components

- Announce/inform → `<Message>` + `<Header>`/`<Section>`/`<Markdown>`/`<Fields>`.
- Offer discrete choices → `<Actions>` with `<Button>`s (or `awaitChoice`).
- Free text / options list → `<Input>` / `<Select>`.
- Structured data → `<Table>` or `<Chart>`.

Do not invent components or props beyond this list — a made-up tag will not lower
to a valid IR node.
