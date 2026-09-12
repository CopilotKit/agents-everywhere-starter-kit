# Setup

## Start with one model provider

Requires Node.js 22+. From the repository root:

```bash
npm install
cp .env.example .env
```

Edit `.env` using one provider:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
```

Or use OpenRouter, without an OpenAI key:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MODEL=openai/gpt-5.6-sol
```

Select an available model in your provider account. Restart after changing configuration. See [model switching](model-switching.md) for precedence and legacy provider prefixes.

```bash
npm run dev:web
```

`npm run dev` is an alias for the web template. Open `http://127.0.0.1:3100` or `http://localhost:3100`. The web follow-up approval server is loopback-only by default because it can use local Ambiguous credentials. For the React Native template, the same command starts the mobile runtime endpoint; simulators can use the documented localhost/emulator URLs, while physical devices need a deliberate reachable host or deployment.

## Add Slack

Intelligence manages platform credentials and delivers over an outbound socket. Your listener stays running; no public tunnel is needed.

```bash
npm run channel:setup -- --no-clipboard
```

This installs the current `channels-setup` skill and prints the official prompt. Continue with that prompt in your coding agent, selecting **Slack** and the existing `apps/channel` app. Let the agent follow the skill through setup and verify a real Slack reply. The command itself does not authenticate or provision the Channel. See [CopilotKit onboarding](../README.md#copilotkit-onboarding) for this handoff and the web onboarding prompt; follow the [mobile README](../apps/mobile/README.md#get-started) for Expo setup.

For manual setup, create the Channel **before** the Slack app so the wizard can generate the correct manifest:

```bash
npx copilotkit@latest channels add --name my-agent \
  --display-name "My Agent" --adapter slack --json
```

1. Complete the platform setup and installation.
2. Copy the Channel **Code** into `CHANNEL_CODE` in root `.env`.
3. Create a project-scoped Intelligence API key and set `INTELLIGENCE_API_KEY`.
4. Run `npm run dev:slack` to start the Channel listener.
5. In Slack, `/invite @yourbot`, then mention it inside a thread.

```bash
npm run channel:status
```

Use a separate Intelligence project for local and deployed listeners. Two listeners sharing a Channel can compete for deliveries. See [troubleshooting](troubleshooting.md).

## Add one useful capability

Choose the tools your [template](../README.md#templates) needs, then follow [using-sponsor-tools.md](../using-sponsor-tools.md) for authentication, configuration, and a first call. Each integration has its own prerequisites.

## Verify offline, then prove the live path

```bash
npm run verify
```

This needs no `.env` and makes no live sponsor calls. It checks retained workspace types and offline tests. Each app reports missing provider or surface credentials when the relevant integration is used; demonstrate an actual reply and the sponsor result you plan to show. [Demo prompts](demo-prompts.md)
