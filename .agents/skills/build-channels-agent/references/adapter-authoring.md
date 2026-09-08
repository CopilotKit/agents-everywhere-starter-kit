# Writing a PlatformAdapter

Read this only when the task is specifically "add Channels support for platform
X" (a surface with no existing adapter). For normal Channel building you never touch
this — you consume an adapter like `@copilotkit/channels-slack`.

An adapter is the only platform-specific code. It translates between a platform's
API and the engine's neutral message IR, so Channel logic (handlers, tools, JSX)
stays unchanged across surfaces.

## The `PlatformAdapter` contract

Implement these responsibilities:

### Ingress — report inbound events to the engine

`start(sink: IngressSink)` receives a sink you call to report:

- inbound **turns** (mentions / messages),
- **interactions** (button clicks, select/input submissions),
- **commands** (slash commands),
- **thread-started** events.

Decode raw platform payloads into these before handing them to the sink.

### Egress — render the IR

Given `ChannelNode[]` (the lowered JSX tree), render to the platform:

- `post(target, nodes)` → create a message, return a `MessageRef`.
- `update(ref, nodes)` → edit an existing message.
- `stream(target, src)` → stream tokens (progressively edit a message).
- `delete(ref)` → remove a message.

Map each IR node type (`message`, `section`, `actions`, `button`, `select`,
`table`, `chart`, …) to the platform's native construct. **Skip node types the
surface can't express** — the renderer must be total, never throw on an
unsupported node. That's what makes cross-platform degradation work.

### Agent streaming

`createRunRenderer(target)` returns a renderer the engine drives while an agent
run streams, so intermediate steps show up live.

### Decoding & lookup

- `decodeInteraction(raw)` → turn a raw interaction payload into the engine's
  interaction shape (must recover the content-stable action ID).
- `lookupUser(id)` → resolve a platform user to the engine's user shape.
- `conversationStore` → persist/restore conversation identity.

### Capabilities

Declare a `capabilities` object so the engine and Channels can feature-detect.
Optional capability methods to implement when the platform supports them:

- `getMessages` — read conversation history (`thread.getMessages()`).
- `postFile` — upload files.
- `setSuggestedPrompts` — suggested follow-ups.
- `setThreadTitle` — rename the surface.
- `registerCommands` — register slash commands with the platform.

## Reference implementation

`@copilotkit/channels-slack` is the canonical, complete adapter. Read its source
before writing a new one — it shows the full ingress/egress/decode/capabilities
wiring against a real platform (Block Kit rendering, interaction payload
decoding, socket-mode ingress).

## Testing an adapter

Because the engine is platform-agnostic, you can exercise a new adapter with the
same Channel you'd run on Slack: swap the adapter in `createChannel({ adapters: [...] })`
and confirm each IR node type renders (or degrades) correctly, that interactions
round-trip back to their handlers, and that the content-stable IDs survive the
decode path.
