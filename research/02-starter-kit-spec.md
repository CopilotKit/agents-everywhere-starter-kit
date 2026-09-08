# Proposed starter kit: *Agents, Everywhere*

Everything below follows from one number: **255 minutes of build time.** Clone-to-first-reply must be under 15 minutes, and a second surface must be reachable without re-plumbing.

## The conceptual spine

The previous kit had the Generative UI spectrum. This one needs an equivalent — and the challenge statement hands us the axis: *"make it meaningfully more useful **because of that context**."* So the spine is a ladder, not a spectrum:

### The Context Ladder

| Level | Name | The agent… | Test |
|---|---|---|---|
| 1 | **Reachable** | is addressable where you already are — it answers a mention | Table stakes. Every submission clears this. |
| 2 | **Situated** | reads the surface's context unprompted — thread history, the doc you're in, who's asking, which channel, what happened an hour ago | Could you delete the context and get the same answer? If yes, you're still on level 1. |
| 3 | **Native** | acts and renders in the surface's own idioms — Block Kit cards, approval buttons, reactions, push notifications — and its side effects land where the work lives | Does it look and behave like it belongs, or like a chat window wearing a costume? |

Level 3 is where the global review will separate submissions. The kit should make level 1 free, level 2 easy, and level 3 obvious.

## Architecture: one agent, every surface

The thesis of the whole kit, and it happens to be exactly what AG-UI is for:

```
packages/
  agent-core/        ONE AG-UI agent. Tools, model routing, memory. Framework-agnostic.
  context-kit/       Surface-context adapters: thread history, participants, files, locale.

apps/
  channel-slack/     @copilotkit/channels → managed Slack        [At work]
  channel-teams/     same listener, Teams adapter                [At work]
  web/               Next.js + CopilotKit generative UI          [On the web]
  mobile/            Expo + @copilotkit/react-native             [In your pocket]
  voice/             OpenAI Realtime over WebRTC                 [In the room]
  plugin/            MCP server + optional ChatGPT UI            [ChatGPT]
```

Every app points at the **same** `agent-core` over AG-UI (`new HttpAgent({ url: AGENT_URL })`). Swapping surfaces is a config change, not a rewrite. A team can demo their agent in Slack *and* on a phone in the two-minute video — which is a strong differentiator when 51 cities submit chat bots.

**`agent-core` must stay framework-agnostic.** Ship it as CopilotKit's `BuiltInAgent` by default (zero Python, zero extra process), with documented one-file swaps to LangGraph / Mastra / Pydantic AI / CrewAI / Google ADK. The reference kit forced a Python `uv` + `langgraph dev` process on everyone; that cost is not justified at tier 0.

## Setup tiers — this is the part that wins the day

### Tier 0 — 5 minutes, one credential
```bash
git clone … && cd … && npm install
echo "OPENAI_API_KEY=sk-..." > .env
npm run dev          # web app + agent-core, answering
```
No Docker. No Postgres. No provider app. A builder who arrives at 11:15 is typing product code by 11:22.

### Tier 1 — +15 minutes, agent lives in Slack
```bash
npx copilotkit@latest channels setup   # installs the skill, prints+copies the prompt
```
Adds `INTELLIGENCE_API_KEY` + `CHANNEL_CODE`. **Zero tunnel** — Intelligence hosts the webhook and dials your runtime over an outbound websocket. This is the kit's single biggest advantage over a raw Bolt app and deserves a callout box in the README.

### Tier 2 — opt-in, per sponsor, one file each
| Add | Gets you | Cost |
|---|---|---|
| `EXA_API_KEY` | grounded web search as an agent tool (`instant`/`fast` for chat latency) | 2 min |
| `npx ambiguous auth signup` | a whole 17-app workplace to act in — mail, tasks, CRM, docs | 3 min |
| `TRIGGER_SECRET_KEY` | durable long-running work + waitpoint approvals | 5 min |
| Auth0 | CIBA out-of-band approval; Token Vault for per-user third-party APIs | 15 min |
| `mcpd` | declarative MCP tool set instead of ad-hoc `npx -y` spawns | 5 min |
| `OPENROUTER_API_KEY` | model fallback insurance for the live demo | 1 min |

## Two flagship patterns to ship as working code

These are the moments that make a two-minute video, and each is an honest combination of sponsors rather than a checkbox.

**1. The two-tier approval.**
Agent proposes an action → cheap ones get an in-thread Channels `Button` → expensive ones trigger an **Auth0 CIBA** push to the user's phone → approval completes a **Trigger.dev waitpoint** → the durable task resumes and finishes work that outlives the chat turn. Three sponsors, one coherent story, and it directly answers "why does this belong here."

**2. Situated recall.**
Agent reads thread history + participants + the linked doc, grounds against **Exa** (`type: "instant"`), and writes its output back into the workplace it came from (**Ambiguous** `tasks.*` / `mail.*`) — rendered as a native card, not a paragraph. This is level 3 of the Context Ladder in one demo.

## Env matrix (single `.env`, inline-documented, tier-tagged)

