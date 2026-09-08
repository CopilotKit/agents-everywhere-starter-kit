# Setup

## Tier 0 — one credential, one process (~5 min)

```bash
npm install
cp .env.example .env      # then paste an OPENAI_API_KEY
npm run dev
```

With no Channel configured, `npm run dev` starts the **local surface** — the same
agent in your terminal. Use it to iterate on the prompt and the model with a
sub-second loop instead of a Slack round trip.

```
› recap what you can do
```

`npm run check-env` at any point prints a numbered list of what is missing.

## Tier 1 — the agent lives in Slack (~15 min)

No tunnel. No ngrok. No public URL of your own. Intelligence hosts the provider
webhook and dials your process over an outbound websocket.

**Fastest path — let your coding agent drive the consoles:**

```bash
npm run channel:setup      # npx copilotkit@latest channels setup
```

That installs a skill, prints a prompt, and copies it to your clipboard. Paste it
into Claude Code or Cursor. It drives the Slack and Intelligence consoles in your
own signed-in session; you type the secrets, it does the clicking.

**By hand:**

1. **Create the Channel first.** The wizard generates a Slack app manifest already
   pointed at the correct request URL, so doing this second means creating the
   wrong app.

   ```bash
   npx copilotkit@latest channels add --name my-agent \
     --display-name "My Agent" --adapter slack --json
   ```

2. Put the Channel **Code** in `CHANNEL_CODE`. It must match character for
   character: lowercase letters and digits, single hyphens, starting with a
   letter, 3–64 chars, never the literal `channels`.

3. Create a project-scoped key under **API Keys** in the Intelligence sidebar →
   `INTELLIGENCE_API_KEY`.

4. `npm run dev` now starts the Channels listener instead of the local surface.

5. In Slack: `/invite @yourbot` into a channel, then @-mention it. **Workspace-
   installed is not the same as channel member** — Slack emits no `app_mention`
   event at all for a channel the app is not in.

`npm run channel:status` is a real doctor command. Use it before you start
guessing.

## Tier 2 — opt-in

Each of these is one env var and one file. Pick two, not six.

| Add | Gets you |
|---|---|
| `EXA_API_KEY` | grounded web search as an agent tool |
| `OPENROUTER_API_KEY` | model failover — see [model-switching.md](model-switching.md) |
| `AMBIGUOUS_API_KEY` | a 17-app workplace to act in (`npx ambiguous auth signup`) |
| `TRIGGER_SECRET_KEY` | durable work + waitpoint approvals |

## Requirements

- **Node.js 22+.** Channels needs global `WebSocket`. `nvm use` reads `.nvmrc`.
- A CopilotKit Intelligence project (free tier) for tier 1. There is no DIY path
  — Intelligence owns the platform credentials and delivery.
