/**
 * Queue approved Exa research without holding the conversation open. The worker
 * persists in Trigger; check_deep_work retrieves its outcome in a later turn.
 * Inline approval buttons require the listener to remain running until clicked.
 */
import { defineChannelTool } from "@copilotkit/channels";
import type { InteractionContext } from "@copilotkit/channels";
import { tasks, runs, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import { approvalCard, settleApproval } from "./approval";
import type { deepWork } from "durable/trigger/deep-work";
import { reportResearch, requireResearchConfig, researchOriginSchema } from "durable/research";

export function isDurableConfigured(): boolean {
  if (!process.env.TRIGGER_SECRET_KEY?.trim()) return false;
  requireResearchConfig(process.env);
  return true;
}

export const runDeepWork = defineChannelTool({
  name: "run_deep_work",
  description:
    "Queue Exa web research after human approval. This searches public web sources; it cannot read logs or execute external actions. The user must ask check_deep_work with the run ID to receive results in this thread.",
  parameters: z.object({
    request: z.string().trim().min(1).max(2000).describe("The public-web research question."),
  }),
  async handler({ request }, { thread }) {
    requireResearchConfig(process.env);
    const origin = researchOriginSchema.parse({
      platform: thread.platform,
      channelCode: process.env.CHANNEL_CODE,
      // The concrete SDK Thread exposes this documented property; its UI
      // interface omits it in 0.9.2. Validate at runtime rather than cast.
      conversationKey: "conversationKey" in thread ? thread.conversationKey : undefined,
    });
    // A generous timeout: the ceiling is a human's attention, not the model's.
    const token = await wait.createToken({
      timeout: "30m",
      tags: [`channel:${process.env.CHANNEL_CODE ?? "unknown"}`],
    });

    // Type-only import of the task, so the task's code is never bundled here.
    const run = await tasks.trigger<typeof deepWork>("deep-work", {
      tokenId: token.id,
      request,
      origin,
    });

    const settle = async (approved: boolean, ctx: InteractionContext<boolean>) => {
      // Credit the person who actually clicked, not whoever asked.
      const decidedBy = ctx.user?.name ?? ctx.actor?.id ?? "someone in this thread";
      const outcome = await settleApproval(token.id, run.id, { approved, decidedBy }, {
        complete: (id, decision) => wait.completeToken(id, decision),
        retrieve: (id) => wait.retrieveToken(id),
      });

      // Only the ref stamped for this live interaction can be updated safely.
      if (ctx.message.ref.id) await ctx.thread.update(ctx.message.ref, outcome);
      else await ctx.thread.post(outcome);
    };

    await thread.post(approvalCard(request, run.id, settle));

    // Return immediately. The agent must NOT wait here — that is the whole point.
    return `Queued Exa research ${run.id} and posted an approval card. After approval, ask me to check ${run.id} in this conversation. Results are retrieved on request, not pushed automatically. The worker survives restarts, but these inline approval buttons require the listener to stay running until clicked. Do not attempt the work yourself.`;
  },
});

/** Retrieve by visible run ID; origin validation also works after a listener restart. */
export const checkDeepWork = defineChannelTool({
  name: "check_deep_work",
  description: "Check a previously queued Exa research run and show its status or sources in its original conversation. Use the run ID shown on the approval card.",
  parameters: z.object({ runId: z.string().regex(/^run_[a-zA-Z0-9]+$/) }),
  async handler({ runId }, { thread }) {
    return reportResearch(runId, researchOriginSchema.parse({
      platform: thread.platform,
      channelCode: process.env.CHANNEL_CODE,
      // The concrete SDK Thread exposes this documented property; its UI
      // interface omits it in 0.9.2. Validate at runtime rather than cast.
      conversationKey: "conversationKey" in thread ? thread.conversationKey : undefined,
    }), {
      retrieve: (id) => runs.retrieve<typeof deepWork>(id),
      post: async (text) => { await thread.post(text); },
    });
  },
});
