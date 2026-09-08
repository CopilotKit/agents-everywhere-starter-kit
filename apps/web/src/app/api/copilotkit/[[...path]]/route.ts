/**
 * The web surface's runtime endpoint.
 *
 * A Hono app built at module scope; Next.js route handlers are fetch-based, so
 * `app.fetch` is the handler. The catch-all segment lets Hono route the
 * runtime's sub-paths itself.
 *
 * TWO THINGS TO NOT DO HERE:
 *
 * 1. Do NOT declare `channels` on this runtime, and never call
 *    `app.channels.ready()`. Next.js isolates freeze and recycle per request,
 *    so a cold start would mint a competing listener for the same Channel —
 *    and managed delivery is claim-based, so the loser silently gets nothing.
 *    The Channels listener is `apps/channel-slack`, a long-running process.
 *
 * 2. Do NOT reuse one agent instance across requests. The factory form hands
 *    out a fresh agent per resolution.
 */
import { randomUUID } from "node:crypto";
import { CopilotRuntime, createCopilotHonoHandler } from "@copilotkit/runtime/v2";
import { makeAgent } from "agent-core";

const runtime = new CopilotRuntime({
  agents: () => ({ default: makeAgent(randomUUID()) }),
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = app.fetch;
export const POST = app.fetch;
export const OPTIONS = app.fetch;
