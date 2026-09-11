import { FollowupError } from "./followup-error";
/** Server-only, narrow adapter. Names/schemas discovered from live tools/list on 2026-09-11. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import {
  CallToolResultSchema,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { WorkplaceTask } from "../followup-types";
export type { WorkplaceTask } from "../followup-types";

export interface Workplace {
  identity(): Promise<{ id: string; workspaceId: string; name: string }>;
  list(marker: string): Promise<WorkplaceTask[]>;
  get(id: string): Promise<WorkplaceTask>;
  create(
    title: string,
    description: string,
    beforeWrite: () => Promise<void>,
  ): Promise<WorkplaceTask>;
}
export interface McpConnection {
  listTools(params?: { cursor?: string }): Promise<ListToolsResult>;
  callTool(input: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<CallToolResult>;
}
const taskSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  url: z.url().nullable().optional(),
});
const identitySchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  display_name: z.string().min(1),
});
const validators = new AjvJsonSchemaValidator();

function payload(result: CallToolResult): unknown {
  // Do not echo arbitrary provider error bodies (which can contain sensitive data).
  if (result.isError)
    throw new FollowupError(
      "Ambiguous rejected the operation. Check workspace access and tasks.read/tasks.write permissions.",
    );
  if (result.structuredContent) return result.structuredContent;
  const text = result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  try {
    return JSON.parse(text);
  } catch {
    throw new FollowupError(
      "Ambiguous returned an unreadable result; no record is confirmed.",
    );
  }
}
function task(value: unknown): WorkplaceTask {
  const parsed = taskSchema.safeParse(value);
  if (!parsed.success)
    throw new FollowupError("Ambiguous returned an invalid task record.");
  const { id, title, description, url } = parsed.data;
  if (url) {
    const link = new URL(url);
    if (
      link.protocol !== "https:" ||
      link.username ||
      link.password ||
      link.hostname !== "app.ambiguous.ai"
    ) {
      throw new FollowupError("Ambiguous returned an unsafe record link.");
    }
  }
  // The published Task schema does not promise a URL. Never manufacture one.
  return { id, title, description: description ?? "", url: url ?? null };
}

export class AmbiguousWorkplace implements Workplace {
  constructor(private connection: McpConnection) {}
  private async call(
    name: string,
    args: Record<string, unknown>,
    beforeCall?: () => Promise<void>,
  ) {
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await this.connection.listTools(cursor ? { cursor } : {});
      const tool = page.tools.find((t) => t.name === name);
      if (tool) {
        const valid = validators.getValidator(tool.inputSchema)(args);
        if (!valid.valid)
          throw new FollowupError(
            `Ambiguous ${name} schema changed; review the discovered input schema before writing.`,
          );
        await beforeCall?.();
        return payload(
          await this.connection.callTool({ name, arguments: args }),
        );
      }
      cursor = page.nextCursor;
      if (cursor && seen.has(cursor))
        throw new FollowupError(
          "Ambiguous tool schema pagination repeated a cursor.",
        );
      if (cursor) seen.add(cursor);
    } while (cursor);
    throw new FollowupError(
      `Ambiguous ${name} schema is unavailable. Recheck the connected workspace's MCP catalog.`,
    );
  }
  async identity() {
    const result = identitySchema.safeParse(await this.call("auth_whoami", {}));
    if (!result.success)
      throw new FollowupError(
        "Ambiguous identity has no usable workspace. Complete workspace setup first.",
      );
    return {
      id: result.data.id,
      workspaceId: result.data.workspace_id,
      name: result.data.display_name,
    };
  }
  async create(
    title: string,
    description: string,
    beforeWrite: () => Promise<void>,
  ) {
    const result = z
      .object({ task: z.unknown() })
      .parse(
        await this.call("create_task", { title, description }, beforeWrite),
      );
    return task(result.task);
  }
  async get(id: string) {
    z.uuid().parse(id);
    const result = z
      .object({ task: z.unknown() })
      .parse(await this.call("get_task", { id }));
    const record = task(result.task);
    if (record.id !== id)
      throw new FollowupError(
        "Ambiguous returned a different task ID than requested.",
      );
    return record;
  }
  async list(marker: string) {
    const records: WorkplaceTask[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const value = await this.call("list_tasks", {
        q: marker,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      const result = z
        .object({
          data: z.array(z.unknown()),
          has_more: z.boolean(),
          next_cursor: z.string().optional(),
        })
        .parse(value);
      records.push(...result.data.map(task));
      if (!result.has_more) return records;
      cursor = result.next_cursor;
      if (!cursor || seen.has(cursor))
        throw new FollowupError(
          "Ambiguous task pagination is incomplete; refresh before attempting a write.",
        );
      seen.add(cursor);
      if (seen.size >= 100)
        throw new FollowupError(
          "Ambiguous task pagination exceeded this demo's limit.",
        );
    } while (cursor);
    return records;
  }
}

export function configuredWorkplace(apiKey = process.env.AMBIGUOUS_API_KEY): {
  workplace: Workplace;
  close(): Promise<void>;
} {
  if (!apiKey?.trim())
    throw new FollowupError(
      "Set AMBIGUOUS_API_KEY in root .env to save and retrieve real workplace tasks.",
    );
  const client = new Client({
    name: "agents-everywhere-web",
    version: "0.1.0",
  });
  let connected: Promise<void> | undefined;
  const connect = () =>
    (connected ??= client.connect(
      new StreamableHTTPClientTransport(
        new URL("https://app.ambiguous.ai/mcp"),
        {
          requestInit: {
            headers: { Authorization: `Bearer ${apiKey.trim()}` },
          },
        },
      ),
      { timeout: 15_000 },
    ));
  const connection: McpConnection = {
    async listTools(params) {
      await connect();
      return client.listTools(params, { timeout: 15_000 });
    },
    async callTool(input) {
      await connect();
      return CallToolResultSchema.parse(
        await client.callTool(input, CallToolResultSchema, { timeout: 20_000 }),
      );
    },
  };
  return {
    workplace: new AmbiguousWorkplace(connection),
    close: () => client.close(),
  };
}
