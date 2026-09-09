import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Exercise the production stdio entry point. No ports, temp files, or credentials. */
export async function verifyMcp({
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "apps/mcp/src/stdio.ts"],
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {},
    stderr: "inherit",
  }),
  timeoutMs = 15000,
} = {}) {
  const client = new Client({ name: "offline-verifier", version: "1" });
  let timer;
  let interrupted;
  const interruption = new Promise((_, reject) => {
    interrupted = (signal) => reject(new Error(`MCP verification interrupted by ${signal}`));
    timer = setTimeout(() => reject(new Error(`MCP verification timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  const onInt = () => interrupted("SIGINT");
  const onTerm = () => interrupted("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  try {
    await Promise.race([
      interruption,
      (async () => {
        await client.connect(transport);
        assert.ok(client.getServerVersion(), "initialize must return server identity");
        const { tools } = await client.listTools();
        const card = tools.find((tool) => tool.name === "incident_card");
        assert.ok(card, "tools/list must expose incident_card");
        assert.equal(card._meta?.["openai/outputTemplate"], "ui://widget/incident-card.html");
        const result = await client.callTool({
          name: "incident_card",
          arguments: { headline: "Checkout latency above 4s", summary: "~12% of checkouts, EU" },
        });
        assert.ok(!result.isError, "incident_card must succeed");
        assert.equal(result.structuredContent?.headline, "Checkout latency above 4s");
        const resource = await client.readResource({ uri: "ui://widget/incident-card.html" });
        assert.ok(resource.contents.some((item) => typeof item.text === "string" && item.text.includes("window.openai")),
          "widget must serve the OpenAI bridge");
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    // The SDK closes stdin, then escalates to SIGTERM/SIGKILL only for this child.
    // Close the transport directly even if initialization failed partway through.
    try {
      await transport.close();
    } finally {
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyMcp();
    console.log("  initialize · tools/list · incident_card · widget resource passed");
  } catch (error) {
    console.error("MCP verification failed:", error);
    process.exitCode = 1;
  }
}
