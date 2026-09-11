# Web: selected context to an approved workplace task

[Template](../../../templates/web.md) · [All walkthroughs](../README.md) · [Sponsor setup](../../../using-sponsor-tools.md#ambiguous-ai)

Use the sample incident workspace to learn the wiring, then replace the domain with your own workflow. The screenshots below come from a real browser trial on September 11, 2026. Authenticated Ambiguous create/read and returned-link screenshots remain pending workspace access.

## 1. Install and open the sample workspace

```bash
npm ci
npm run dev:web
```

Open `http://localhost:3100`. Select **INC-1043** and inspect the notifications timeline. Without credentials, the page shows model setup instructions and **Connect a workspace to save tasks**. **Review task before saving** stays disabled. Nothing is saved in browser storage.

![Explore sample incidents with explicit workspace setup instructions](images/01-explore-without-keys.jpg)

## 2. Connect a model and ask about the selected record

Configure root `.env` using [OpenAI setup](../../../using-sponsor-tools.md#openai), choose a model available to the account, and restart the app. Select an incident and ask:

> What is happening with the selected incident? Show a card using the page context.

Check the service, facts, and timeline against the page without pasting them into chat. Then ask to switch to the other incident and verify that the visible selection and answer change together.

![Live agent reads the selected checkout incident](images/02-agent-reads-selected-incident.jpg)

![Live agent follows the changed incident selection](images/03-agent-follows-selection.jpg)

## 3. Connect the intended Ambiguous workspace

Set `AMBIGUOUS_API_KEY` privately in root `.env`, restart, and run:

```bash
npm run check:workplace --workspace web
npm run check:workplace --workspace web -- --identity
```

The first command verifies the real public MCP schemas without writes. The second reads the authenticated identity. Compare the identity and workspace ID with the intended demo workspace. The page should list real saved follow-ups or show none for the selected incident.

With no workspace key, the real browser trial shows a clear setup message and confirms nothing was saved. This screenshot verifies the missing-configuration path, not persistence.

![The agent explains that Ambiguous is not configured and nothing was saved](images/04-missing-workspace-no-write.jpg)

**Live capture pending:** connected identity/workspace and the initial real record list.

## 4. Prepare and review a task

Ask:

> Propose a follow-up for the selected incident. Include the known facts and the next useful check.

Or fill in the title/details form and select **Review task before saving**. Inspect the exact title, description, incident markers, workspace ID, and expiry in the approval panel. The proposal has not been saved yet. A chat message saying “approved” does not execute the write.

**Live capture pending:** a successful actual proposal tied to the selected record and intended workspace.

## 5. Approve and inspect the actual record

Click **Approve & save to Ambiguous**. The server validates the proposal and discovered input schema, then calls the real task tool. Success requires a read-back with the same ID, title, and description. Open the record link if Ambiguous returns one. If it returns no link, the page says so and shows the actual ID; never invent a URL for the screenshot.

**Live capture pending:** saved ID, matching fields, and the actual provider link when available. An ID produced by a mock is not evidence for this step.

## 6. Refresh and retrieve the same task

Refresh the browser and select the same incident. Verify the task returns from Ambiguous. Ask the agent to retrieve its actual ID, and confirm it returns the same fields without creating another task. The local approval files are metadata only; they cannot substitute for this external read.

**Live capture pending:** before/after refresh with the same actual Ambiguous task ID and no duplication.

## 7. Try the failure paths

Decline another proposal, then let a separate ten-minute proposal expire. Neither should save. An unavailable credential or permission must produce a visible error. If a create response is lost, refresh to reconcile; the exact action is not blindly sent again.

**Live capture pending:** decline, expiry, and an authenticated provider error/recovery. Offline tests cover these boundaries separately in [verification evidence](../../template-validation.md).
