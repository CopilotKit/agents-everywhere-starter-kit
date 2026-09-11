import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createChannel } from "@copilotkit/channels";
import { startChannelsWithGatewayControl } from "@copilotkit/channels-intelligence";
import type { searchWeb } from "agent-core";
import { z } from "zod";
import { createSearchTool } from "./search";
import {
  ManagedGateway,
  preparedDelivery,
  concreteThread,
} from "./testing/managed-gateway";

async function searchDelivery(
  search: typeof searchWeb,
  gateway = new ManagedGateway(),
) {
  const channel = createChannel({ name: "support", identifyUser: "platform" });
  const tool = createSearchTool(search);
  let result: unknown;
  let failure: unknown;
  channel.onMessage(async ({ thread }) => {
    try {
      result = await tool.handler(
        { query: "retry storm", results: 10 },
        {
          thread: concreteThread(thread),
          user: { id: "u1", name: "Priya" },
          actor: { id: "a1", kind: "human" },
          platform: "slack",
        },
      );
    } catch (error) {
      failure = error;
      throw error;
    }
  });
  const handle = await startChannelsWithGatewayControl([channel], {
    session: gateway,
    scope: { projectId: 1, channelName: "support" },
    runtimeInstanceId: "rti_search",
    runCanonical: async (args) => args.execute({}),
    loadHistory: async () => [],
  });
  try {
    await gateway.deliver(
      preparedDelivery("research", "slack", {
        kind: "text",
        text: "Find sources",
      }),
    );
    return {
      result,
      failure,
      payloads: gateway.packets.map(({ payload }) => payload),
    };
  } finally {
    await handle.stop();
  }
}

describe("search_web source delivery", () => {
  it("posts all returned source URLs natively even without any agent prose", async () => {
    const hits = Array.from({ length: 10 }, (_, i) => ({
      title: `Reference ${i + 1}`,
      url: `https://example.com/reference/${i + 1}?a=1&b=2`,
      highlight: "External evidence",
      published: "2026-09-10",
    }));
    const search = mock.fn(async () => hits);
    const { result, failure, payloads } = await searchDelivery(search);
    assert.equal(failure, undefined);
    assert.deepEqual(
      result,
      hits,
      "the agent still receives the original search evidence",
    );
    assert.equal(search.mock.callCount(), 1);
    const card = payloads.find(
      (payload) => payload.kind === "slack.message.create",
    );
    assert.ok(card, "search must post its own source card before returning");
    const blocks = z
      .array(
        z.object({
          type: z.string(),
          elements: z.array(z.unknown()).optional(),
        }),
      )
      .parse(card.blocks);
    const urls = blocks
      .flatMap((block) =>
        block.type === "actions" ? (block.elements ?? []) : [],
      )
      .map(
        (element) =>
          z
            .object({ type: z.literal("button"), url: z.string() })
            .parse(element).url,
      );
    assert.deepEqual(
      urls,
      hits.map((hit) => hit.url),
    );
    assert.match(JSON.stringify(card), /Search sources/);
    assert.match(JSON.stringify(card), /retry storm/);
  });

  it("makes an empty search visible without claiming there are sources", async () => {
    const { result, failure, payloads } = await searchDelivery(async () => []);
    assert.equal(failure, undefined);
    assert.deepEqual(result, []);
    const card = payloads.find(
      (payload) => payload.kind === "slack.message.create",
    );
    assert.ok(card);
    assert.match(JSON.stringify(card), /No sources found/);
  });

  it("reports unavailable search configuration to both the user and agent", async () => {
    const unavailable = "Web search is not configured on this runtime.";
    const { result, failure, payloads } = await searchDelivery(
      async () => unavailable,
    );
    assert.equal(failure, undefined);
    assert.equal(result, unavailable);
    assert.ok(
      payloads.some(
        (payload) =>
          payload.kind === "slack.message.create" &&
          JSON.stringify(payload).includes(unavailable),
      ),
    );
  });

  it("rejects unsafe source URLs before posting any source card", async () => {
    const { failure, payloads } = await searchDelivery(async () => [
      { title: "Untrusted reference", url: "javascript:alert(1)" },
    ]);
    assert.ok(failure instanceof Error);
    assert.match(failure.message, /HTTP or HTTPS/);
    assert.ok(
      !payloads.some((payload) =>
        JSON.stringify(payload).includes("javascript:"),
      ),
    );
  });

  it("does not return successful research when Slack rejects the source card", async () => {
    class RejectingGateway extends ManagedGateway {
      override async join(topic: string, payload: unknown) {
        const channel = await super.join(topic, payload);
        return {
          ...channel,
          push: async (event: string, packet: unknown) => {
            const ack = await channel.push(event, packet);
            const parsed = z
              .object({ payload: z.object({ kind: z.string() }) })
              .parse(packet);
            if (parsed.payload.kind !== "slack.message.create") return ack;
            return {
              ...ack,
              phase: "failed",
              result: {
                ...ack.result,
                status: "failed",
                error: "provider_failed",
              },
            };
          },
        };
      }
    }
    const { result, failure } = await searchDelivery(
      async () => [
        { title: "Retry guidance", url: "https://example.com/retries" },
      ],
      new RejectingGateway(),
    );
    assert.equal(result, undefined);
    assert.ok(failure instanceof Error);
    assert.match(failure.message, /provider_failed/);
  });

  it("preserves search failures without posting a successful sources card", async () => {
    const error = new Error("Exa is unavailable");
    const { failure, payloads } = await searchDelivery(async () => {
      throw error;
    });
    assert.equal(failure, error);
    assert.ok(
      !payloads.some((payload) =>
        JSON.stringify(payload).includes("Search sources"),
      ),
    );
    const terminal = payloads.find(
      (payload) => payload.kind === "channel.delivery.terminal",
    );
    assert.ok(terminal);
    assert.notEqual(terminal.status, "complete");
  });
});
