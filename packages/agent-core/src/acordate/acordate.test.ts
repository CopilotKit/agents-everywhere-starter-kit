import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { createInMemoryAcordateServices } from "./fake-services";
import { runAcordateAgent } from "./run-agent";
import {
  createReminderInputSchema,
  runAcordateAgentInputSchema,
} from "./schemas";
import { createAcordateTools } from "./tools";

const NOW = "2026-09-12T12:00:00-03:00";
const TOMORROW = "2026-09-13T10:00:00-03:00";
const CLOCK = () => new Date("2026-09-12T15:00:00.000Z");
const TOOL_OPTIONS = { toolCallId: "test-call", messages: [] };
type MockGenerateResult = Awaited<
  ReturnType<MockLanguageModelV3["doGenerate"]>
>;

function isAsyncIterable<T>(
  value: T | AsyncIterable<T>,
): value is AsyncIterable<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value
  );
}

async function executeTool<INPUT, OUTPUT>(
  candidate: Tool<INPUT, OUTPUT>,
  input: INPUT,
): Promise<OUTPUT> {
  if (!candidate.execute) throw new Error("Expected an executable tool.");
  const output = await candidate.execute(input, TOOL_OPTIONS);
  if (isAsyncIterable(output)) throw new Error("Expected one tool result.");
  return output;
}

function usage(): MockGenerateResult["usage"] {
  return {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 10, text: 10, reasoning: undefined },
  };
}

function generated(
  content: MockGenerateResult["content"],
  reason: "stop" | "tool-calls",
): MockGenerateResult {
  return {
    content,
    finishReason: { unified: reason, raw: undefined },
    usage: usage(),
    warnings: [],
  };
}

function baseInput(
  activeSentReminder: { id: string; title: string; context: string } | null = null,
) {
  return {
    userId: "telegram-user-1",
    messages: [{ role: "user" as const, content: "Mensaje de prueba" }],
    now: NOW,
    timezone: "America/Asuncion",
    sourceMessageId: "telegram-message-99",
    activeSentReminder,
  };
}

describe("Acordate contracts and tools", () => {
  it("rejects an ambiguous local date and requires a source message", () => {
    assert.equal(
      createReminderInputSchema.safeParse({
        title: "Retirar certificado",
        scheduledAt: "2026-09-13T10:00:00",
        context: "Llevá cédula.",
        sourceMemoryIds: [],
      }).success,
      false,
    );
    assert.equal(
      runAcordateAgentInputSchema.safeParse({
        ...baseInput(),
        sourceMessageId: "",
      }).success,
      false,
    );
  });

  it("keeps memories isolated and caps search results at three", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    for (const content of ["certificado uno", "certificado dos", "certificado tres", "certificado cuatro"]) {
      await services.memories.save({ userId: "alice", content, sourceMessageId: content });
    }
    const alice = await services.memories.search({ userId: "alice", query: "certificado" });
    const bob = await services.memories.search({ userId: "bob", query: "certificado" });
    assert.equal(alice.ok && alice.memories.length, 3);
    assert.equal(bob.ok && bob.memories.length, 0);
  });

  it("binds saveMemory to the trusted user and source message", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(services, baseInput());
    const result = await executeTool(tools.saveMemory, {
      content: "Necesito cédula y comprobante.",
    });
    assert.equal(result.ok, true);
    assert.deepEqual(services.memories.recordsFor("telegram-user-1"), [
      {
        id: "memory-1",
        userId: "telegram-user-1",
        content: "Necesito cédula y comprobante.",
        sourceMessageId: "telegram-message-99",
        createdAt: "2026-09-12T15:00:00.000Z",
      },
    ]);
  });

  it("requires retrieved memory IDs and a future time before creating", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(services, baseInput());
    const invalid = await executeTool(tools.createReminder, {
      title: "Comprar leche",
      scheduledAt: "2026-09-12T10:00:00-03:00",
      context: "Comprar leche.",
      sourceMemoryIds: [],
    });
    assert.equal(invalid.ok, false);

    const invented = await executeTool(tools.createReminder, {
      title: "Retirar certificado",
      scheduledAt: TOMORROW,
      context: "Llevá cédula.",
      sourceMemoryIds: ["invented-memory"],
    });
    assert.equal(invented.ok, false);
    assert.equal(services.reminders.recordsFor("telegram-user-1").length, 0);
  });

  it("only completes the exact sent reminder", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const created = await services.reminders.create({
      userId: "telegram-user-1",
      title: "Retirar certificado",
      scheduledAt: TOMORROW,
      context: "Llevá cédula.",
      sourceMemoryIds: [],
      sourceMessageId: "telegram-message-99",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const sent = services.reminders.markSent("telegram-user-1", created.reminder.id);
    assert.ok(sent);

    const tools = createAcordateTools(
      services,
      baseInput({ id: sent.id, title: sent.title, context: sent.context }),
    );
    const completed = await executeTool(tools.completeReminder, {
      reminderId: sent.id,
    });
    assert.equal(completed.ok, true);
    assert.equal(services.reminders.recordsFor("telegram-user-1")[0]?.status, "completed");
  });
});

describe("Acordate multi-step agent", () => {
  it("invokes searchMemory and then createReminder with the shared contract", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const saved = await services.memories.save({
      userId: "telegram-user-1",
      content: "Para retirar el certificado necesito cédula y comprobante.",
      sourceMessageId: "telegram-message-1",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;

    const model = new MockLanguageModelV3({
      doGenerate: [
        generated(
          [{
            type: "tool-call",
            toolCallId: "search-1",
            toolName: "searchMemory",
            input: JSON.stringify({ query: "retirar certificado" }),
          }],
          "tool-calls",
        ),
        generated(
          [{
            type: "tool-call",
            toolCallId: "create-1",
            toolName: "createReminder",
            input: JSON.stringify({
              title: "Retirar certificado",
              scheduledAt: TOMORROW,
              context: "Llevá cédula y comprobante.",
              sourceMemoryIds: [saved.memory.id],
            }),
          }],
          "tool-calls",
        ),
        generated(
          [{ type: "text", text: "Listo, te voy a recordar retirar el certificado." }],
          "stop",
        ),
      ],
    });

    const result = await runAcordateAgent(
      {
        ...baseInput(),
        messages: [{ role: "user", content: "Recordame retirarlo mañana a las 10." }],
      },
      { ...services, model },
    );

    assert.match(result.text, /certificado/i);
    assert.deepEqual(
      services.reminders.recordsFor("telegram-user-1")[0]?.sourceMemoryIds,
      [saved.memory.id],
    );
    assert.equal(model.doGenerateCalls.length, 3);
  });
});
