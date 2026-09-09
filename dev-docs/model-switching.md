# Choose a model provider

Set `MODEL_PROVIDER` explicitly in root `.env` so another saved credential cannot change your chat provider.

## OpenAI

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
```

Obtain a key from [OpenAI](https://platform.openai.com/api-keys). `MODEL` is a model ID available to your account. The kit accepts a bare OpenAI name or a matching `openai/` or `openai:` prefix.

## OpenRouter

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MODEL=openai/gpt-5.6-sol
```

Obtain a key from [OpenRouter](https://openrouter.ai/keys) and choose an available [publisher/model slug](https://openrouter.ai/models). No OpenAI key is required for this chat path. Re-run the same incident prompt to compare model behavior; check source use and tool results as well as answer quality.

The adapter uses OpenRouter's OpenAI-compatible chat-completions endpoint. Bare model names receive `openai/`; provider separators are normalized while suffixes such as `:free` are preserved. Optional `PUBLIC_APP_URL` and `APP_TITLE` configure attribution headers.

```bash
npm run check-env
npm run dev
```

Restart the app after editing `.env`. Provider availability, tool support, access and pricing depend on the chosen account and model.

## Existing configurations

With `MODEL_PROVIDER` absent, an `OPENROUTER_API_KEY` selects OpenRouter. Otherwise the prefix in `MODEL` selects a provider, defaulting to OpenAI. Existing `anthropic/` and `google/` prefixes remain supported with `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY`. An explicit non-router provider must match the model prefix; unsupported providers fail with a configuration error.

The browser's `/voice` route uses OpenAI Realtime independently of chat selection. It always needs `OPENAI_API_KEY`; use `npm run check-env -- --voice` before testing it. The MCP server supplies tools to a host and does not use this model resolver. The Mozilla example has its own Python configuration.

## Bring another agent backend

The shared factory in [agent.ts](../packages/agent-core/src/agent.ts) can return an `HttpAgent` pointed at your AG-UI endpoint. Validate context and tool support on each surface you use; voice and the standalone MCP server follow separate paths.
