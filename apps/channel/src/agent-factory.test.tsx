import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import {
  BuiltInAgent,
  type BuiltInAgentClassicConfig,
} from "@copilotkit/runtime/v2";
import { Observable } from "rxjs";
import { ChannelRunAgent } from "./agent.js";

type ObjectLanguageModel = Extract<
  BuiltInAgentClassicConfig["model"],
  { doStream: unknown }
>;

type FakeStreamOptions = {
  abortSignal?: AbortSignal;
  prompt?: unknown;
};

type StreamController = ReadableStreamDefaultController<unknown>;

type FakeModel = ObjectLanguageModel & {
  prompts: unknown[];
  closeOpenStreams: () => void;
};

function delayedToolThenAnswerModel(): FakeModel {
  let calls = 0;
  const prompts: unknown[] = [];
  const openStreams: StreamController[] = [];
  return {
    specificationVersion: "v3" as const,
    provider: "fake",
    modelId: "fake-model",
    supportedUrls: {},
    prompts,
    closeOpenStreams: () => {
      while (openStreams.length > 0) {
        openStreams.pop()?.close();
      }
    },
    doGenerate: async () => ({
      content: [],
      finishReason: "stop" as const,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    }),
    doStream: async (options: FakeStreamOptions) => ({
      stream: new ReadableStream({
        start(controller) {
          calls += 1;
          prompts.push(options.prompt);
          openStreams.push(controller);
          setTimeout(() => {
            const index = openStreams.indexOf(controller);
            if (index >= 0) {
              openStreams.splice(index, 1);
              controller.close();
            }
          }, 25);
          controller.enqueue({ type: "stream-start", warnings: [] });
          if (calls === 1) {
            controller.enqueue({
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "demo_tool",
              input: {},
            });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "tool-calls", raw: "tool-calls" },
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            });
          } else {
            controller.enqueue({ type: "text-start", id: "txt_1" });
            controller.enqueue({
              type: "text-delta",
              id: "txt_1",
              delta: "The tool result was handled.",
            });
            controller.enqueue({ type: "text-end", id: "txt_1" });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            });
          }
        },
      }),
    }),
  } as unknown as FakeModel;
}

function builtInAgent(model: ObjectLanguageModel, threadId: string) {
  const agent = new BuiltInAgent({ model, prompt: "Test prompt", maxSteps: 10 });
  agent.threadId = threadId;
  return agent;
}

const demoTool = {
  name: "demo_tool",
  description: "A local channel tool.",
  parameters: { type: "object", properties: {} },
};

function appendToolResult(agent: { addMessage: BuiltInAgent["addMessage"] }) {
  agent.addMessage({
    id: "tool_result_1",
    role: "tool",
    toolCallId: "call_1",
    content: JSON.stringify({ ok: true }),
  });
}

describe("ChannelRunAgent", () => {
  it("documents the classic BuiltInAgent same-tick continuation guard and avoids it for channel runs", async () => {
    const plainModel = delayedToolThenAnswerModel();
    const plain = builtInAgent(plainModel, "thread_plain");

    try {
      await plain.runAgent({ tools: [demoTool], context: [] });
      appendToolResult(plain);

      await assert.rejects(
        () => plain.runAgent({ tools: [], context: [] }),
        /Agent is already running\. Call abortRun\(\) first or create a new instance\./,
      );
    } finally {
      plainModel.closeOpenStreams();
    }

    const model = delayedToolThenAnswerModel();
    const channelAgent = new ChannelRunAgent(
      (threadId) => builtInAgent(model, threadId),
      "thread_channel",
    );
    channelAgent.setState({ phase: "before-continuation" });

    try {
      await channelAgent.runAgent({ tools: [demoTool], context: [] });
      appendToolResult(channelAgent);

      await assert.doesNotReject(() =>
        channelAgent.runAgent({ tools: [], context: [] }),
      );

      assert.match(JSON.stringify(model.prompts.at(-1)), /tool-result/);
      assert.match(JSON.stringify(model.prompts.at(-1)), /before-continuation/);
      assert.match(
        JSON.stringify(channelAgent.messages),
        /The tool result was handled/,
      );
    } finally {
      model.closeOpenStreams();
    }
  });

  it("clones with the same fresh-inner factory and forwards explicit abortRun to the active inner agent", async () => {
    let seenSignal: AbortSignal | undefined;
    const agent = new ChannelRunAgent(
      (threadId) =>
        builtInAgent(
          makeLongRunningAbortableModel((signal) => {
            seenSignal = signal;
          }),
          threadId,
        ),
      "thread_abort",
    );
    const clone = agent.clone() as ChannelRunAgent;

    const run = clone.runAgent({ tools: [], context: [] });
    await waitFor(() => seenSignal !== undefined);

    clone.abortRun();
    await run;

    assert.equal(seenSignal?.aborted, true);
  });

  it("aborts the completed inner run when the outer subscription finalizes", async () => {
    let inner: ControlledInnerAgent | undefined;
    const agent = new ChannelRunAgent((threadId: string) => {
      inner = new ControlledInnerAgent(threadId);
      return inner;
    }, "thread_cleanup");

    await agent.runAgent({ tools: [], context: [] });

    assert.equal(inner?.abortCalls, 1);
  });
});

function makeLongRunningAbortableModel(
  onSignal: (signal: AbortSignal) => void,
): ObjectLanguageModel {
  return {
    specificationVersion: "v3" as const,
    provider: "fake",
    modelId: "fake-model",
    supportedUrls: {},
    doGenerate: async () => ({
      content: [],
      finishReason: "stop" as const,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    }),
    doStream: async (options: FakeStreamOptions) => ({
      stream: new ReadableStream({
        start(controller) {
          const signal = options.abortSignal;
          assert.ok(signal);
          onSignal(signal);
          controller.enqueue({ type: "stream-start", warnings: [] });
          signal.addEventListener("abort", () => controller.close(), {
            once: true,
          });
        },
      }),
    }),
  } as unknown as ObjectLanguageModel;
}

class ControlledInnerAgent extends AbstractAgent {
  abortCalls = 0;

  constructor(threadId: string) {
    super({ threadId });
  }

  override run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      });
      subscriber.next({
        type: EventType.RUN_FINISHED,
        threadId: input.threadId,
        runId: input.runId,
      });
      subscriber.complete();

      return () => {};
    });
  }

  override abortRun() {
    this.abortCalls += 1;
    super.abortRun();
  }
}

async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 20; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("condition was not met");
}
