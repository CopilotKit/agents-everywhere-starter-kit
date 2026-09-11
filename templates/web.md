# Template 2: An agent inside your web app

**OpenAI + CopilotKit React + Ambiguous AI**

Model choice: OpenAI directly or **OpenRouter**.

Build an agent that sees the selected record, proposes a useful follow-up, and saves it to a workplace after approval. The incident domain is infrastructure inspiration; replace it with your own project.

[Step-by-step screenshot walkthrough](../dev-docs/template-walkthroughs/web/README.md) · [Verification evidence and live gaps](../dev-docs/template-validation.md)

## Start it

Complete the homepage's clone/install steps. Configure root `.env` with [OpenAI](../using-sponsor-tools.md#openai) and [Ambiguous AI](../using-sponsor-tools.md#ambiguous-ai):

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
AMBIGUOUS_API_KEY=your-workspace-key
```

Choose an available model and a demo workspace you control. In Ambiguous, open **Admin → People & access → API keys → New API key**, select the intended user, and replace the default wildcard scope with `tasks.read,tasks.write`. Follow the [existing-account key setup](../using-sponsor-tools.md#ambiguous-ai), then put the key privately in root `.env`. No managed Channel or Intelligence account is needed. The key stays on the server.

To use **OpenRouter**, replace the three model settings above in root `.env` with:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-key
MODEL=openai/gpt-4.1-mini
```

Keep `AMBIGUOUS_API_KEY`. Choose a [catalog model](https://openrouter.ai/models) with tool calling for page actions and task proposals. This chat path only needs the selected provider's key. CopilotKit page context and the separate **Approve & save to Ambiguous** step work with either provider. See [model switching](../dev-docs/model-switching.md).

```bash
npm run check-env
npm run check:workplace --workspace web
npm run check:workplace --workspace web -- --identity
npm run dev:web
```

The first workplace check discovers and validates the real public MCP input schemas without calling workspace tools. `--identity` additionally checks your authenticated identity and workspace. Open `http://localhost:3100` and select an incident.

Without credentials, the page still shows selectable sample incidents and setup instructions. Chat requires a configured model; task controls require Ambiguous. There is no browser-state or local-storage task fallback.

## What is included

| Piece                    | Implementation                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Page and sample context  | [Page](../apps/web/src/app/page.tsx), [incidents](../apps/web/src/lib/incidents.ts)                                                         |
| Agent tools              | [AppControl](../apps/web/src/components/app-control.tsx): `select_incident`, `propose_followup`, `retrieve_followup`, `refresh_followups`   |
| Review and save controls | [Follow-up panel](../apps/web/src/components/workplace-followups.tsx)                                                                       |
| Approval boundary        | [HTTP route](../apps/web/src/app/api/followups/route.ts), [approval service](../apps/web/src/lib/server/followups.ts)                       |
| Persistent records       | [Ambiguous MCP adapter](../apps/web/src/lib/server/workplace.ts): discovered `auth_whoami`, `create_task`, `get_task`, `list_tasks` schemas |
| CopilotKit runtime       | [Web endpoint](../apps/web/src/app/api/copilotkit/[[...path]]/route.ts), with raw workplace MCP tools disabled                              |

The model prepares a proposal. It cannot approve it or call raw Ambiguous write tools in this web runtime. The page's **Approve & save to Ambiguous** button sends a separate request tied to the browser session and immutable proposed fields. The server checks the identity/workspace and expiry, validates the discovered schema, and claims the exact action immediately before the MCP write. Chat text saying “approved” does not save a task.

## Prove a record survives refresh

1. Ask: “What is happening with the selected incident? Use the page context.” Compare its answer with the selected record.
2. Ask: “Propose a follow-up to investigate this incident. Include what we know and the next useful check.” Or enter a title and details in the page form and choose **Review task before saving**.
3. Inspect the exact title, complete description, connected identity, workspace ID, and expiry in the approval panel. The incident/reference markers are included in the saved description. Select **Approve & save to Ambiguous** only for your intended demo-workspace write.
4. Check the actual task ID. Success is reported only after retrieving the task from Ambiguous and comparing its ID, title, and description with the approved fields. Open the provider-returned record link when present.
5. Refresh the browser and select the same incident. Its follow-ups are read from Ambiguous. Ask: “Retrieve follow-up ID [the actual ID] and confirm its details.” Neither refresh nor retrieval creates a record.
6. Prepare another proposal and decline it. Prepare another and let its ten-minute approval expire. Neither may save a task.

Ambiguous's published Task schema does **not** promise a record URL. The page shows a returned `url` when available; otherwise it displays the actual ID and explicitly says no link was returned. It never constructs an assumed URL. A live workspace is still needed to verify real create/read results and whether it supplies a usable link.

## Failure and deployment behavior

A rejected credential, missing permission, changed schema, malformed result, or failed read appears as an error. After a timeout/lost create reply, the exact action is not blindly retried: the app searches Ambiguous for the matching task and reads it back. If it cannot confirm a record, the outcome stays uncertain. Different proposals with identical workspace, incident, title, and details reuse the same action identity.

The `.data/web-approvals` directory under `apps/web` stores consent and attempt metadata, **not task records**. Set `WEB_APPROVAL_DIR` to a persistent directory when hosting. Preserve it across restart; deleting it removes protection against retrying an uncertain write. This demo assumes one server/shared persistent disk and does not support independently stored replicas. Pending proposals expire in ten minutes; completed-task reads always use Ambiguous.

The default web scripts bind to loopback, and the API accepts only loopback hostnames to prevent DNS rebinding. This is a local demo with one server-side workspace credential. Before exposing it publicly, add application authentication and authorization that binds each user to their intended workspace, then replace the loopback-only check with an explicit trusted-origin allowlist. The session cookie protects the approval flow; it is not a user login.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, and AGENTS.md.
Adapt apps/web to our user and workflow. Keep CopilotKit React for page context,
frontend tools, and agent-rendered UI. Keep the separate proposal/approval path
and real Ambiguous reads. Never expose raw write tools to the web model or
substitute browser storage for persistence. Test denied/expired approvals,
workspace changes, duplicate requests, uncertain writes, and read-back mismatch.
Run npm run verify and npm run build --workspace web. Record live workspace
create/read evidence separately from offline tests and public schema discovery.
```
