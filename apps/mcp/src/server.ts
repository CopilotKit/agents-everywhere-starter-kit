/**
 * Streamable HTTP entry point — this is the one ChatGPT connects to.
 *
 * Stateless mode (`sessionIdGenerator: undefined`) keeps it deployable anywhere
 * and avoids in-memory session state that a restart would drop. A fresh
 * transport per request is what stateless means in practice.
 */
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp";

const port = Number(process.env.MCP_PORT ?? 3200);

const httpServer = createServer(async (req, res) => {
  if (req.url?.startsWith("/health")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404).end("Not found. The MCP endpoint is /mcp.");
    return;
  }

  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("[mcp] request failed:", error);
    if (!res.headersSent) res.writeHead(500).end("Internal error");
  }
});

httpServer.listen(port, () => {
  console.log(`\n  ✓ MCP server on http://localhost:${port}/mcp`);
  console.log(`    Claude Code:  claude mcp add --transport http everywhere http://localhost:${port}/mcp`);
  console.log(`    Codex:        codex mcp add everywhere --url http://localhost:${port}/mcp\n`);
});
