import { z } from "zod";

const nonempty = z.string().trim().min(1);
export const researchOriginSchema = z.object({
  platform: nonempty,
  channelCode: nonempty,
  conversationKey: nonempty,
});
export const researchPayloadSchema = z.object({
  tokenId: nonempty,
  request: nonempty.max(2000),
  origin: researchOriginSchema,
});
export type ResearchOrigin = z.infer<typeof researchOriginSchema>;
export type ResearchPayload = z.infer<typeof researchPayloadSchema>;
export const approvalDecisionSchema = z.object({
  approved: z.boolean(),
  decidedBy: nonempty.optional(),
});
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
const findingsSchema = z.array(z.object({
  title: z.string(), url: z.url(), highlight: z.string().optional(),
}));
const resultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("done"), findings: findingsSchema }),
  z.object({ status: z.literal("declined") }),
  z.object({ status: z.literal("timed_out") }),
]);

// Slack's string transport becomes one section capped at 3,000 characters.
// Budget the escaped message, keep each URL whole, and post sources separately.
const sectionLimit = 3000;
function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function literalExcerpt(text: string, limit: number): string {
  // Code spans prevent source-supplied Markdown links from becoming controls.
  const plain = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/`/g, "'");
  let result = "";
  for (const char of plain) {
    const escaped = escapeText(char);
    if (result.length + escaped.length > limit - 2) break;
    result += escaped;
  }
  return result ? `\`${result}\`` : "";
}

function referenceMessage(hit: z.infer<typeof findingsSchema>[number], index: number): string {
  const label = `Source ${index + 1}`;
  const url = new URL(hit.url);
  let link: string;
  if (!["http:", "https:"].includes(url.protocol) || /[\u0000-\u0020\u007f]/.test(hit.url) || url.username || url.password) {
    link = `${label}: URL omitted (requires an HTTP(S) URL without credentials or control characters).`;
  } else {
    // Encode Markdown delimiters before the codec translates this link to Slack.
    const encoded = hit.url.replace(/[()*_~`<>|\[\]\\]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    link = `[${label}](${escapeText(encoded)})`;
    if (link.length > sectionLimit) {
      link = `${label}: URL omitted (too long for Slack; inspect the complete source in the Trigger run output).`;
    }
  }
  const title = literalExcerpt(hit.title, Math.min(122, sectionLimit - link.length - 1));
  const highlight = literalExcerpt(hit.highlight ?? "", Math.min(302, sectionLimit - link.length - title.length - 2));
  return [title, link, highlight].filter(Boolean).join("\n");
}

/** Both the listener and the Trigger worker need their own configured environment. */
export function requireResearchConfig(env: NodeJS.ProcessEnv): void {
  for (const name of ["TRIGGER_SECRET_KEY", "EXA_API_KEY", "TRIGGER_PROJECT_REF"] as const) {
    const value = env[name]?.trim();
    if (!value || /replace|your[_-]|^<|\.\.\./i.test(value)) {
      throw new Error(`Set ${name} to use durable Exa research.`);
    }
  }
  if (!/^proj_[a-zA-Z0-9]+$/.test(env.TRIGGER_PROJECT_REF!.trim())) {
    throw new Error("TRIGGER_PROJECT_REF must be the proj_ reference from your Trigger dashboard.");
  }
}

/** Errors deliberately propagate so Trigger retries and records a failed run. */
export async function executeResearch(payload: ResearchPayload, deps: {
  waitForDecision: () => Promise<{ ok: false } | { ok: true; output: unknown }>;
  search: (request: string) => Promise<unknown>;
}) {
  const input = researchPayloadSchema.parse(payload);
  const decision = await deps.waitForDecision();
  if (!decision.ok) return { status: "timed_out" as const };
  const approved = approvalDecisionSchema.parse(decision.output);
  if (!approved.approved) return { status: "declined" as const };
  const result = await deps.search(input.request);
  if (typeof result === "string") throw new Error(result);
  return { status: "done" as const, findings: findingsSchema.parse(result) };
}

/**
 * Delivery happens in a new, live Channels turn: managed MessageRefs cannot be
 * reused across deliveries and Channels 0.9.2 has no public proactive-send API.
 * The caller supplies that turn's post transport. Never return another
 * conversation's results just because a model supplied a valid run ID.
 */
export async function reportResearch(runId: string, origin: ResearchOrigin, deps: {
  retrieve: (id: string) => Promise<{ status: string; payload?: unknown; output?: unknown }>;
  post: (text: string) => Promise<void>;
}): Promise<string> {
  const run = await deps.retrieve(runId);
  const input = researchPayloadSchema.parse(run.payload);
  const current = researchOriginSchema.parse(origin);
  if (input.origin.platform !== current.platform ||
      input.origin.channelCode !== current.channelCode ||
      input.origin.conversationKey !== current.conversationKey) {
    throw new Error("Research results can only be retrieved in their original conversation.");
  }
  const prefix = `Research ${runId}`;
  let text: string;
  if (run.status === "COMPLETED") {
    const output = resultSchema.parse(run.output);
    if (output.status === "done") {
      await deps.post(`${prefix} completed. Exa references:${output.findings.length ? "" : " No results found for this request."}`);
      for (const [index, hit] of output.findings.slice(0, 8).entries()) {
        await deps.post(referenceMessage(hit, index));
      }
      return "Posted the research status and source references in this conversation; any unusable URLs are explicitly marked.";
    } else {
      text = `${prefix}: ${output.status === "declined" ? "approval declined" : "approval timed out"}. No search ran.`;
    }
  } else {
    // Do not expose raw provider errors (which may include sensitive details).
    text = `${prefix}: ${run.status}. ${["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"].includes(run.status)
      ? "Research did not complete. Inspect this run in your Trigger dashboard before retrying."
      : "Ask me to check this run again later."}`;
  }
  await deps.post(text);
  return "Posted the research status and any sources in this conversation.";
}
