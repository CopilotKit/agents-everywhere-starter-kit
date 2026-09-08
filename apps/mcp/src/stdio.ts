/**
 * stdio entry point — for Claude Desktop, Claude Code and Codex, which spawn
 * the server as a child process rather than calling it over HTTP.
 *
 * Nothing may be written to stdout except protocol frames, so every log here
 * goes to stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp";

const server = createMcpServer();
await server.connect(new StdioServerTransport());
console.error("[mcp] stdio transport ready");
