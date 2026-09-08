/**
 * Where an approval request goes.
 *
 * Two tiers, and the difference is deliberate:
 *
 *   IN_THREAD  — a button in the Slack thread. Cheap, instant, and the right
 *                default. Implemented and working.
 *
 *   OUT_OF_BAND — a push to the person's phone via Auth0 CIBA, for the actions
 *                where "someone clicked a button in a channel" is not a strong
 *                enough claim about who approved it. This is a SEAM, not an
 *                implementation — see below.
 */
export type ApprovalTier = "in_thread" | "out_of_band";

export interface ApprovalRequest {
  /** The waitpoint to complete when the human decides. */
  tokenId: string;
  action: string;
  consequence: string;
  /** Auth0 `sub`, email, or whatever your login_hint format is. */
  subject?: string;
}

/**
 * Escalate an approval out of band.
 *
 * NOT IMPLEMENTED — and deliberately left as a throwing stub rather than a
 * plausible-looking guess.
 *
 * The CIBA flow itself is clear: POST to `/bc-authorize` with the user
 * identifier, get back an `auth_req_id`, then poll `/oauth/token` until the
 * person approves on their device. What is NOT in the overview docs is the
 * exact parameter set (`binding_message`, the `login_hint` format, `audience`,
 * the `grant_type` URN) or the polling error codes. Writing those from memory is
 * how you get an integration that returns 400 for reasons nobody can see.
 *
 * To finish it, read:
 *   https://auth0.com/ai/docs/get-started/asynchronous-authorization
 *   https://auth0.com/ai/docs/intro/asynchronous-authorization
 *
 * Then complete the waitpoint from your callback with
 * `wait.completeToken(tokenId, { approved, decidedBy })` — the durable task is
 * already waiting on it, so nothing else in the chain changes.
 */
export async function requestOutOfBandApproval(_request: ApprovalRequest): Promise<never> {
  throw new Error(
    "Out-of-band approval is not wired up. Implement Auth0 CIBA in apps/durable/src/approvals.ts, " +
      "then complete the waitpoint with wait.completeToken(tokenId, { approved, decidedBy }). " +
      "See https://auth0.com/ai/docs/get-started/asynchronous-authorization",
  );
}
