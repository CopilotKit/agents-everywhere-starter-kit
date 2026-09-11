/** Read-only schema discovery; initialization and tools/list require no account. */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { configuredWorkplace } from "../src/lib/server/workplace";

async function main() {
  const client = new Client({
    name: "agents-everywhere-schema-check",
    version: "0.1.0",
  });
  const validator = new AjvJsonSchemaValidator();
  const inputs = {
    auth_whoami: {},
    create_task: {
      title: "Schema check only — never sent",
      description: "No task is created by this script.",
    },
    get_task: { id: "11111111-1111-4111-8111-111111111111" },
    list_tasks: {
      q: "agents-everywhere:INC-1042",
      limit: 100,
      cursor: "schema-check",
    },
  };
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL("https://app.ambiguous.ai/mcp"),
      ),
      { timeout: 15_000 },
    );
    const tools: Tool[] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, {
        timeout: 15_000,
      });
      tools.push(...page.tools);
      cursor = page.nextCursor;
      if (cursor) {
        assert.ok(!cursors.has(cursor), "Repeated catalog cursor");
        cursors.add(cursor);
      }
    } while (cursor);
    for (const [name, input] of Object.entries(inputs)) {
      const tool = tools.find((t) => t.name === name);
      assert.ok(tool, `Missing MCP tool: ${name}`);
      assert.ok(
        validator.getValidator(tool.inputSchema)(input).valid,
        `${name} input schema changed`,
      );
      console.log(`Verified live MCP input schema: ${name}`);
    }
    console.log(
      `Discovered ${tools.length} tools. No workspace tool calls or writes were made.`,
    );
  } finally {
    await client.close();
  }
  if (process.argv.includes("--identity")) {
    const connection = configuredWorkplace();
    try {
      console.log("Connected identity:", await connection.workplace.identity());
    } finally {
      await connection.close();
    }
  }
}
main().catch(() => {
  console.error(
    "Workplace check failed. Inspect the live catalog, network access, and (with --identity) AMBIGUOUS_API_KEY and workspace permissions.",
  );
  process.exitCode = 1;
});
