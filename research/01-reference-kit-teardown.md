# Teardown: the Generative UI Global Hackathon starter kit

[CopilotKit/Generative-UI-Global-Hackathon-Starter-Kit](https://github.com/CopilotKit/Generative-UI-Global-Hackathon-Starter-Kit) — the previous kit, and the template to follow structurally. Cloned and read in full.

## What it actually is

An npm-workspaces monorepo (`v2a-notion-lead-form`) with four apps:

```
apps/frontend   Next.js + CopilotKit Intelligence (durable threads, canvas)
apps/bff        Hono CopilotKit runtime
apps/agent      Python LangGraph Deep Agent (uv, langgraph dev :8123)
apps/mcp        mcp-use MCP server, deployable to Manufact Cloud
```

Plus `.agent/skills` + `.claude/skills` + `.cursor/skills` (11 skills, tripled across three directories), `dev-docs/` (10 guides), `deployment/docker-compose.yml`, `data/` (a Notion sample DB as CSV + ZIP), and `scripts/{check-env,seed-default-user}.sh`.

## What it got right — keep all of this

1. **A pre-flight check that fails loudly.** `npm run predev` → `scripts/check-env.sh` produces a numbered list of missing keys, an unreachable Notion database, or a stopped Docker daemon. This is the highest-value 100 lines in the repo.
2. **Inline-documented `.env.example`.** Every var has a comment saying *where to click* to get it, plus a `stub-replace-with-real-key...` placeholder that lets the app boot before you have credentials.
3. **A conceptual spine in the README.** The Generative UI spectrum (Controlled → Declarative → Open-ended) gave builders a mental model, not just commands. The new kit needs an equivalent — see the spec.
4. **Per-sponsor README sections** with a one-paragraph "what it is" + a "More about X →" link. Clean, non-promotional, easy to add or drop a sponsor.
5. **Skills pre-installed for three coding agents.** Vibe-coding is how a 4-hour build actually happens.
6. **`dev-docs/` split.** README stays a quickstart; setup, model-switching, architecture, customization, threads, scripts, demo-prompts, troubleshooting each get their own file.
7. **`demo-prompts.md`.** Underrated. Tells a team what to type to get a working demo in 30 seconds.
8. **Port remaps documented in `.env.example`** to avoid colliding with other local stacks.

## What to change

| Problem | Evidence | Fix for the new kit |
|---|---|---|
| **Setup was too heavy for the clock.** | Docker Compose (Postgres + Redis + app-api + realtime gateway), `uv sync` for Python, a Notion duplicate-then-share dance, four concurrent processes. | Ship a **tier-0 template that needs one credential and one process.** Push Docker/Postgres to an opt-in tier. |
| **Notion's per-database share is a documented footgun.** | The README itself says "**Forgetting this share step is the most common point of failure**" and repeats the warning three times. | Default to an integration with no per-object ACL dance. **Ambiguous AI** (`npx ambiguous auth signup`) is the obvious swap; keep Notion as an alternate. |
| **One monolithic demo.** | Everything is the Notion lead-form canvas. A team wanting a different idea had to gut it. | **Multiple thin templates, one shared agent core.** The 2026 challenge is explicitly four surfaces. |
| **Skills tripled across three directories.** | Same 11 skills in `.agent/`, `.claude/`, `.cursor/` — drift guaranteed. | One `.agents/skills/` directory, **symlinked** from `.claude/skills/` — exactly what channels-sdk does. |
| **Stale CLI invocation.** | README says `npx @copilotkit/cli@latest init`; the live CLI is the unscoped `copilotkit@4.9.37` (`@copilotkit/cli` sits at 0.0.6). | Use `npx copilotkit@latest`. |
| **Model default was Gemini.** | `gemini-3.1-flash-lite`, with Anthropic/OpenAI as one-line swaps. | OpenAI is the marquee sponsor. Default **`gpt-5.4-mini`**, document `gpt-5.6-luna` (cheaper) and OpenRouter (`~openai/gpt-latest`) swaps. |
| **A sample-data ZIP in-repo.** | `data/notion-leads-sample/*.zip` | Seed via API/CLI instead of asking a builder to import a ZIP in a web UI. |

## Structural template to reuse verbatim

- README shape: hero → *About this starter* (with embedded video) → **conceptual spine** → *Stack* (one section per sponsor) → *Run it locally* (numbered, ≤4 steps) → integration setup → *Vibe coding* (skills) → *Documentation* → License
- `dev-docs/` with the same ten filenames
- `scripts/check-env.sh` as `predev`
- **GitHub video embedding gotcha:** GitHub only inline-renders video from **user-attachments** uploads. Raw repo URLs and release assets serve `application/octet-stream` with `nosniff` (releases even force `content-disposition: attachment`), so a committed-file `<video>` will not play. Upload the demo clip through a GitHub comment box to get an embeddable `user-attachments/assets/...` URL.
