/**
 * Tool tests — the safety properties, mostly.
 *
 * A channel tool handler takes `(args, ChannelToolContext)`, and these tools
 * touch only the context's `thread`. So a stub thread is enough to assert the
 * two behaviours that actually matter: that the agent is told to stop dead when
 * a human declines, and that missing history degrades into a legible
 * instruction rather than a silent empty array.
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { renderToIR } from "@copilotkit/channels";
import { proposeAction, readThread } from "./tools";

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

  const choiceTree = (fn: ReturnType<typeof mock.fn>) =>
    JSON.stringify(renderToIR(fn.mock.calls[0]!.arguments[0] as never));

  it("blocks on awaitChoice and tells the agent to proceed only once approved", async () => {
    const awaitChoice = mock.fn(async () => true);
    const result = await proposeAction.handler(args, stubContext({ awaitChoice }));

    assert.equal(awaitChoice.mock.callCount(), 1);
    assert.match(String(result), /approved/i);
    assert.match(String(result), /report exactly what you did/i);
  });

  it("tells the agent to stop dead when the responder holds", async () => {
    const awaitChoice = mock.fn(async () => false);
    const result = await proposeAction.handler(args, stubContext({ awaitChoice }));
    const text = String(result);

    assert.match(text, /do not take the action/i);
    // The failure mode worth guarding: an agent that reads a refusal as an
    // invitation to find another way in.
    assert.match(text, /do not offer a workaround/i);
    assert.doesNotMatch(text, /\bapproved\b/i);
  });

  it("puts both an approve and a hold control in front of the human", async () => {
    const awaitChoice = mock.fn(async () => false);
    await proposeAction.handler(args, stubContext({ awaitChoice }));
    const tree = choiceTree(awaitChoice);

    assert.ok(tree.includes("Approve"));
    assert.ok(tree.includes("Hold"));
    assert.ok(tree.includes(args.blastRadius));
  });

  it("says out loud when an action is not easily reversible", async () => {
    const awaitChoice = mock.fn(async () => false);
    await proposeAction.handler({ ...args, reversible: false }, stubContext({ awaitChoice }));

    assert.match(choiceTree(awaitChoice), /NOT easily reversible/);
  });
});
