# City-specific sponsors — verify before promising

The sponsor roster is **not identical across the 51 cities.** Two confirmed local additions:

## Veris AI — venue host, NYC
Simulation infrastructure for agents: recreates the whole world an agent operates in — users, tools, APIs, data — inside an isolated high-fidelity sandbox.

- Scenario generation across common / edge / complex / **adversarial** cases
- Persona-driven multi-turn user simulation, plus mock tools standing in for internal or external APIs
- Your agent runs **the same code it runs in production** — no wrappers, no simulation-only branches
- Grades transcripts and produces a report

Onboarding is **managed, not self-serve**: `veris env submit` → the platform generates `.veris/veris.yaml` + `.veris/Dockerfile.sandbox`, builds the image, healthchecks it, and **a Veris engineer releases the env to you.** That human step means it is realistically a *post-hackathon* tool, not a 4-hour one. Docs: [docs.veris.ai](https://docs.veris.ai/) · [sandbox.veris.ai](https://sandbox.veris.ai/)

## Google Cloud Run — Toronto page
Listed as a supporting sponsor on the Toronto event page. Relevant regardless of city because **a Channels listener needs a long-running process with an outbound websocket** — Cloud Run supports that with `min-instances >= 1` and CPU always allocated. Worth including as a documented deploy target next to Railway/Fly/Docker.

## Action item
Confirm the local roster from your own city's page before the kit's README claims a sponsor. Keep sponsor-specific content in per-sponsor files so a city can drop one without editing prose.
