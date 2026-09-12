# Skills

One copy, symlinked. `.claude/skills` and `.cursor/skills` both point here, so
there is nothing to keep in sync.

- **`build-channels-agent`** — the verified Channels API surface: `createChannel`,
  handlers, the Thread API, `defineChannelTool`, the JSX vocabulary, HITL, and a
  "common mistakes" list that will save you an hour. Vendored from
  [CopilotKit/channels-sdk](https://github.com/CopilotKit/channels-sdk).

Use [the onboarding paths in the root README](../../README.md#copilotkit-onboarding)
for account/project setup and a verified integration. To install the current
CopilotKit development skills without starting onboarding:

```sh
npx --yes copilotkit@latest skills install -y
```

To install the maintained Channels setup skill and print its onboarding prompt:

```sh
npm run channel:setup -- --no-clipboard
```

Continue with the emitted prompt in the same coding-agent session. Select Slack
and connect `apps/channel`; the installed skill is named `channels-setup`.
It handles provisioning, while the bundled `build-channels-agent` skill documents
the tested SDK APIs. Installing skills alone does not connect the app.

`.mcp.json` at the repo root also wires the CopilotKit docs MCP server and Exa's
hosted MCP into your coding agent, so it can look things up live rather than
guessing at an API.
