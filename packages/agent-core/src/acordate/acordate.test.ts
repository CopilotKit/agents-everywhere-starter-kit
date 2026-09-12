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
  if (!candidate.execute) {
    throw new Error("Expected an executable tool.");
  }
  const output = await candidate.execute(input, TOOL_OPTIONS);
  if (isAsyncIterable(output)) {
    throw new Error("These Acordate tools must return one result.");
  }
  return output;
}

function usage(): MockGenerateResult["usage"] {
  return {
    inputTokens: {
      total: 10,
      noCache: 10,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
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

function baseInput(activeReminder?: { id: string; title: string }) {
  return {
    userId: "telegram-user-1",
    messages: [{ role: "user" as const, content: "Mensaje de prueba" }],
    now: NOW,
    timezone: "America/Asuncion",
    ...(activeReminder ? { activeReminder } : {}),
  };
}

describe("Acordate contracts and tools", () => {
  it("rejects ambiguous local dates without a UTC offset", () => {
    assert.equal(
      createReminderInputSchema.safeParse({
        title: "Retirar certificado",
        dueAt: "2026-09-13T10:00:00",
        memoryIds: [],
      }).success,
      false,
    );
  });

  it("rejects invalid time zones at the agent boundary", () => {
    assert.equal(
      runAcordateAgentInputSchema.safeParse({
        ...baseInput(),
        timezone: "UTC-3-ish",
      }).success,
      false,
    );
  });

  it("keeps memories isolated by trusted userId", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    await services.memories.save({
      userId: "alice",
      content: "Llevar cédula y comprobante para el certificado.",
    });

    const alice = await services.memories.search({
      userId: "alice",
      query: "certificado",
      limit: 5,
    });
    const bob = await services.memories.search({
      userId: "bob",
      query: "certificado",
      limit: 5,
    });

    assert.equal(alice.ok && alice.value.length, 1);
    assert.equal(bob.ok && bob.value.length, 0);
  });

  it("binds saveMemory to the backend user and source message", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(services, {
      ...baseInput(),
      sourceMessageId: "telegram-message-99",
    });

    const result = await executeTool(
      tools.saveMemory,
      { content: "Necesito cédula y comprobante." },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(services.memories.recordsFor("telegram-user-1"), [
      {
        id: "memory-1",
        content: "Necesito cédula y comprobante.",
        createdAt: "2026-09-12T15:00:00.000Z",
        sourceMessageId: "telegram-message-99",
      },
    ]);
  });

  it("refuses to create reminders in the past", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(services, baseInput());

    const result = await executeTool(
      tools.createReminder,
      {
        title: "Comprar leche",
        dueAt: "2026-09-12T10:00:00-03:00",
        memoryIds: [],
      },
    );

    assert.equal(result.ok, false);
    assert.equal(services.reminders.recordsFor("telegram-user-1").length, 0);
  });

  it("creates a simple reminder with a concrete future date", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(services, baseInput());

    const result = await executeTool(tools.createReminder, {
      title: "Comprar leche",
      dueAt: TOMORROW,
      memoryIds: [],
    });

    assert.equal(result.ok, true);
    assert.deepEqual(services.reminders.recordsFor("telegram-user-1")[0], {
      id: "reminder-1",
      title: "Comprar leche",
      dueAt: TOMORROW,
      timezone: "America/Asuncion",
      memoryIds: [],
      status: "pending",
      createdAt: "2026-09-12T15:00:00.000Z",
    });
  });

  it("returns an empty search result instead of inventing a memory", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(services, baseInput());

    const result = await executeTool(tools.searchMemory, {
      query: "trámite de Japón",
      limit: 5,
    });

    assert.deepEqual(result, { ok: true, value: [] });
  });

  it("turns persistence exceptions into an explicit failed result", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const tools = createAcordateTools(
      {
        ...services,
        memories: {
          ...services.memories,
          save: async () => {
            throw new Error("database secret that must not leak");
          },
          search: (input) => services.memories.search(input),
        },
      },
      baseInput(),
    );

    const result = await executeTool(tools.saveMemory, {
      content: "Necesito cédula.",
    });

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "service_unavailable",
        message: "El servicio de persistencia falló. No se confirmó ni cambió nada.",
      },
    });
    assert.equal(JSON.stringify(result).includes("database secret"), false);
  });

  it("requires an exact active reminder before completing", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const created = await services.reminders.create({
      userId: "telegram-user-1",
      title: "Retirar certificado",
      dueAt: TOMORROW,
      timezone: "America/Asuncion",
      memoryIds: [],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const withoutContext = createAcordateTools(services, baseInput());
    const rejected = await executeTool(
      withoutContext.completeReminder,
      { reminderId: created.value.id },
    );
    assert.equal(rejected.ok, false);
    assert.equal(services.reminders.recordsFor("telegram-user-1")[0]?.status, "pending");

    const withContext = createAcordateTools(
      services,
      baseInput({ id: created.value.id, title: created.value.title }),
    );
    const completed = await executeTool(
      withContext.completeReminder,
      { reminderId: created.value.id },
    );
    assert.equal(completed.ok, true);
    assert.equal(services.reminders.recordsFor("telegram-user-1")[0]?.status, "completed");
  });
});

