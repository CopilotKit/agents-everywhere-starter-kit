import { it } from "node:test";
import assert from "node:assert/strict";
import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { from, type Observable } from "rxjs";
import { createChannel } from "@copilotkit/channels";
import { startChannelsWithGatewayControl } from "@copilotkit/channels-intelligence";
import type { searchWeb } from "agent-core";
import { IncidentCard } from "./components";
import { createSearchTool } from "./search";
import { ManagedGateway, preparedDelivery } from "./testing/managed-gateway";

/** Real AG-UI events exercise the SDK tool loop and Slack renderer together. */
class ResearchAgent extends AbstractAgent {
  private iteration = 0;
  constructor(private readonly withIncident = true) {
    super();
  }
  override clone(): ResearchAgent {
    const clone = new ResearchAgent(this.withIncident);
    clone.threadId = this.threadId;
    clone.setMessages([...this.messages]);
    clone.setState(this.state);
    clone.iteration = this.iteration;
    return clone;
  }
  run(input: RunAgentInput): Observable<BaseEvent> {
    const calls = [
      { name: "search_web", args: { query: "retry storm", results: 1 } },
      {
        name: "incident_card",
        args: {
          severity: "sev2",
          headline: "Retries are amplifying latency",
          impact: "Checkout requests time out",
          started: "09:03 UTC",
          known: ["Connection-pool wait increased"],
          trying: ["Investigating retry policy"],
        },
      },
    ];
    const call = calls[this.iteration++];
    const activeCall =
      this.withIncident || this.iteration === 1 ? call : undefined;
    const events: BaseEvent[] = [
      {
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      },
    ];
    if (activeCall) {
      const toolCallId = `tool_${this.iteration}`;
      events.push(
        {
          type: EventType.TOOL_CALL_START,
          toolCallId,
          toolCallName: activeCall.name,
        },
        {
          type: EventType.TOOL_CALL_ARGS,
          toolCallId,
          delta: JSON.stringify(activeCall.args),
        },
        { type: EventType.TOOL_CALL_END, toolCallId },
      );
    }
    events.push({
      type: EventType.RUN_FINISHED,
      threadId: input.threadId,
      runId: input.runId,
    });
    return from(events);
  }
}

async function runResearch(search: typeof searchWeb, withIncident = true) {
  const gateway = new ManagedGateway();
  const channel = createChannel({
    name: "support",
    identifyUser: "platform",
    showToolStatus: true,
    agent: () => new ResearchAgent(withIncident),
    components: [IncidentCard],
    tools: [createSearchTool(search)],
  });
  let failure: unknown;
  channel.onMessage(async ({ thread }) => {
    try {
      await thread.runAgent();
    } catch (error) {
      failure = error;
      throw error;
    }
  });
  let agentMessages: AbstractAgent["messages"] = [];
  const handle = await startChannelsWithGatewayControl([channel], {
    session: gateway,
    scope: { projectId: 1, channelName: "support" },
    runtimeInstanceId: "rti_research",
    loadHistory: async () => [],
    appApiBaseUrl: "https://api.example",
    apiKey: "cpk-offline-test",
    appApiFetch: async (input) => {
      if (String(input).endsWith("/charge"))
        return Response.json({ charged: true });
      assert.ok(
        String(input).endsWith("/transcript"),
        `Unexpected request: ${input}`,
      );
      return Response.json({
        messages: [],
        truncation: {
          messageLimit: false,
          byteLimit: false,
          omittedMessageCount: 0,
        },
      });
    },
    runCanonical: async (args) => {
      const result = await args.execute(
        {},
        { threadId: args.threadId, runId: args.runId },
      );
      agentMessages = args.agent.messages;
      return result;
    },
  });
  try {
    await gateway.deliver(
      preparedDelivery("research", "slack", {
        kind: "text",
        text: "Research the incident and show a card",
      }),
    );
    return {
      gateway,
      payloads: gateway.packets.map(({ payload }) => payload),
      failure,
      agentMessages,
    };
  } finally {
    await handle.stop();
  }
}

it(
  "clears native Slack status before completing a research run with only tool cards",
  { timeout: 10_000 },
  async () => {
    const { gateway, payloads, failure, agentMessages } = await runResearch(
      async () => [
        { title: "Retry guidance", url: "https://example.com/retries" },
      ],
    );
    assert.equal(failure, undefined);
    const cards = payloads.filter(
      (payload) => payload.kind === "slack.message.create",
    );
    assert.equal(cards.length, 2, JSON.stringify({ payloads, agentMessages }));
    assert.match(JSON.stringify(cards[0]), /Search sources/);
    assert.match(JSON.stringify(cards[1]), /Retries are amplifying latency/);
    const statuses = payloads.filter(
      (payload) => payload.kind === "slack.thread.status",
    );
    assert.ok(
      statuses.some((payload) => payload.status !== ""),
      "must exercise the native working indicator",
    );
    assert.equal(
      statuses.at(-1)?.status,
      "",
      "last status effect must clear the working indicator",
    );
    const streamStop = payloads.findIndex(
      (payload) => payload.kind === "slack.stream.stop",
    );
    assert.ok(
      streamStop >= 0 && streamStop < payloads.length - 1,
      "native stream must stop before terminal completion",
    );
    const terminal = payloads.at(-1);
    assert.ok(terminal?.kind === "channel.delivery.terminal");
    assert.equal(terminal.status, "complete");
    assert.deepEqual(
      gateway.packets.map((packet) => packet.seq),
      payloads.map((_, index) => index),
    );
  },
);

it(
  "shows search failure when the agent catches a tool error and finishes without prose",
  { timeout: 10_000 },
  async () => {
    const { payloads, failure, agentMessages } = await runResearch(async () => {
      throw new Error("Exa is unavailable");
    }, false);
    assert.equal(
      failure,
      undefined,
      "the SDK catches ordinary tool errors inside the agent loop",
    );
    const cards = payloads.filter(
      (payload) => payload.kind === "slack.message.create",
    );
    assert.equal(
      cards.length,
      1,
      "the user must see the search failure even when the agent says nothing",
    );
    assert.match(JSON.stringify(cards[0]), /Web search failed/);
    assert.ok(!JSON.stringify(cards[0]).includes("Search sources"));
    assert.ok(
      agentMessages.some(
        (message) =>
          message.role === "tool" &&
          String(message.content).includes("Exa is unavailable"),
      ),
      "the model must still receive the original failure",
    );
    const terminal = payloads.at(-1);
    assert.ok(terminal?.kind === "channel.delivery.terminal");
    assert.equal(
      terminal.status,
      "complete",
      "delivery completion must not be confused with successful research",
    );
  },
);
