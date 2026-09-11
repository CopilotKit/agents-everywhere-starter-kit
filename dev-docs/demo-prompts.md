# A complete incident demo

The point is to show work informed by its surroundings and a result visible where the interaction began. Choose either the Slack workflow or the browser workflow, then add only the sponsor capabilities you need.

These are reference interactions to learn from. Build your own project and its core functionality during the event, and distinguish that work from inherited starter code. See [build eligibility](../SUBMISSION.md#build-eligibility).

## Slack: context, sources, card, follow-up

Prerequisites: [Slack setup](setup.md), your selected model provider, Exa for research, and an isolated Ambiguous AI demo workspace for the external-task step. [using-sponsor-tools.md](../using-sponsor-tools.md) give the exact configuration.

### 1. Establish the surrounding context

Before mentioning the bot, put these messages into a thread:

> checkout is timing out for EU customers
>
> started around 02:14, right after the web deploy
>
> rolled web back, did not help — still seeing 4s+ on /checkout
>
> queue depth on payments-worker is climbing

Then ask:

> @agent catch me up on this incident. Read this thread and show an incident card.

Expected: `read_thread` followed by `incident_card`. Check that it includes the failed rollback and growing queue, without your prompt restating them. Ask for a timeline to exercise `timeline`.

### 2. Research with visible sources

> @agent use web search to find documented causes of payment-worker retry storms and safe investigation steps. Include source links and separate published guidance from what this thread proves.

Expected: `search_web` via Exa and inspectable URLs. Search results do not prove the cause of this sample incident. No log reader is included.

### 3. Approve a concrete follow-up

> @agent propose creating one task in our Ambiguous workspace: “Investigate payments-worker retry spike.” Include the failed rollback, rising queue depth, and useful source links. Ask for approval before creating it; do not send mail or change production.

Review the proposed action and approve only the intended demo-workspace write. The managed proposal card records the decision but executes nothing and does not resume the agent. In a separate message, explicitly ask it to create that demo-workspace task and return its record URL. Production proposals remain demonstration-only.

Expected: a **real task record**, with a returned URL you can open from the thread. Verify its title and contents in the workspace. A card or “done” sentence without an actual record is not a successful task demo. MCP tools come from the live workspace; this route is not live-account-verified by the kit's offline checks.

The prompt and `propose_action` guide approval behavior but do not enforce approval around every external MCP call. Use a demo workspace. For an enforced authorization example, run the standalone [Auth0 recipe](../examples/auth0/README.md).

## Browser: ambient context and visible local actions

```bash
npm run dev:web
```

Open `http://localhost:3100` and select an incident. Try:

> What is happening with the selected incident? Show an incident card and a timeline.

> Create a follow-up for this incident to investigate the retry spike.

> Select the other incident and tell me what changed.

Expected: `incident_card`, `timeline`, `create_followup`, and `select_incident` as appropriate. The selected incident and follow-up list should visibly change. The context is derived from the displayed sample data; local tasks last only for this page session. `propose_action` provides approval UI but does not execute a production action. Web chat does not register Exa search; use Slack or the standalone recipes for that step.

### Add a persistent workplace record

With Ambiguous AI configured, follow [the web template](../templates/web.md#prove-a-record-survives-refresh): propose an exact task in your demo workspace, approve it, create it through the connected MCP tool, and open the returned record link. Refresh the page and retrieve the same ID. Do not use the session-only `create_followup` for this check.

## WhatsApp: identity and phone approval

Follow [the WhatsApp template](../templates/whatsapp.md) to link your account and request a protected follow-up. Show denial leaving no record, then approve a fresh request on your phone and show the actual saved receipt.

## Record a focused video

1. Show the surface and existing context.
2. Ask a question that relies on that context.
3. Show the native assessment and one complete action or returned research result.
4. Open the actual record or source link.
5. Explain what the surrounding context made possible.

A second surface is optional. State what is sample data, what changed locally, and what reached a real service. See [SUBMISSION.md](../SUBMISSION.md) for the event checklist.

Before recording, use the [four-criterion evidence checklist](../SUBMISSION.md#evidence-for-the-judging-criteria). Show your original interaction, one verified outcome, appropriate user control, and a relevant failure or cancellation case. Sponsor usage should explain how the result became possible.
