import { BuiltInAgent } from "@copilotkit/runtime/v2";
import { resolveModel } from "./model";
import { SYSTEM_PROMPT } from "./prompt";
import { workplaceMcpServers } from "./capabilities/workplace";

/**
 * The agent factory.
 *
 * Return a FRESH agent per threadId — never share one stateful instance across
 * conversations. Channels clones the agent per turn anyway, but a factory is the
 * documented shape and keeps per-thread state honest.
 *
 * To swap in LangGraph, CrewAI, Mastra, Pydantic AI, or Google ADK, replace the
 * body with an HttpAgent pointed at your agent's AG-UI endpoint:
 *
 *   import { HttpAgent } from "@ag-ui/client";
 *   return new HttpAgent({ url: process.env.AGENT_URL! });
 *
 * Nothing else in the kit changes. That is the point of AG-UI.
 */
export function makeAgent(threadId: string) {
  const agent = new BuiltInAgent({
    model: resolveModel(),
    prompt: SYSTEM_PROMPT,

    // NOT optional in practice. maxSteps defaults to 1, which means the agent
    // can call one tool and then stops — before it ever sees the result. Any
    // agent with tools needs room to loop.
    maxSteps: 10,

    // The workplace, when one is configured. Empty array when it is not, so the
    // agent is never handed tools that would 401. Add your own MCP servers here
    // the same way — note HTTP transport takes `options` (with a wrapped
    // `options.fetch` for auth), not `headers`.
    mcpServers: [...workplaceMcpServers()],
  });
  agent.threadId = threadId;
  return agent;
}
