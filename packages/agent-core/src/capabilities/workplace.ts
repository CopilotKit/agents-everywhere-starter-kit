/**
 * The workplace the agent acts in.
 *
 * Ambiguous AI is a 17-app workspace (mail, tasks, CRM, docs, calendar, …)
 * exposed as a single MCP server, which makes it the fastest way to give an
 * agent somewhere real to *do* something rather than just talk about it. For an
 * on-call agent that means filing the follow-up, mailing the summary, and
 * opening the postmortem task without a human copy-pasting.
 *
 * Provision a workspace and key in one command:
 *
 *   npx ambiguous auth signup --name "On-call agent" --human-email you@example.com
 *
 * Without AMBIGUOUS_API_KEY this contributes nothing — the agent is simply never
 * told it has a workplace, rather than being handed tools that 401.
 */
import type { MCPClientConfig } from "@copilotkit/runtime/v2";

const AMBIGUOUS_MCP_URL = "https://app.ambiguous.ai/mcp";

export function isWorkplaceConfigured(): boolean {
  return Boolean(process.env.AMBIGUOUS_API_KEY);
}

/**
 * Spreadable so an unconfigured workplace adds no entry at all.
 *
 * Note the shape: `MCPClientConfigHTTP` takes `options`
 * (StreamableHTTPClientTransportOptions), NOT a `headers` field — only the
 * `sse` variant has that. Authenticated HTTP MCP servers need a wrapped
 * `options.fetch`, which is the SDK's documented extension point.
 */
export function workplaceMcpServers(): MCPClientConfig[] {
  const apiKey = process.env.AMBIGUOUS_API_KEY;
  if (!apiKey) return [];

  return [
    {
      type: "http",
      url: AMBIGUOUS_MCP_URL,
      options: {
        fetch: (url, init) =>
          fetch(url, {
            ...init,
            headers: { ...init?.headers, Authorization: `Bearer ${apiKey}` },
          }),
      },
    },
  ];
}

/** Told to the agent as context, so it knows what it can reach. */
export const WORKPLACE_CONTEXT =
  "You have an Ambiguous AI workspace available over MCP: mail, tasks, CRM, docs, sheets, calendar and drive. Use it to make follow-ups real — file the task, send the summary, open the postmortem doc — instead of telling someone else to do it. It is still a write to a shared system, so the approval rule applies.";
