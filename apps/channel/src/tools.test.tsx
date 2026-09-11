import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createChannel, Thread } from "@copilotkit/channels";
import { startChannelsWithGatewayControl } from "@copilotkit/channels-intelligence";
// Pinned SDK's offline gateway fixture: exercises the actual managed delivery
// adapter, rendering and action registry without accounts or network calls.
import { DeliveryTestGateway, preparedDelivery } from "../../../node_modules/@copilotkit/channels-intelligence/dist/delivery-test-gateway.js";
import { z } from "zod";
import { proposeAction, readThread } from "./tools";

// The SDK fixture predates the required stable providerMessageId ack field.
class ManagedGateway extends DeliveryTestGateway {
  override async join(topic: string, payload: unknown) {
    const channel = await super.join(topic, payload);
    return {
      ...channel,
      push: async (event: string, packet: unknown) => {
        const ack = z.object({ result: z.record(z.string(), z.unknown()) }).passthrough()
          .parse(await channel.push(event, packet));
        return { ...ack, result: { ...ack.result, providerMessageId: "pid_v1_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ" } };
      },
    };
  }
}

function concreteThread(value: unknown): Thread {
  // createChannel's StatefulThread type narrows state() incompatibly with the
  // tool context in 0.9.2; verify the actual SDK instance instead of casting.
  assert.ok(value instanceof Thread);
  return value;
}

/** Only the methods these tools call; the rest of Thread is irrelevant here. */
const stubContext = (thread: Record<string, unknown>) =>
  ({
    thread,
    user: { id: "u1", name: "priya" },
    actor: { id: "a1" },
    platform: "slack",
  }) as never;

describe("read_thread", () => {
  it("returns the messages when the surface exposes history", async () => {
    const messages = [{ id: "1", role: "user", content: "checkout is timing out" }];
    const result = await readThread.handler(
      {},
      stubContext({ getMessages: mock.fn(async () => messages) }),
    );
    assert.deepEqual(result, messages);
  });

  it("degrades into an instruction, not an empty array, when history is unavailable", async () => {
    // getMessages() is capability-gated: it returns [] rather than throwing on
    // surfaces that cannot read history. Handing that [] straight to the model
    // reads as "the thread is empty", and the agent then answers confidently
    // about an incident it knows nothing about.
    const result = await readThread.handler(
      {},
      stubContext({ getMessages: mock.fn(async () => []) }),
    );
    assert.equal(typeof result, "string");
    assert.match(String(result), /cannot see earlier messages/i);
  });
});

describe("propose_action", () => {
  const args = {
    action: "Roll back web to the previous release",
    blastRadius: "All web traffic for ~90 seconds during the swap",
    reversible: true,
  };

  for (const choice of ["Approve", "Hold"]) {
    it(`posts a real managed card and reports ${choice} on a later delivery`, { timeout: 10_000 }, async () => {
      const gateway = new ManagedGateway();
      const channel = createChannel({ name: "support", identifyUser: "platform" });
      let result: unknown;
      channel.onMessage(async ({ thread }) => {
        try {
          assert.equal(thread.supportsBlockingChoice, false);
          result = await proposeAction.handler({ ...args, reversible: false }, { thread: concreteThread(thread), user: { id: "u1", name: "Priya" }, actor: { id: "a1", kind: "human" }, platform: "slack" });
        } catch (error) { result = String(error); throw error; }
      });
      const runCanonical = mock.fn();
      const handle = await startChannelsWithGatewayControl([channel], {
        session: gateway,
        scope: { projectId: 1, channelName: "support" },
        runtimeInstanceId: "rti_proposal",
        runCanonical: async (args) => {
          // Neither the proposal handler nor the click resumes an agent.
          runCanonical();
          return args.execute({});
        },
        loadHistory: async () => [],
      });
      try {
        const proposalDelivery = preparedDelivery("proposal", "slack", { kind: "text", text: "Propose a rollback" });
        await gateway.deliver(proposalDelivery);
        assert.match(String(result), /decision pending/, JSON.stringify(gateway.packets));
        assert.match(String(result), /Do not take the action, call write tools, or offer a workaround/);
        const payloads = gateway.packets.map(({ payload }) => payload);
        const card = payloads.find((payload) => payload.kind === "slack.message.create");
        assert.ok(card, "managed adapter must post the proposal before ending the delivery");
        assert.match(JSON.stringify(card), /NOT easily reversible/);
        assert.match(JSON.stringify(card), /All web traffic/);
        assert.match(JSON.stringify(card), /Approve/);
        assert.match(JSON.stringify(card), /Hold/);
        // Read the real Slack action ID generated by Channels, then deliver it
        // through the gateway in a separate (nonblocking) interaction turn.
        const blocks = z.array(z.object({ type: z.string(), elements: z.array(z.unknown()).optional() })).parse(card.blocks);
        const buttons = blocks.flatMap((block) => block.type === "actions" ? block.elements ?? [] : [])
          .map((element) => z.object({ type: z.literal("button"), text: z.object({ text: z.string() }), action_id: z.string() }).parse(element));
        const button = buttons.find((element) => element.text.text === choice);
        assert.ok(button);
        const clickDelivery = preparedDelivery("proposal_click", "slack", {
          kind: "interaction",
          actionId: button.action_id,
          messageRef: { id: "pref_v1_proposal_message_123" },
        });
        await gateway.deliver({ ...proposalDelivery, deliveryId: clickDelivery.deliveryId, turn: clickDelivery.turn });
        const update = gateway.packets.map(({ payload }) => payload).find((payload) => payload.kind === "slack.message.replace");
        assert.ok(update, "click must replace the proposal with the decision");
        assert.match(JSON.stringify(update), /No action was executed/);
        assert.match(JSON.stringify(update), choice === "Approve" ? /Approved proposal/ : /Do not take the action or offer a workaround/);
        // The SDK keeps both action IDs registered after replacing the card.
        // Replay the first choice, then deliver a stale opposite choice: neither
        // may overwrite the first recorded decision (including an initial Hold).
        const oppositeButton = buttons.find((element) => element.text.text !== choice);
        assert.ok(oppositeButton);
        for (const [index, actionId] of [button.action_id, oppositeButton.action_id].entries()) {
          const replayDelivery = preparedDelivery(`proposal_replay_${index}`, "slack", {
            kind: "interaction",
            actionId,
            messageRef: { id: "pref_v1_proposal_message_123" },
          });
          await gateway.deliver({ ...proposalDelivery, deliveryId: replayDelivery.deliveryId, turn: replayDelivery.turn });
        }
        const updates = gateway.packets.map(({ payload }) => payload).filter((payload) => payload.kind === "slack.message.replace");
        assert.equal(updates.length, 1, "duplicate and opposite clicks must preserve the first decision");
        assert.equal(runCanonical.mock.callCount(), 0, "click reporting must not automatically resume the agent");
      } finally {
        await handle.stop();
      }
    });
  }
});
