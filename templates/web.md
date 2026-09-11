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

Open `http://localhost:3100` and select an incident.

## What is included

| Piece | Implementation |
|---|---|
| App and selected record | [Page](../apps/web/src/app/page.tsx) and [sample data](../apps/web/src/lib/incidents.ts) |
| Context and local tools | [AppControl](../apps/web/src/components/app-control.tsx): `useAgentContext`, `select_incident`, and local `create_followup` |
| CopilotKit React UI | [Providers](../apps/web/src/components/providers.tsx) and [generative UI](../apps/web/src/components/generative-ui.tsx) |
| Agent endpoint | [Server runtime](../apps/web/src/app/api/copilotkit/[[...path]]/route.ts) |
| Persistent workplace tools | [Ambiguous MCP connection](../packages/agent-core/src/capabilities/workplace.ts), added by the shared agent factory when configured |

`create_followup` changes only browser state. For the persistent path, explicitly use the connected **Ambiguous workspace's task tools**, which store the record outside the page. Their schemas come from the MCP server; discover them instead of inventing a tool name or URL.

## Prove a record survives refresh

1. Ask: “What is happening with the selected incident? Use the page context.” Check its answer against the incident currently selected.
2. Ask: “Propose a task in our Ambiguous workspace to investigate the selected incident. Show the exact title and details for approval. Do not use the session-only create_followup tool.”
3. Approve that specific demo-workspace write. Ask the agent to create it with the connected workplace tool, then return its actual ID and record link. Open the link and inspect the saved fields.
4. Refresh the browser. Ask the agent to retrieve the saved task by its ID from Ambiguous. Check it returns the same record without creating a duplicate.

If only a local follow-up appears or the tool returns no retrievable record, the persistence check has not passed. Do not manufacture a URL. The shared MCP connection is implemented; live workspace access and writes require your account. The reference approval UI is not a hard authorization wrapper around every MCP call.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, and AGENTS.md.
Adapt apps/web to our user and workflow. Keep CopilotKit React for page context,
frontend tools, and agent-rendered UI. Use Ambiguous AI for persistent records.
Rename or remove the sample session-only create_followup so users cannot confuse
it with saving a workplace task. Return the real record ID/link and verify read-
back after refresh. Keep credentials server-side and enforce any required
approval immediately before writes. Run npm run verify and npm run build
--workspace web, then document the live record create/read check.
```

[CopilotKit docs](https://docs.copilotkit.ai/) · [Sponsor authentication and first calls](../using-sponsor-tools.md) · [Demo prompts](../dev-docs/demo-prompts.md)
