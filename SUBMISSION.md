# Submission checklist

Choose your city on the [global event page](https://aitinkerers.org/hackathons/global/agents-everywhere). Use that city's participant portal for the submission deadline and published judging criteria, and its handbook for eligibility and required deliverables. See [hackathon-rules.md](hackathon-rules.md) for the agent-readable summary.

## Build eligibility

- [ ] Our submitted project is a net-new build created during the official hackathon period
- [ ] Its core functionality was built during the event; we are not resubmitting or extending a pre-existing project and entering it as new
- [ ] We identify inherited templates, libraries, prompts, components, and starter code separately from our event work

**What we inherited**
<!-- DRAFT — team to confirm before submitting. -->
- **This starter kit.** The shared agent factory and model adapter (`packages/agent-core`), the CopilotKit runtime and React patterns from `apps/web`, and the repo tooling. The incident demos in `apps/channel`, `apps/web` and `apps/mobile` are unchanged and not part of Procurebot.
- **Our pre-event Procurebot prototype (started 2026-09-08):**
  - its Postgres schema, copied verbatim into `packages/procure-db/migrations/0003–0033` plus `0024_thread_bindings.sql`;
  - the ERP console's visual design and helpers (`apps/erp-frontend/src/index.css`, `format.ts`, `statusTone.ts`) and the page layouts the new pages were adapted from.

  None of the prototype's backend, portal, or agent code was carried over.
- **Libraries:** CopilotKit (runtime, React), Express, pg, BullMQ, jose, nodemailer, multer, Vite, React.

**What we built during the hackathon**
<!-- DRAFT — team to confirm. -->
- **The agent** (`apps/procure-agent`): the Procurebot prompt and six server tools over the shared database (`src/tools.ts`): catalog matching, supplier selection, requisition status, draft creation, and quote comparison. It runs on OpenRouter through `agent-core` (we added a `tools` option to `makeAgent`).
- **Approval-gated actions in the ERP chat** (`apps/erp-frontend/src/agent/generativeUi.tsx`): a `propose_rfq` card (who gets emailed), a `propose_award` card (which quote becomes a PO), and a `quote_comparison` table. The cards read ground truth from the api and perform the write only on the requester's click.
- **The service layer** (`apps/api`):
  - ERP read API;
  - RFQ dispatch with per-supplier magic links and send-failure tracking (`services/dispatchRfq.ts`);
  - PO issuance with an approval record and a formal PO email (`services/issuePurchaseOrder.ts`);
  - the supplier portal, where quotes are entered in a form with an optional document (`portal/`).
- **Shared data layer** (`packages/procure-db`):
  - migration 0035 (needed-by dates, PO numbers, email status);
  - migration runner, seed data and typed queries;
  - deterministic quote ranking (`rank.ts`).
- **The new ERP frontend app** (`apps/erp-frontend`): pages rewritten against the new API, the agent column, and live page context (today's date and the open requisition).

## Title and description

**Project title:** Procurebot

**What you built**
Procurebot turns "Need 4000 ballpoint pens by Friday" into a placed order:

1. In the ERP's chat panel, the agent matches the request to the catalog (asking blue or black) and resolves "Friday" to a date.
2. It drafts a requisition, then asks for approval to email RFQs to the right suppliers, naming each one.
3. Suppliers quote through a personal magic-link portal. Each quote appears on the requisition page as it arrives.
4. Asked to compare, the agent draws a ranked table (on time first, then price) with a recommendation.
5. On the requester's approval it issues a purchase order and emails it to the winning supplier.

**Who it is for**
The office or operations manager at a 30–200 person company who orders supplies and equipment. Today they email three suppliers by hand, chase replies, paste prices into a spreadsheet, then type up a PO.

**Why the context matters**
The agent works inside the ERP, not in a separate chatbox:
- It sees today's date and the requisition the user has open ("compare the quotes for this one").
- It works from live records that suppliers update through the portal.
- It hands every external action (emails, POs) back to the user as an approval card in the same place.

Without that context, a standalone chatbot could draft an email but couldn't know the supplier list, receive quotes, rank them against the deadline, or leave an auditable requisition, approval and PO trail. The planned next surface is Slack: the same tools, with quotes pushed into the thread where the request was made.

**Sponsor technologies used**
<!-- DRAFT — keep only what the demo actually shows. -->
- **OpenRouter:** the model gateway for the agent's reasoning and tool calls.
- **CopilotKit:** the runtime that hosts the agent and its server tools; CopilotKit React for the chat panel, page context (`useAgentContext`), the generative comparison table (`useComponent`), and the human-in-the-loop approval cards (`useHumanInTheLoop`).

## Evidence for the judging criteria

Judges score each of the four official criteria from 1–5. This checklist helps you gather evidence; it does not guarantee a score. A working starter is a foundation for your own project.

| Official criterion | Show in your project and demo |
|---|---|
| Core Requirements & Functionality | Run one complete workflow in the intended environment, from user request through tools to a verified result. Repeat it with live integrations; offline tests alone do not prove the deployed flow. |
| Innovation & Theme Alignment | Show the surrounding context before the prompt and explain the original interaction it enables. Compare with the context removed: what value would a standalone chatbox lose? |
| Technical Execution & Integration | Show how tools, data, and the environment connect. Demonstrate a relevant failure or cancellation path and explain recovery, state persistence, and integration limits. |
| Usefulness & Agentic Experience | Identify the user and problem, show a meaningful action in the surface, and demonstrate clear feedback and appropriate user control. Explain what work the agent saves. |

- [ ] We can point to visible evidence for every criterion
- [ ] We distinguish live services, sample data, session-only state, and standalone recipes
- [ ] Sponsor technologies contribute to the workflow; their count is not a judging criterion

## Public repository

- [ ] A new participant can run the quickstart from a clean clone
- [ ] The README lists the credentials and separate processes required
- [ ] `npm run verify` passes; optional recipe checks pass if used
- [ ] `.env`, tokens, generated traces with sensitive data, and account secrets are excluded
- [ ] Sample data, session-only state, and unimplemented integrations are clearly labeled

## Two-minute demo video

- [ ] Show the surface and existing context before the prompt
- [ ] Demonstrate one complete interaction
- [ ] Show a visible result: an actual record, local state change, or research source links
- [ ] If showing an approval, distinguish the decision from execution and demonstrate the resulting behavior
- [ ] State which sponsor technologies made the interaction possible
- [ ] Keep the video within the event's limit and check audio

See [demo prompts](dev-docs/demo-prompts.md) for a reproducible incident workflow.

## Social post and final submission

- [ ] Follow the organizer's posting and sponsor-tagging instructions
- [ ] Link the public repository and video
- [ ] Credit the sponsors you used and applicable local partners
- [ ] Check the live integration once more before recording or submitting
- [ ] Inspect the repository, video and screenshots for secrets

Prepare the post and submission for a human to publish; running the starter kit
does not publish either automatically.
