/**
 * Procurebot's runtime endpoint for the ERP chat panel. No `channels` here:
 * the Slack Channel, when added, runs as its own long-lived listener.
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { makeAgent } from "agent-core";
import { closePool } from "procure-db";
import { PROCUREBOT_PROMPT } from "./prompt";
import { procurementTools } from "./tools";

const runtime = new CopilotRuntime({
  agents: () => ({
    default: makeAgent(randomUUID(), { prompt: PROCUREBOT_PROMPT, workplace: false, tools: procurementTools }),
  }),
});

const server = createServer(createCopilotNodeListener({ runtime, basePath: "/api/copilotkit" }));
const port = Number(process.env.PROCURE_AGENT_PORT ?? 3002);
server.listen(port, () => {
  console.log(
    `\n  ✓ Procurebot agent on http://localhost:${port}/api/copilotkit  (model: ${process.env.MODEL_PROVIDER ?? "auto"} ${process.env.MODEL ?? ""})\n`,
  );
});

const shutdown = async () => {
  server.close();
  await closePool();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
