import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveModel } from "./model";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

function withEnv(config: NodeJS.ProcessEnv, callback: () => void) {
  for (const key of [
    "MODEL_PROVIDER",
    "MODEL",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, config);
  callback();
}

function resolvedChatModel() {
  const model = resolveModel();
  if (typeof model === "string") {
    return model;
  }
  return { modelId: model.modelId, provider: model.provider };
}

test("explicit OpenAI wins over a configured OpenRouter key", () => {
  withEnv({
    MODEL_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    OPENROUTER_API_KEY: "sk-or-test",
    MODEL: "gpt-test",
  }, () => {
    assert.equal(resolvedChatModel(), "openai:gpt-test");
  });
});

for (const [input, expected] of [
  ["openai:gpt-test", "openai/gpt-test"],
  ["openai/gpt-test", "openai/gpt-test"],
  ["meta-llama/llama-test:free", "meta-llama/llama-test:free"],
  ["gpt-test:free", "openai/gpt-test:free"],
  ["gpt-test:nitro", "openai/gpt-test:nitro"],
  ["openai:gpt-test:free", "openai/gpt-test:free"],
  ["OpenAI:gpt-test:free", "openai/gpt-test:free"],
  ["OpenAI/gpt-test:free", "openai/gpt-test:free"],
  ["Google:gemini-test:free", "google/gemini-test:free"],
  ["Gemini:gemini-test:free", "google/gemini-test:free"],
  ["Google-Gemini:gemini-test:free", "google/gemini-test:free"],
  ["gpt-test", "openai/gpt-test"],
] as const) {
  test(`OpenRouter uses chat completions and preserves slug: ${input}`, () => {
    for (const provider of [undefined, "openrouter", " OpenRouter "] as const) {
      withEnv({
        OPENROUTER_API_KEY: "sk-or-test",
        MODEL: input,
        ...(provider ? { MODEL_PROVIDER: provider } : {}),
      }, () => {
        assert.deepEqual(resolvedChatModel(), { modelId: expected, provider: "openai.chat" });
      });
    }
  });
}

for (const [config, error] of [
  [{ MODEL_PROVIDER: "openrouter", OPENAI_API_KEY: "sk-test" }, /OPENROUTER_API_KEY/],
  [{ MODEL_PROVIDER: "invalid" }, /Unsupported/],
  [{ MODEL_PROVIDER: "openai", MODEL: "anthropic/claude-test", OPENAI_API_KEY: "sk-test" }, /does not match/],
] as const) {
  test(`model resolver rejects invalid config: ${JSON.stringify(config)}`, () => {
    withEnv(config, () => {
      assert.throws(() => resolveModel(), error);
    });
  });
}

for (const provider of ["google", "gemini", "google-gemini"] as const) {
  for (const prefix of ["google", "gemini", "google-gemini"] as const) {
    test(`Google aliases agree: ${provider} / ${prefix}`, () => {
      withEnv({ MODEL_PROVIDER: provider, MODEL: `${prefix}:gemini-test`, GOOGLE_API_KEY: "test" }, () => {
        assert.equal(resolvedChatModel(), "google:gemini-test");
      });
    });
  }
}

for (const config of [
  { MODEL: "OpenAI:gpt-test", OPENAI_API_KEY: "test" },
  { MODEL: " openai/gpt-test ", OPENAI_API_KEY: "test" },
  { MODEL: " openai/gpt-test ", MODEL_PROVIDER: "openai", OPENAI_API_KEY: "test" },
  { MODEL: "OpenAI/gpt-test", MODEL_PROVIDER: " OpenAI ", OPENAI_API_KEY: "test" },
] as const) {
  test(`normalizes OpenAI configuration: ${JSON.stringify(config)}`, () => {
    withEnv(config, () => {
      assert.equal(resolvedChatModel(), "openai:gpt-test");
    });
  });
}

for (const provider of ["openai", "openrouter"] as const) {
  for (const model of ["   ", "openai:", "openai/", "openai:   "] as const) {
    test(`rejects empty model ID: ${provider} ${JSON.stringify(model)}`, () => {
      withEnv({ MODEL_PROVIDER: provider, MODEL: model, OPENAI_API_KEY: "test", OPENROUTER_API_KEY: "test" }, () => {
        assert.throws(() => resolveModel(), /MODEL must include a non-empty model identifier/);
      });
    });
  }
}
