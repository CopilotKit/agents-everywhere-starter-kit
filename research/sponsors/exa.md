# Exa — developer infrastructure partner

Search infrastructure built for agents: find, retrieve, and synthesize web content from natural-language queries.

## API surface (verified [exa.ai/docs](https://exa.ai/docs/reference/search-api-guide), 2026-09-08)

Endpoints: `/search`, `/contents`, `/answer`, `/findSimilar`, `/research`, `/websets`

**Search types are a latency dial** — this is the detail that makes or breaks a demo:

| Type | Latency | Use |
|---|---|---|
| `instant` | ~250ms | **real-time chat / voice** |
| `fast` | ~450ms | speed-first queries |
| `auto` | ~1s | default |
| `deep-lite` | 4s | lightweight synthesis |
| `deep` | 4–15s | multi-step reasoning |
| `deep-reasoning` | 12–40s | advanced research |

For a Slack bot or a voice agent, `instant`/`fast` are the only viable choices. `deep-reasoning` at 40s inside a Slack thread reads as broken.

Other features: token-efficient `highlights` (~4000 chars recommended) vs full text; `output_schema` for structured JSON extraction; category filters over specialized indexes (50M+ companies, 1B+ people, 350M+ publications, news, financial reports); domain/path include-exclude.

## Install

```bash
pip install exa-py      # Python
npm install exa-js      # TS — v2.19.0
```

```python
from exa_py import Exa
exa = Exa()  # reads EXA_API_KEY
result = exa.search("...", type="auto", contents={"highlights": True})
```

Key from [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys) → `EXA_API_KEY`.

## MCP server

**Hosted:** `https://mcp.exa.ai/mcp`

Default tools: `web_search_exa`, `web_fetch_exa`. Optional via query param: `agent_run`, `web_search_advanced_exa` —
`https://mcp.exa.ai/mcp?tools=agent_run,web_search_advanced_exa`

```bash
claude mcp add --transport http exa https://mcp.exa.ai/mcp
codex mcp add exa --url https://mcp.exa.ai/mcp
```

Free plan covers casual use with rate limits; add `x-api-key` header for production.

> **Docs note worth honoring:** Exa explicitly tells coding agents to use the [Dashboard Onboarding flow](https://dashboard.exa.ai/onboarding) to generate integration code rather than hand-rolling from reference docs, because parameter mistakes are common. The kit should link that, not paraphrase the params.

## Role in the kit

Exa is the **grounding layer** for every surface — the thing that makes "an agent that lives in your Slack" actually useful rather than a hallucinating chatbot. Wire it as an agent tool in the shared agent core so all templates inherit it. Doc index: [exa.ai/docs/llms.txt](https://exa.ai/docs/llms.txt)
