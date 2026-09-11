# Hackathon overview

Read this before choosing a template or writing a project plan. Read [hackathon-rules.md](hackathon-rules.md) before deciding what to reuse or submit.

## Challenge

Build an agent for a place people already work, talk, or live. The surrounding context should make the agent more useful: it can read the conversation, see the current page, recognize the authenticated user, or understand something happening in the room. Demonstrate one complete interaction with a visible result.

Agents, Everywhere is an AI Tinkerers global hackathon on September 12, 2026. Check your local event schedule and the [official portal](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) for the authoritative submission deadline. This kit is a starting point for a new project.

## Four surfaces

These are examples, not competition tracks. One surface is enough.

| Surface | Context to build around | Possible project |
|---|---|---|
| At work | Team conversations, documents, tickets, and shared decisions | A Slack research assistant that uses the discussion already in the thread |
| In your pocket | Identity, messaging, notifications, and short asynchronous interactions | A WhatsApp assistant that requests approval on the user's phone |
| On the web | The current page, selected record, and app state | An in-app agent that creates a persistent follow-up from the open record |
| In the room | Voice, vision, and physical surroundings | A spoken assistant that responds to a live situation |

## Judging criteria

The [published rubric](https://sf.aitinkerers.org/hackathons/h_XWWQL5eKfJM) evaluates projects globally, scoring each of these four criteria from 1–5. Use these criteria throughout planning and demo preparation; do not invent another scoring system.

| Official criterion | Evidence to build and demonstrate |
|---|---|
| Core Requirements & Functionality | One complete workflow works inside the intended environment, with an actual result. |
| Innovation & Theme Alignment | The environment enables a useful, original interaction. Explain what is lost if the context is removed. |
| Technical Execution & Integration | Tools, data, and the surface work together reliably. Show how a relevant error or cancellation is handled. |
| Usefulness & Agentic Experience | A clear user benefits from meaningful actions, understandable feedback, and appropriate control. |

The [submission checklist](SUBMISSION.md#evidence-for-the-judging-criteria) translates the same rubric into demo checks. Using more sponsors or adding more surfaces is not itself a scoring criterion.

## Choose infrastructure, then make the project yours

- [Slack](templates/slack.md): OpenAI + CopilotKit Channels + Exa for thread context, research, and native cards.
- [Web](templates/web.md): OpenAI + CopilotKit React + Ambiguous AI for page context and persistent workplace records.
- [WhatsApp](templates/whatsapp.md): OpenAI Agents SDK + CopilotKit Channels through Meta + Auth0 for a linked identity and phone approval.

All three templates let teams choose OpenAI directly or OpenRouter as the model provider. See [model switching](dev-docs/model-switching.md); the template's context, tools, and approval checks stay in place with either choice.

The incident app is a reference for wiring infrastructure. Change the user, problem, data, and interaction. Do not treat the sample scenario as the assigned challenge. Any technical stack is allowed by the handbook.

## Instructions for a coding agent

1. Establish the intended user and one task they need help with.
2. Choose the surface whose existing context helps complete that task.
3. Read the chosen template and the relevant sections of [using-sponsor-tools.md](using-sponsor-tools.md). Use [AGENTS.md](AGENTS.md) for repository constraints.
4. Implement the new core workflow during the event; record inherited pieces separately.
5. Verify an actual outcome, including a relevant failure or denied action. Distinguish sample data, local state, and external writes.
6. Prepare the deliverables in [hackathon-rules.md](hackathon-rules.md). Ask the team to confirm factual claims about when work was built.

Event guidance checked against the official portal and handbook on September 11, 2026. Organizer updates take precedence.
