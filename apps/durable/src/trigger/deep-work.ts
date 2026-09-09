/** Approved Exa research runs in Trigger and can be retrieved from its original thread. */
import { task, wait } from "@trigger.dev/sdk";
import { searchWeb } from "agent-core";
import { executeResearch, requireResearchConfig } from "../research";
import type { ApprovalDecision, ResearchPayload } from "../research";

export type { ApprovalDecision } from "../research";
export type DeepWorkPayload = ResearchPayload;

export const deepWork = task({
  id: "deep-work",
  maxDuration: 1800,
  run: async (payload: DeepWorkPayload) => {
    requireResearchConfig(process.env);
    return executeResearch(payload, {
      waitForDecision: () => wait.forToken<ApprovalDecision>(payload.tokenId),
      search: (request) => searchWeb({ query: request, results: 8 }),
    });
  },
});
