/**
 * Durable work that outlives the chat turn.
 *
 * This is the piece a Channels listener genuinely cannot do on its own. A Slack
 * turn is a request/response cycle; anything that takes ten minutes, survives a
 * restart, or needs to retry belongs here instead.
 *
 * The shape is: pause on a waitpoint until a human approves, then work.
 *
 *   channel tool  →  wait.createToken()  →  triggers this task
 *                 →  posts an approval card in Slack
 *   human taps    →  wait.completeToken()
 *   this task     →  wait.forToken() resolves  →  does the long thing
 *
 * That inverts the usual demo: instead of the chat turn blocking while work
 * happens, the work blocks while the human decides — and the thread stays live.
 */
import { logger, task, wait } from "@trigger.dev/sdk";
import { searchWeb } from "agent-core";

export type ApprovalDecision = {
  approved: boolean;
  /** Who decided, for the audit trail. */
  decidedBy?: string;
};

export type DeepWorkPayload = {
  /** The waitpoint this run pauses on. */
  tokenId: string;
  /** What the user actually asked for. */
  request: string;
  /** Where to report back, so the result lands where the work started. */
  origin: { platform: string; channelCode: string; threadRef?: string };
};

export const deepWork = task({
  id: "deep-work",
  // Generous, because the ceiling here is a human's attention span, not the model's.
  maxDuration: 1800,
  run: async (payload: DeepWorkPayload) => {
    logger.info("waiting for approval", { tokenId: payload.tokenId });

    const decision = await wait.forToken<ApprovalDecision>(payload.tokenId);

    if (!decision.ok) {
      // The token timed out. Say so plainly rather than proceeding.
      logger.warn("approval timed out", { tokenId: payload.tokenId });
      return { status: "timed_out" as const, request: payload.request };
    }

    if (!decision.output.approved) {
      logger.info("approval declined", { by: decision.output.decidedBy });
      return { status: "declined" as const, request: payload.request };
    }

    // ── the actual long work ─────────────────────────────────────────────────
    // Replace this with whatever your project does. It is a research sweep here
    // only because that is demoable without any extra credentials.
    logger.info("approved — starting work", { by: decision.output.decidedBy });

    const findings = await searchWeb({ query: payload.request, results: 8 });

    return {
      status: "done" as const,
      request: payload.request,
      decidedBy: decision.output.decidedBy,
      findings,
    };
  },
});
