# Agents, Everywhere: Bots, Channels, & More — Global Hackathon

**Researched 2026-09-08. Event is 4 days out.**

## Verified event facts

| Field | Value |
|---|---|
| Date | Saturday, September 12, 2026 (some city pages list Sep 12–13) |
| Hours | 10:00–17:00 local time |
| Scale | **51 cities**, one shared build day, one global submission pool |
| Presented with | OpenAI |
| Format | Local build day + shared global opening & **starter-kit walkthrough** (10:30–11:00) |
| Build window | **11:15–15:30 — 4h15m of actual build time** |
| Local judging | None. Local show-and-tell 15:30–16:30; submit 16:30–17:00 |
| Attendance | Application-only, builders-only. NYC page showed 203+ applicants |

Source: [aitinkerers.org/hackathons/global/agents-everywhere](https://aitinkerers.org/hackathons/global/agents-everywhere) (root page 403s to bots; city mirrors are fetchable, e.g. [NYC](https://nyc.aitinkerers.org/p/agents-everywhere-beyond-the-chatbot-global-hackathon-with-openai), [Toronto](https://toronto.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon)).

## The four surfaces (examples, not tracks)

1. **At work** — Slack, Teams, email, docs, calendars, tickets, support, live collaboration
2. **In your pocket** — messaging, mobile, notifications, short async moments
3. **On the web** — browsers and software where an agent can research, navigate, transact, act
4. **In the room** — voice, vision, wearables, robotics, physical-world interfaces

## What every team submits

1. Title
2. Written description — what, who for, **why the context matters**
3. Public GitHub repo with working code
4. Two-minute demo video
5. Public social post tagging sponsors

> "Build something that can be shown. A sharp, working demo beats a broad concept."

## Judging

Global review across all cities. **Rubric and prize categories are not yet published** — "shared with builders before the event." Plan the kit so a submission scores well on the stated values regardless: a working demo, context that genuinely changes the agent's usefulness, reviewable code.

## The 4h15m constraint — the single most important design input

A team gets **255 minutes**. Any starter kit that spends 60 of those on OAuth app creation, tunnels, or Docker has burned 24% of the event. Design implications:

- **Zero-tunnel paths only.** Anything needing ngrok/localtunnel is a trap.
- **One provider app maximum** per template.
- **Pre-flight check script** that fails loudly with a numbered fix list (the reference kit did this well — keep it).
- **A `.env.example` with every var documented inline**, including where to click to get it.
- **Templates should boot and answer with zero third-party accounts**, then add integrations.

## Sponsor roster (as verified across city pages)

**Global sponsors:** OpenAI (marquee), CopilotKit, OpenRouter

**Developer infrastructure partners:** Exa, Trigger.dev, Auth0, Mozilla.ai, Ambiguous AI

**City-specific (do not assume global):**
- **Veris AI** — venue host, NYC. Agent simulation/testing sandbox.
- **Google Cloud Run** — listed on the Toronto page.

**Not yet known:** builder credits, promo codes, and per-sponsor offers. The event page says these land "where available" before the day. Leave a `CREDITS.md` stub in the kit to fill in on the morning.
