# OpenRouter — global sponsor

AI gateway + model marketplace. One API, hundreds of models across providers. The pitch for a hackathon: **you don't get rate-limited into a corner, and you can swap models mid-demo without touching code.**

## Verified surface

- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Auth:** `Authorization: Bearer $OPENROUTER_API_KEY`
- **OpenAI SDK drop-in:** point `baseURL` at OpenRouter and keep the OpenAI client
- **Model slug format:** `provider/model`, plus **latest aliases** like `~openai/gpt-latest` that auto-update
- **Model discovery:** `GET /api/v1/models` (programmatic — good for a model-picker in a demo)
- **Attribution headers:** `HTTP-Referer` (your site URL) and `X-OpenRouter-Title` (your site name) for the public rankings. *Note the header is `X-OpenRouter-Title`, not the older `X-Title`.*

## SDKs (npm-verified 2026-09-08)

| Option | Package | Version |
|---|---|---|
| TypeScript SDK | `@openrouter/sdk` | **1.2.108** |
| Python SDK | `openrouter` | — |
| Agent SDK | higher-level multi-turn tool loops + state | — |
| Raw HTTP | any language | — |

## Features that matter on the day

- **Automatic cost-optimized routing** and **provider fallbacks** — if a provider is down mid-demo, the request still lands. This is real insurance for a live show-and-tell.
- Streaming, tool calling, structured outputs, prompt caching, BYOK
- Free models exist (details in their FAQ) — worth checking on the morning for a no-credit-card path

```python
import requests, json
requests.post(
  "https://openrouter.ai/api/v1/chat/completions",
  headers={"Authorization": f"Bearer {KEY}"},
  data=json.dumps({
    "model": "~openai/gpt-latest",
    "messages": [{"role": "user", "content": "..."}],
  }),
)
```

Docs: [openrouter.ai/docs/quickstart](https://openrouter.ai/docs/quickstart) · models: [openrouter.ai/models](https://openrouter.ai/models)

## How the kit should use it

Make OpenRouter the **one-line model swap** story, not a separate template. CopilotKit's runtime supports custom model routers, and `BuiltInAgent`'s `openai:` prefix pattern means an OpenAI-compatible base URL is the natural seam. Ship a documented `MODEL_PROVIDER=openai|openrouter` switch so a team that runs out of OpenAI credits at 14:00 does not lose the day.