describe("Acordate multi-step agent", () => {
  it("executes searchMemory then createReminder before the final answer", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const saved = await services.memories.save({
      userId: "telegram-user-1",
      content: "Para retirar el certificado necesito cédula y comprobante.",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;

    const model = new MockLanguageModelV3({
      doGenerate: [
        generated(
          [
            {
              type: "tool-call",
              toolCallId: "search-1",
              toolName: "searchMemory",
              input: JSON.stringify({ query: "retirar certificado", limit: 5 }),
            },
          ],
          "tool-calls",
        ),
        generated(
          [
            {
              type: "tool-call",
              toolCallId: "create-1",
              toolName: "createReminder",
              input: JSON.stringify({
                title: "Retirar certificado",
                dueAt: TOMORROW,
                context: "Llevar cédula y comprobante.",
                memoryIds: [saved.value.id],
              }),
            },
          ],
          "tool-calls",
        ),
        generated(
          [
            {
              type: "text",
              text: "Listo. Mañana a las 10 te recuerdo retirar el certificado. Llevá cédula y comprobante.",
            },
          ],
          "stop",
        ),
      ],
    });

    const result = await runAcordateAgent(
      {
        ...baseInput(),
        messages: [
          {
            role: "user",
            content: "Recordame retirarlo mañana a las 10.",
          },
        ],
      },
      { ...services, model },
    );

    assert.match(result.text, /certificado/i);
    assert.match(result.text, /cédula/i);
    assert.equal(services.reminders.recordsFor("telegram-user-1").length, 1);
    assert.deepEqual(
      services.reminders.recordsFor("telegram-user-1")[0]?.memoryIds,
      [saved.value.id],
    );
    assert.equal(model.doGenerateCalls.length, 3);
  });

  it("overrides a false success claim after persistence fails", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const model = new MockLanguageModelV3({
      doGenerate: [
        generated(
          [
            {
              type: "tool-call",
              toolCallId: "save-1",
              toolName: "saveMemory",
              input: JSON.stringify({ content: "Necesito cédula." }),
            },
          ],
          "tool-calls",
        ),
        generated(
          [{ type: "text", text: "Listo, ya lo guardé." }],
          "stop",
        ),
      ],
    });

    const result = await runAcordateAgent(
      {
        ...baseInput(),
        messages: [
          { role: "user", content: "Guardá que necesito cédula." },
        ],
      },
      {
        ...services,
        model,
        memories: {
          save: async () => ({
            ok: false,
            error: {
              code: "database_down",
              message: "La memoria no está disponible. No se guardó nada.",
            },
          }),
          search: (input) => services.memories.search(input),
        },
      },
    );

    assert.doesNotMatch(result.text, /ya lo guardé/i);
    assert.match(result.text, /no se guardó nada/i);
  });

  it("does not write when the model asks for a missing time", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const model = new MockLanguageModelV3({
      doGenerate: generated(
        [
          {
            type: "text",
            text: "¿Cuándo querés que te lo recuerde?",
          },
        ],
        "stop",
      ),
    });

    const result = await runAcordateAgent(
      {
        ...baseInput(),
        messages: [
          { role: "user", content: "Recordame lo del certificado." },
        ],
      },
      { ...services, model },
    );

    assert.match(result.text, /cuándo/i);
    assert.equal(services.reminders.recordsFor("telegram-user-1").length, 0);
  });

  it("does not write when the model asks what task to remember", async () => {
    const services = createInMemoryAcordateServices(CLOCK);
    const model = new MockLanguageModelV3({
      doGenerate: generated(
        [
          {
            type: "text",
            text: "¿Qué querés que te recuerde mañana?",
          },
        ],
        "stop",
      ),
    });

    const result = await runAcordateAgent(
      {
        ...baseInput(),
        messages: [{ role: "user", content: "Recordame mañana." }],
      },
      { ...services, model },
    );

    assert.match(result.text, /qué/i);
    assert.equal(services.reminders.recordsFor("telegram-user-1").length, 0);
  });
});
