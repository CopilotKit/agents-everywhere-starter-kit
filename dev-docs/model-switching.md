# Choose a model provider

All three templates support OpenAI directly or OpenRouter. Set `MODEL_PROVIDER` explicitly so another saved credential cannot change your provider. Edit the existing model settings in the chosen file, then restart the app.

| Template | Environment file | Start from the repository root |
| --- | --- | --- |
| [Slack](../templates/slack.md) | Root `.env` | `npm run dev:slack` |
| [Web](../templates/web.md) | Root `.env` | `npm run dev:web` |
| [WhatsApp](../templates/whatsapp.md) | `apps/whatsapp/.env` | `npm start --prefix apps/whatsapp` |

Slack and web share model settings. WhatsApp reads its own file. Keep each template's other sponsor settings alongside the model configuration.

## OpenAI

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-4.1-mini
```

Obtain a key from [OpenAI](https://platform.openai.com/api-keys). `MODEL` is a model ID available to your account. All three templates accept a bare OpenAI name or a matching `openai/` or `openai:` prefix. Only the selected provider's key is required.

## OpenRouter

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MODEL=openai/gpt-4.1-mini
```

Obtain a key from [OpenRouter](https://openrouter.ai/keys) and choose an available [publisher/model slug](https://openrouter.ai/models), such as [openai/gpt-4.1-mini](https://openrouter.ai/openai/gpt-4.1-mini). No OpenAI key is required for this chat path. Bare model names receive `openai/`; suffixes such as `:free` are preserved. Access, support, and pricing depend on the chosen account and model.

- **Slack and web:** choose a model with tool calling. CopilotKit still supplies thread/page context and tools; Exa research and the Ambiguous approval flow keep their existing integrations. The shared adapter uses OpenRouter's Chat Completions endpoint. Optional `PUBLIC_APP_URL` and `APP_TITLE` configure attribution headers.
- **WhatsApp:** choose a model/provider endpoint with [structured-output support](https://openrouter.ai/docs/guides/features/structured-outputs). OpenAI Agents SDK uses Chat Completions at `https://openrouter.ai/api/v1` with a strict proposal schema and `provider.require_parameters=true`. Unsupported endpoints fail; malformed proposals are rejected. Auth0 still verifies identity and approval before any protected write. The direct OpenAI path uses the SDK's Responses model.

For Slack/web, run `npm run check-env` before starting. WhatsApp validates its separate environment at startup. A missing selected key is an error even when the other provider's key is present; there is no fallback to another provider.

Run the same workflow with each provider: earlier thread context and Exa sources in Slack, page context and proposal/approval in web, linked identity and phone approval in WhatsApp. Record actual results separately from the [offline adapter tests](template-validation.md). The existing screenshots do not establish live OpenRouter verification.

## Existing configurations and defaults

**Slack/web:** without `MODEL_PROVIDER`, an `OPENROUTER_API_KEY` selects OpenRouter. Otherwise the prefix in `MODEL` selects a provider, defaulting to OpenAI. The existing default model remains `gpt-5.6-sol`; set `MODEL` to an available catalog slug when using OpenRouter. Existing `anthropic/` and `google/` prefixes remain supported with `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY`. An explicit non-router provider must match the model prefix; unsupported providers fail with a configuration error.

**WhatsApp:** without `MODEL_PROVIDER`, OpenAI remains the default even if an OpenRouter key is present. `MODEL` takes precedence over the legacy `OPENAI_MODEL` setting. If neither is set, the default is `gpt-4.1-mini` for OpenAI or `openai/gpt-4.1-mini` for OpenRouter. Set `MODEL_PROVIDER=openrouter` to switch. WhatsApp supports these two providers; access to other publishers goes through OpenRouter.

The browser's `/voice` route uses OpenAI Realtime independently of chat selection. It always needs `OPENAI_API_KEY`; use `npm run check-env -- --voice` before testing it. The MCP server supplies tools to a host and does not use this model resolver.

## Bring another agent backend

The shared factory in [agent.ts](../packages/agent-core/src/agent.ts) can return an `HttpAgent` pointed at your AG-UI endpoint. Validate context and tool support on each surface you use; voice and the standalone MCP server follow separate paths.
