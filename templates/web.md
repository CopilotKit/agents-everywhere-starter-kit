# Template 2: An agent inside your web app

**OpenAI + CopilotKit React + Ambiguous AI**

Build an agent that sees the selected record or page, helps the user act on it, and creates a workplace record that remains after a refresh. Try a customer workspace, project review page, or personal planning app. Replace the sample incident domain with your own project.

## Start it

Complete the homepage's clone/install steps. Configure root `.env` with [OpenAI](../using-sponsor-tools.md#openai) and [Ambiguous AI](../using-sponsor-tools.md#ambiguous-ai):

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
AMBIGUOUS_API_KEY=your-workspace-key
```

Choose an OpenAI model your account can use. Use a demo workspace you control for the first write. This web template needs no managed Channel or Intelligence account.

```bash
npm run check-env
npm run dev:web
```

Open `http://127.0.0.1:3100` or `http://localhost:3100` and select an incident. The dev and start scripts bind the credential-backed approval server to loopback by default; keep that boundary unless you add your own authentication and trusted-origin policy.

The page pairs a compact incident view with an always-visible assistant. Start with “Summarize this incident” or “Propose a follow-up” in chat. Expand **Details & timeline** for more context. Follow-up writes are two-step: the agent prepares an exact proposal, then the page approval button saves it to Ambiguous and reads it back.

## What is included

| Piece | Implementation |
| --- | --- |
| App and selected record | [Page](../apps/web/src/app/page.tsx) and [sample data](../apps/web/src/lib/incidents.ts) |
| Context and frontend tools | [AppControl](../apps/web/src/components/app-control.tsx): `useAgentContext`, `select_incident`, `propose_followup`, `retrieve_followup`, and `refresh_followups` |
| Approval UI and provider reads | [Workplace follow-ups](../apps/web/src/components/workplace-followups.tsx) and [browser client hook](../apps/web/src/lib/use-workplace.ts) |
| Server approval boundary | [Follow-up API](../apps/web/src/app/api/followups/route.ts) and [service](../apps/web/src/lib/server/followups.ts) |
| Ambiguous MCP adapter | [Workplace adapter](../apps/web/src/lib/server/workplace.ts), used only after browser approval |
| CopilotKit React UI | [Generative UI](../apps/web/src/components/generative-ui.tsx) and [providers](../apps/web/src/components/providers.tsx) |
| Agent endpoint | [Server runtime](../apps/web/src/app/api/copilotkit/[[...path]]/route.ts), configured without raw workplace write tools |

The web chat does not receive raw Ambiguous write tools. It can propose a task and read or refresh existing records through frontend tools; the server writes only after the user clicks **Approve & save to Ambiguous**. Tool schemas come from the MCP server at write time, and returned links must come from Ambiguous rather than being invented.

## Prove a record survives refresh

1. Ask: “What is happening with the selected incident? Use the page context.” Check its answer against the incident currently selected.
2. Ask: “Propose a task in our Ambiguous workspace to investigate the selected incident. Show the exact title and details for approval.”
3. Review the page proposal. Click **Approve & save to Ambiguous** only if the fields are correct. The app should return the actual record ID and any provider link.
4. Refresh the browser. Ask the agent to retrieve the saved task by its ID from Ambiguous, or click **Refresh from Ambiguous**. Check the same record returns without creating a duplicate.
5. Repeat with **Decline** and confirm no task is created.

If there is no retrievable Ambiguous record, the persistence check has not passed. Offline tests cover proposal validation, session binding, approval/deny behavior, read-back, duplicate prevention, expiry preflight, provider schema drift, sanitized provider errors, and the cleanup path. Live workspace access and writes still require your account. Provider outage/recovery and a fresh live expiry rehearsal are separate live checks.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, and AGENTS.md.
Adapt apps/web to our user and workflow. Keep CopilotKit React for page context,
frontend tools, agent-rendered UI, and page approval. Use Ambiguous AI for
persistent records. Do not expose raw write tools to the web chat when the page
approval path is required. Return the real record ID/link and verify read-back
after refresh. Keep credentials server-side and enforce authorization at the
write boundary. Run npm run verify and npm run build --workspace web, then
document the live record create/read/decline checks.
```

[CopilotKit docs](https://docs.copilotkit.ai/) · [Sponsor authentication and first calls](../using-sponsor-tools.md) · [Demo prompts](../dev-docs/demo-prompts.md)