```dotenv
# ── TIER 0 ────────────────────────────────────────────────
OPENAI_API_KEY=stub-replace-me           # platform.openai.com/api-keys
MODEL=gpt-5.4-mini                       # gpt-5.6-luna cheaper · gpt-5.6-sol smarter
AGENT_URL=http://localhost:8123/         # agent-core over AG-UI

# ── TIER 1 · Slack / Teams ────────────────────────────────
INTELLIGENCE_API_KEY=                    # Intelligence project key
CHANNEL_CODE=                            # EXACT kebab-case Code from the Channel wizard
LOG_LEVEL=debug                          # lifecycle breadcrumbs are emitted at warn

# ── TIER 2 · opt-in ───────────────────────────────────────
EXA_API_KEY=                             # dashboard.exa.ai/api-keys
AMBIGUOUS_API_KEY=                       # npx ambiguous auth signup
TRIGGER_SECRET_KEY=                      # tr_dev_sk_… ("Trigger only" access)
OPENROUTER_API_KEY=                      # fallback routing
```

Copy the reference kit's habit exactly: a comment per var saying *where to click*, and a `stub-replace-me` placeholder so the app boots before credentials exist.

## Pinning (verified on npm 2026-09-08)

```
@copilotkit/channels  0.9.2   ── tested PAIR, bump together, --save-exact
@copilotkit/runtime   1.70.1  ──┘
@ag-ui/client         0.0.59  ── exactly what runtime@1.70.1 bundles
@copilotkit/react-core / react-ui / react-native   1.70.1
@openai/agents        0.17.1   @trigger.dev/sdk 4.5.16
exa-js                2.19.0   @openrouter/sdk 1.2.108   @auth0/ai 6.0.2
```
Node.js **22+** (global `WebSocket`). Ignore `docs.copilotkit.ai/slack/deploy-and-operate`'s `0.6.1`/`1.65.0` instruction — it's stale.

## Deploy

| Surface | Target | Why |
|---|---|---|
| Channels listener | **Railway / Google Cloud Run (min-instances ≥ 1, CPU always allocated) / Fly.io / Docker** | Long-running worker with an outbound websocket — **not** a serverless handler |
| Web app | Vercel | Fine as a serverless Next.js app |
| MCP server / plugin | any HTTPS host | |
| Durable work | Trigger.dev cloud | |

Ship a one-command deploy for the listener and say plainly in the README that Vercel functions cannot host it. That mistake will otherwise cost someone their 15:30 demo.

## Repo scaffolding

```
.agents/skills/          ONE copy — build-channels-agent, copilotkit-*, mcp-builder
.claude/skills  →  symlink to ../.agents/skills     # channels-sdk does exactly this
.cursor/skills  →  symlink
dev-docs/                setup · surfaces · model-switching · channels · mobile ·
                         voice · plugin · architecture · deploy · demo-prompts ·
                         troubleshooting
scripts/check-env.sh     predev pre-flight; numbered failures with fix hints
scripts/new-surface.sh   scaffold another app against the same agent-core
SUBMISSION.md            the five deliverables as a fillable checklist
CREDITS.md               sponsor credits/promo codes — fill in on the morning
```

Also wire `https://mcp.copilotkit.ai/mcp` (CopilotKit docs MCP) and `https://mcp.exa.ai/mcp` into the kit's MCP config so a builder's coding agent has live docs and live search from minute one.

## Troubleshooting doc — seed it with the known traps

Not hypothetical; each of these has burned someone already:

1. `channels.ready()` resolves on `setup_required` as well as `online` — assert `channels.status().overall === "online"`
2. Lifecycle breadcrumbs are emitted at `warn` while the logger defaults to `error` → `LOG_LEVEL=debug`, and watch for `channel "<name>" requires setup`
3. Two runtimes on one Channel name race per delivery; the loser gets nothing, silently — one project per local runtime
4. Workspace-installed ≠ channel member — `/invite @Bot` or no `app_mention` fires at all
5. Mentioned turns route to `onMention` (falling back to `onMessage`); non-mentioned turns *only* reach `onMessage`
6. Managed Slack delivers no slash commands and no modal submissions — buttons and selects do work
7. Slack wants a signing secret, Teams wants a Microsoft-signed bearer JWT. Crossing them installs cleanly and authenticates nothing
8. Create the Channel **before** the provider app — the wizard generates the manifest with the correct request URL
9. Dashboard "Agent run: —" and "AGENT: Not declared" are not failures; the **Usage** tab proves a round trip
10. GitHub only inline-plays video from **user-attachments** uploads — not raw repo files or release assets

## Open questions to resolve before Saturday

1. **Judging rubric and prize categories** are unpublished. If they land before the day, re-check that the Context Ladder still aligns.
2. **Builder credits and promo codes** — unannounced. `CREDITS.md` stub, filled in at the opening session.
3. **Local sponsor roster varies by city** (Veris AI = NYC venue host; Google Cloud Run on the Toronto page). Keep sponsor content in per-file sections so a city can drop one cleanly.
4. **Teams managed support** — verify current status; Slack is the safe default to demo.
5. **Whether an official OpenAI/AI-Tinkerers starter repo ships too**, and whether this kit should complement rather than compete with it.
