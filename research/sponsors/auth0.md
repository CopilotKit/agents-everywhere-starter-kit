# Auth0 — developer infrastructure partner

Identity for agents. Docs live at [auth0.com/ai/docs](https://auth0.com/ai/docs) (index: [llms.txt](https://auth0.com/ai/docs/llms.txt)).

## Four capabilities, and which ones matter for this hackathon

| Capability | What it does | Fit here |
|---|---|---|
| **User authentication** | Universal Login, OAuth 2.0 / OIDC, social + enterprise IdPs, for interactive *and headless* agents | Medium — most templates already have a platform identity |
| **Token Vault** (delegated API access) | Agent calls third-party APIs *on the user's behalf* — obtains, stores, refreshes credentials for Google, Slack, GitHub etc. without exposing keys. 30+ integrations. | **High** — this is the honest answer to "how does the Slack bot read *my* calendar, not a service account's" |
| **Async authorization (CIBA + PAR)** | Human-in-the-loop approval for sensitive operations via push notification, SMS, or email | **Highest** — the *In your pocket* surface, and a real answer to agent safety |
| **FGA for RAG** | Document- and relationship-level access control so an LLM only retrieves what the asker may see | High for anything touching internal docs |

## Packages and stacks

SDK pages: [javascript-sdk](https://auth0.com/ai/docs/sdks/javascript-sdk.md) · [python-sdk](https://auth0.com/ai/docs/sdks/python-sdk.md) · [langchain-sdk](https://auth0.com/ai/docs/sdks/langchain-sdk.md) · [llamaindex-sdk](https://auth0.com/ai/docs/sdks/llamaindex-sdk.md) · [vercel-ai-sdk](https://auth0.com/ai/docs/sdks/vercel-ai-sdk.md) · [cloudflare-sdk](https://auth0.com/ai/docs/sdks/cloudflare-sdk.md) · [genkit-sdk](https://auth0.com/ai/docs/sdks/genkit-sdk.md)

`@auth0/ai` is at **6.0.2** on npm (2026-07-14). Quickstarts exist for Next.js, FastAPI, Vercel AI, LangGraph, and Cloudflare Agents.

There is also an MCP section: [auth0.com/ai/docs/mcp/intro/overview.md](https://auth0.com/ai/docs/mcp/intro/overview.md).

## Sample apps worth cloning at 11:15

- **Assistant0** — full-stack personal assistant demonstrating all four capabilities
- **SmartHR Assistant** — HR document access via relationship-based access control
- **ai-samples** repo — standalone per-feature examples

## The pattern to ship in the kit

> **Agent proposes → CIBA push to the user's phone → agent acts.**
>
> Pair it with the Channels HITL button so the demo shows *two* escalation levels: in-thread approval for cheap actions, out-of-band device approval for expensive ones. That is a two-minute video that lands.

Async-auth quickstart: [auth0.com/ai/docs/get-started/asynchronous-authorization.md](https://auth0.com/ai/docs/get-started/asynchronous-authorization.md)
