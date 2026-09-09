# Approved research with Trigger.dev

`run_deep_work` queues public-web research and posts an approval card. The worker waits up to 30 minutes for a decision, then calls Exa only when approved. The chat turn can finish while the job is waiting.

**Results are retrieved on request.** The card shows a `run_...` ID. Ask the agent to check that ID in the original conversation; `check_deep_work` retrieves the stored run, validates its originating Channel/conversation, and posts status or sources there. Results are not pushed automatically.

## Setup

1. Create a [Trigger.dev project](https://cloud.trigger.dev) and obtain its project ref and Development secret key. Use a key with the permissions required to trigger/retrieve runs and create/complete waitpoints.
2. Add `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`, and `EXA_API_KEY` to root `.env` for the Slack listener.
3. Create an ignored `apps/durable/.env` containing the same project ref and Exa key for the worker. Do not assume the worker reads root `.env`.
4. Start the worker from its project directory:

```bash
cd apps/durable
npx trigger.dev@latest dev --env-file .env
```

Follow CLI login if requested. The `--env-file` option loads the project ref into the CLI/config process; the worker's local `.env` also supplies Exa to task processes. See [CLI options](https://trigger.dev/docs/cli-dev-commands) and [task environment variables](https://trigger.dev/docs/deploy-environment-variables). For deployed tasks, configure Exa in the appropriate Trigger dashboard environment as well.

In another terminal, from the repository root:

```bash
npm run check-env
npm run dev:slack
```

The run/check tools are optional and require the configured Trigger path. A project ref and working worker are needed in addition to the listener's key.

## Demonstrate the complete loop

In an existing Slack incident thread:

> @agent queue background web research about payment-worker retry storms and safe investigation steps. Use run_deep_work.

1. Copy the displayed run ID.
2. Click **Approve** while the listener remains running. The card identifies that the question will be sent to Exa; it does not grant log access or production actions.
3. Continue chatting, then ask: `@agent check run_YOUR_ID` in that same thread.
4. Confirm the returned source links or explicit pending/failure outcome.
5. Optionally restart the listener after approval and retrieve the same ID again. Retrieval does not depend on an in-memory run map.

Try **Cancel** in a separate run: no research should execute. An unanswered waitpoint expires. The check tool reports declined, timed-out, pending, failed, or completed outcomes instead of pretending every run succeeded. Repeated checks may post the result again.

## Boundaries

The worker can outlive a chat turn and the listener. **Inline approval buttons require one listener instance and cannot survive a restart or route to another replica**; approve before restarting, or queue a new run. An old unapproved run will expire. The implementation does not expose a supported outbound Channels transport for automatic worker-to-thread pushes, so the explicit check is part of the demo.

`propose_action` separately posts a nonblocking proposal. Its click reports the decision only; it neither runs production commands nor automatically resumes the agent. `apps/durable/src/approvals.ts` remains an unimplemented CIBA extension. The runnable [Auth0 example](../examples/auth0/README.md) demonstrates machine authorization, not human consent or Trigger integration.

Customize [the worker](../apps/durable/src/trigger/deep-work.ts) and [the Channel tools](../apps/channel-slack/src/durable.tsx). Offline tests cover the research decision and result-retrieval behavior; a live Slack/Trigger/Exa round trip requires your accounts.
