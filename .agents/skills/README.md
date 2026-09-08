# Skills

One copy, symlinked. `.claude/skills` and `.cursor/skills` both point here, so
there is nothing to keep in sync.

- **`build-channels-agent`** — the verified Channels API surface: `createChannel`,
  handlers, the Thread API, `defineChannelTool`, the JSX vocabulary, HITL, and a
  "common mistakes" list that will save you an hour. Vendored from
  [CopilotKit/channels-sdk](https://github.com/CopilotKit/channels-sdk).

To add the rest of the CopilotKit skills (setup, develop, integrations, debug,
upgrade, agui):

```sh
npx skills add copilotkit/skills --full-depth -y
```

To install the Slack setup workflow as a skill in whatever coding agent you are
already running:

```sh
npx copilotkit@latest skills install --skill setup-slack-channel -y
```

`.mcp.json` at the repo root also wires the CopilotKit docs MCP server and Exa's
hosted MCP into your coding agent, so it can look things up live rather than
guessing at an API.
