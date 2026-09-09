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
npm run check-env
npm run dev
```

With no Channel configured, `dev` starts terminal chat. The terminal has your selected model and prompt, but no thread-history, native-card, or Exa search tools. For the sample incident workspace, run `npm run dev:web` and open the URL printed by Next.js.

## Add Slack

Intelligence manages platform credentials and delivers over an outbound socket. Your listener stays running; no public tunnel is needed.

```bash
npm run channel:setup
```

Follow the setup instructions it prints. Alternatively, create the Channel **before** the Slack app so the wizard can generate the correct manifest:

```bash
npx copilotkit@latest channels add --name my-agent \
  --display-name "My Agent" --adapter slack --json
```

1. Complete the platform setup and installation.
2. Copy the Channel **Code** into `CHANNEL_CODE` in root `.env`.
3. Create a project-scoped Intelligence API key and set `INTELLIGENCE_API_KEY`.
4. Run `npm run dev`; with the Channel configured this starts its listener.
5. In Slack, `/invite @yourbot`, then mention it inside a thread.

```bash
npm run channel:status
```

Use a separate Intelligence project for local and deployed listeners. Two listeners sharing a Channel can compete for deliveries. See [troubleshooting](troubleshooting.md).

## Add one useful capability

[Choose a sponsor recipe](sponsors.md): Exa search, Trigger.dev research, an Ambiguous AI follow-up, a protected Auth0 action, or a Mozilla agent trace. Each has its own prerequisites; adding a key does not configure every service.

## Verify offline, then prove the live path

```bash
npm run verify
```

This needs no `.env` and makes no live sponsor calls. It checks workspace types, tests, and the MCP stdio protocol. Run `npm run check-env` separately for configured startup, then demonstrate an actual reply and the sponsor result you plan to show. [Demo prompts](demo-prompts.md)
