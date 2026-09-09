# Sponsor recipes

Choose a sponsor because its capability improves your demo. All eight are optional additions except the model provider needed by the chat quickstart. Auth0 and Mozilla are independent examples; installing them is not required for root startup.

Each recipe below gives a concrete result to verify. Live account access, billing and external writes are separate from `npm run verify`. Organizer offers belong in [CREDITS.md](../CREDITS.md).

## OpenAI

- **Value:** Reason about the incident context and choose useful actions.
- **Access:** Create an [API key](https://platform.openai.com/api-keys) with access to the model you select.
- **Configure:** In root `.env`, set `MODEL_PROVIDER=openai`, `OPENAI_API_KEY`, and `MODEL=gpt-5.6-sol` (the kit default, subject to account availability).
- **Run:** From root, `npm run check-env`, then `npm run dev:local`. Describe the incident and ask for an assessment. Or run `npm run dev:web` to use the incident workspace.
- **Result:** An assessment grounded in the supplied or selected incident. In web, ask for an incident card and check its facts against the page.
- **Customize:** [prompt.ts](../packages/agent-core/src/prompt.ts), [agent.ts](../packages/agent-core/src/agent.ts), and [model.ts](../packages/agent-core/src/model.ts).
- **Status:** Chat adapter implemented. Live model access needs your key. `/voice` is a separate OpenAI Realtime path requiring an OpenAI key even when chat uses OpenRouter.

## CopilotKit

- **Value:** Give an agent the context and interactions of the surface where work happens.
- **Access:** Web needs your chosen model provider. Slack additionally needs an [Intelligence project](https://intelligence.copilotkit.ai/) and a platform installation; follow [setup](setup.md).
- **Configure:** Model settings in root `.env`; add `CHANNEL_CODE` and project-scoped `INTELLIGENCE_API_KEY` for Slack.
- **Run:** `npm run dev:web`, open `http://localhost:3100`, and ask “What is happening with the selected incident? Create a follow-up to investigate the retry spike.” For Slack, `npm run channel:setup`, then `npm run dev` after configuration, invite the bot and mention it in a populated thread.
- **Result:** The browser's selected incident informs the answer and a follow-up appears on the page. In Slack, `read_thread` informs `incident_card` and `timeline` native cards.
- **Customize:** [frontend actions](../apps/web/src/components/app-control.tsx), [web page](../apps/web/src/app/page.tsx), and [Slack tools](../apps/channel-slack/src/tools.tsx).
- **Status:** Implemented, with sample/session-only browser tasks. Slack/Teams installation and live delivery need validation. Approval UI alone does not perform production actions. See [surface differences](surfaces.md).

## OpenRouter

- **Value:** Choose a model through one gateway and compare how it handles the same incident and tools.
- **Access:** Obtain an [OpenRouter key](https://openrouter.ai/keys); choose an available [model slug](https://openrouter.ai/models).
- **Configure:** Root `.env`: `MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `MODEL=openai/gpt-5.6-sol` or your chosen publisher/model. No OpenAI chat key is required.
- **Run:** `npm run check-env`, then `npm run dev:local` or `npm run dev:web`. Repeat the same incident question after changing `MODEL` and restarting.
- **Result:** A response through the selected model. Verify model/provider usage in your account; compare source fidelity and successful tool execution rather than prose alone.
- **Customize:** [model.ts](../packages/agent-core/src/model.ts); optional `PUBLIC_APP_URL` and `APP_TITLE` set attribution headers.
- **Status:** Chat-completions adapter implemented. Model availability and tool behavior depend on the selected model. See [provider precedence](model-switching.md).

## Exa

- **Value:** Ground investigation suggestions in inspectable public sources.
- **Access:** Obtain an [Exa API key](https://dashboard.exa.ai/api-keys).
- **Configure:** Root `.env`: `EXA_API_KEY` and `EXA_SEARCH_TYPE=fast`, plus Slack/model settings for this recipe.
- **Run:** `npm run dev:slack`. In the incident thread ask: “Use web search to find documented causes of payment-worker retry storms. Include source links and distinguish general guidance from our incident facts.”
- **Result:** `search_web` returns source URLs and the answer cites them. Open the links to verify the claims. Public web search does not inspect your logs.
- **Customize:** [search.ts](../packages/agent-core/src/capabilities/search.ts) and [Slack search tool](../apps/channel-slack/src/tools.tsx).
- **Status:** Implemented in Slack, MCP and the voice search route; not registered in terminal or web chat. Live search needs the key. Trigger research additionally needs its worker configured with Exa.

## Trigger.dev

- **Value:** Research can wait for approval and finish after the initiating chat turn.
- **Access:** Create a [Trigger.dev project](https://cloud.trigger.dev) and obtain its Development secret key/project ref. Exa supplies the research.
- **Configure:** Root `.env`: `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `EXA_API_KEY`, and Slack/model settings. Add project ref and Exa key to ignored `apps/durable/.env` for the worker as described in [durable setup](durable-work.md).
- **Run:** In one terminal, `cd apps/durable` and `npx trigger.dev@latest dev --env-file .env`. In another, from root, `npm run dev:slack`. Ask for background web research using `run_deep_work`; approve while the listener is running. Then ask `check run_YOUR_ID` in the same thread.
- **Result:** `check_deep_work` posts the actual run status or research sources in the originating conversation. Canceling a separate run prevents research.
- **Customize:** [deep-work.ts](../apps/durable/src/trigger/deep-work.ts) and [durable.tsx](../apps/channel-slack/src/durable.tsx).
- **Status:** Worker and retrieval path implemented; live accounts required. Results are requested, not pushed. Inline approval buttons require the listener to remain running until clicked; retrieval after approval survives its restart.

## Auth0

- **Value:** Permit a concrete incident action only for an authorized service identity.
- **Access:** Create an Auth0 tenant, RS256 API, `create:followups` permission, and a machine-to-machine application granted that permission. [Full setup](../examples/auth0/README.md)
- **Configure:** `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` in root ignored `.env`. The server needs only domain/audience; the client needs all four.
- **Run:** From root, `npm ci --prefix examples/auth0`, then `npm test --prefix examples/auth0`. For the live demonstration run `node --env-file=.env examples/auth0/server.mjs` and, in another terminal, `node --env-file=.env examples/auth0/client.mjs`.
- **Result:** An unauthenticated call gets 401; an authorized call gets 201 and prints a local incident follow-up record. Tokens are not printed.
- **Customize:** [client.mjs](../examples/auth0/client.mjs) for incident input; [server.mjs](../examples/auth0/server.mjs) for the protected action.
- **Status:** Runnable standalone recipe with offline JWT/scope tests. Records last until the local server stops. Live Auth0 flow requires your tenant. This is machine authorization, not human consent, CIBA, or a Trigger integration; the CIBA extension remains unimplemented.

## Mozilla.ai

- **Value:** Inspect an agent's incident tool call and result through a saved trace.
- **Access:** Install Python 3.11–3.13 and use an OpenAI API key for this focused example; no Mozilla account is required. [Full setup](../examples/mozilla/README.md)
- **Configure:** Export `OPENAI_API_KEY` in your environment. The Python script does not automatically load root `.env`; use your secret manager. Default model is `openai:gpt-4o-mini`, independent of root `MODEL`.
- **Run:** From root:

```bash
python3.12 -m venv examples/mozilla/.venv
examples/mozilla/.venv/bin/python -m pip install -r examples/mozilla/requirements.txt
examples/mozilla/.venv/bin/python -m unittest discover -s examples/mozilla -v
examples/mozilla/.venv/bin/python examples/mozilla/trace_incident.py
```

- **Result:** Mozilla `any-agent` TinyAgent calls `read_incident`, prints an assessment, and saves `examples/mozilla/traces/incident.json`. Inspect the tool span and output. Use `--model openai:MODEL_NAME` to select another supported OpenAI model.
- **Customize:** [trace_incident.py](../examples/mozilla/trace_incident.py), including the synthetic incident fixture.
- **Status:** Runnable independent Python recipe with offline checks. Live model execution requires your key. This demonstrates trace inspection, not a complete evaluation framework or a replacement for the shared TypeScript agent.

## Ambiguous AI

- **Value:** Turn the incident assessment into an actual workplace follow-up with a record link.
- **Access:** Create a demo workspace/key using [Ambiguous AI](https://www.ambiguous.ai/): `npx ambiguous auth signup --name "On-call agent" --human-email you@example.com`. Use your own email.
- **Configure:** Root `.env`: `AMBIGUOUS_API_KEY`, selected model settings, and Slack settings for this recipe.
- **Run:** `npm run dev:slack`. Ask: “Propose creating one task in our Ambiguous workspace: Investigate payments-worker retry spike. Include this thread's facts. Ask for approval before creating it; do not send mail or change production.” Review and approve the intended demo write, then ask it to create the approved task and return its record URL.
- **Result:** Open the returned URL and verify the actual record's title/content. If the connected MCP response does not provide a usable record link, complete that integration before treating the demo as successful.
- **Customize:** [workplace.ts](../packages/agent-core/src/capabilities/workplace.ts) and [prompt.ts](../packages/agent-core/src/prompt.ts).
- **Status:** Optional shared-agent MCP configuration implemented; live workspace tools and writes are unverified by offline checks. The approval prompt/card is not an enforced wrapper around every MCP tool. Use an isolated demo workspace and approve a concrete write. This path is different from the browser's session-only follow-ups.
