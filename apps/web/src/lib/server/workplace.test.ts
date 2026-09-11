import assert from "node:assert/strict";
import test from "node:test";
import type {
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  AmbiguousWorkplace,
  configuredWorkplace,
  type McpConnection,
} from "./workplace";
const id = "11111111-1111-4111-8111-111111111111";
const task = { id, title: "Follow up", description: "Marker" };
const catalog: ListToolsResult = {
  tools: [
    {
      name: "create_task",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    {
      name: "get_task",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "list_tasks",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string" },
          limit: { type: "integer" },
          cursor: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "auth_whoami",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
};
class Connection implements McpConnection {
  catalog = catalog;
  result: CallToolResult = {
    content: [{ type: "text", text: JSON.stringify({ task }) }],
  };
  calls: { name: string; arguments: Record<string, unknown> }[] = [];
  async listTools() {
    return this.catalog;
  }
  async callTool(input: { name: string; arguments: Record<string, unknown> }) {
    this.calls.push(input);
    return this.result;
  }
}
test("missing credentials fail clearly; no local task fallback", () => {
  assert.throws(() => configuredWorkplace(" "), /AMBIGUOUS_API_KEY/);
});
test("real MCP text and structured results return provider IDs and never synthesize links", async () => {
  const c = new Connection();
  const api = new AmbiguousWorkplace(c);
  assert.deepEqual(await api.create("Follow up", "Marker", async () => {}), {
    ...task,
    url: null,
  });
  c.result = {
    content: [],
    structuredContent: {
      task: { ...task, url: "https://app.ambiguous.ai/returned-record-link" },
    },
  };
  assert.equal(
    (await api.get(id)).url,
    "https://app.ambiguous.ai/returned-record-link",
  );
});
test("schema drift prevents writes before callTool", async () => {
  const c = new Connection();
  c.catalog = { tools: [] };
  await assert.rejects(
    new AmbiguousWorkplace(c).create("Follow up", "Marker", async () => {}),
    /schema/,
  );
  assert.equal(c.calls.length, 0);
  c.catalog = {
    tools: [
      {
        ...catalog.tools[0],
        inputSchema: {
          ...catalog.tools[0].inputSchema,
          required: ["new_required_argument"],
        },
      },
    ],
  };
  await assert.rejects(
    new AmbiguousWorkplace(c).create("Follow up", "Marker", async () => {}),
    /schema/,
  );
  assert.equal(c.calls.length, 0);
});
test("MCP errors, malformed results, mismatched IDs and unsafe links are visible failures", async () => {
  for (const result of [
    {
      content: [
        { type: "text" as const, text: "credential details must not leak" },
      ],
      isError: true,
    },
    { content: [{ type: "text" as const, text: "not json" }] },
    { content: [], structuredContent: { task: { title: "no ID" } } },
    {
      content: [],
      structuredContent: {
        task: { ...task, id: "22222222-2222-4222-8222-222222222222" },
      },
    },
    {
      content: [],
      structuredContent: { task: { ...task, url: "javascript:alert(1)" } },
    },
  ]) {
    const c = new Connection();
    c.result = result;
    await assert.rejects(
      new AmbiguousWorkplace(c).get(id),
      (e) => e instanceof Error && !e.message.includes("credential details"),
    );
  }
});
test("task listing uses provider pagination and fails on incomplete pagination", async () => {
  const c = new Connection();
  c.result = {
    content: [],
    structuredContent: { data: [task], has_more: false },
  };
  assert.equal((await new AmbiguousWorkplace(c).list("Marker")).length, 1);
  c.result = {
    content: [],
    structuredContent: { data: [task], has_more: true },
  };
  await assert.rejects(new AmbiguousWorkplace(c).list("Marker"), /pagination/);
});

test("the approval guard runs after schema discovery immediately before the MCP write", async () => {
  const c = new Connection();
  let discovered = false;
  c.listTools = async () => {
    discovered = true;
    return catalog;
  };
  await assert.rejects(
    new AmbiguousWorkplace(c).create("Follow up", "Marker", async () => {
      assert.equal(discovered, true);
      throw new Error("approval expired");
    }),
    /approval expired/,
  );
  assert.equal(c.calls.length, 0);
});
