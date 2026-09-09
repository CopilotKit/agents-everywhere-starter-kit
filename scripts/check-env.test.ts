import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function preflight(config: string, args: string[] = [] as const) {
  const root = mkdtempSync(join(tmpdir(), "agents-env-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "node_modules/@copilotkit/channels"), { recursive: true });
    copyFileSync(new URL("./check-env.sh", import.meta.url), join(root, "scripts/check-env.sh"));
    writeFileSync(join(root, ".env"), config);
    return spawnSync("bash", [join(root, "scripts/check-env.sh"), ...args], {
      encoding: "utf8", env: { PATH: process.env.PATH },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const config of [
  "OPENROUTER_API_KEY=sk-or-test\nMODEL=openai/gpt-test",
  "MODEL_PROVIDER=openrouter\nOPENROUTER_API_KEY=sk-or-test\nOPENAI_API_KEY=stub-replace-me",
  "MODEL_PROVIDER=openai\nOPENAI_API_KEY=sk-test\nOPENROUTER_API_KEY=stub-replace-me",
  "MODEL=anthropic/claude-test\nANTHROPIC_API_KEY=sk-test",
  "MODEL=google:gemini-test\nGOOGLE_API_KEY=test",
] as const) {
  test(`validates only selected provider: ${config.split("\n")[0]}`, () => {
    const result = preflight(config);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
for (const [config, error] of [
  ["MODEL_PROVIDER=openrouter\nOPENAI_API_KEY=sk-test", /OPENROUTER_API_KEY is empty/],
  ["MODEL_PROVIDER=openai\nOPENROUTER_API_KEY=sk-or-test", /OPENAI_API_KEY is empty/],
  ["MODEL_PROVIDER=invalid\nOPENAI_API_KEY=sk-test", /Unsupported.*MODEL_PROVIDER/],
  ["MODEL=invalid/model\nOPENAI_API_KEY=sk-test", /Unsupported.*provider/],
  ["MODEL_PROVIDER=openai\nMODEL=anthropic/claude-test\nOPENAI_API_KEY=sk-test", /does not match/],
] as const) {
  test(`rejects invalid configuration: ${config.split("\n")[0]} ${error}`, () => {
    const result = preflight(config);
    assert.equal(result.status, 1);
    assert.match(result.stdout, error);
  });
}
test("voice separately requires an OpenAI credential", () => {
  const result = preflight("OPENROUTER_API_KEY=sk-or-test", ["--voice"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /OPENAI_API_KEY.*voice/);
});

function modelConfig(config: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import { resolveModel } from './packages/agent-core/src/model.ts';
    const model = resolveModel();
    console.log(JSON.stringify(typeof model === 'string' ? model : { modelId: model.modelId, provider: model.provider }));
  `], { encoding: "utf8", env: { PATH: process.env.PATH, ...config } });
}

test("explicit OpenAI wins over a configured router key", () => {
  const result = modelConfig({ MODEL_PROVIDER: "openai", OPENAI_API_KEY: "sk-test", OPENROUTER_API_KEY: "sk-or-test", MODEL: "gpt-test" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout), "openai:gpt-test");
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
    for (const provider of [undefined, "openrouter", " OpenRouter "]) {
      const config = { OPENROUTER_API_KEY: "sk-or-test", MODEL: input,
        ...(provider ? { MODEL_PROVIDER: provider } : {}) };
      const check = preflight(envFile(config));
      const result = modelConfig(config);
      assert.equal(check.status, 0, check.stdout + check.stderr);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { modelId: expected, provider: "openai.chat" });
    }
  });
}
for (const [config, error] of [
  [{ MODEL_PROVIDER: "openrouter", OPENAI_API_KEY: "sk-test" }, /OPENROUTER_API_KEY/],
  [{ MODEL_PROVIDER: "invalid" }, /Unsupported/],
  [{ MODEL_PROVIDER: "openai", MODEL: "anthropic/claude-test", OPENAI_API_KEY: "sk-test" }, /does not match/],
] as const) {
  test(`model resolver rejects invalid config: ${JSON.stringify(config)}`, () => {
    const result = modelConfig(config);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
  });
}

// Exercise identical .env values through preflight and the runtime resolver.
function envFile(config: NodeJS.ProcessEnv) {
  return Object.entries(config).map(([key, value]) => `${key}='${value}'`).join("\n");
}
const aliases = ["google", "gemini", "google-gemini"] as const;
for (const provider of aliases) {
  for (const prefix of aliases) {
    test(`Google aliases agree: ${provider} / ${prefix}`, () => {
      const config = { MODEL_PROVIDER: provider, MODEL: `${prefix}:gemini-test`, GOOGLE_API_KEY: "test" };
      const check = preflight(envFile(config));
      const runtime = modelConfig(config);
      assert.equal(check.status, 0, check.stdout + check.stderr);
      assert.equal(runtime.status, 0, runtime.stderr);
      assert.equal(JSON.parse(runtime.stdout), "google:gemini-test");
    });
  }
}
for (const config of [
  { MODEL: "OpenAI:gpt-test", OPENAI_API_KEY: "test" },
  { MODEL: " openai/gpt-test ", OPENAI_API_KEY: "test" },
  { MODEL: " openai/gpt-test ", MODEL_PROVIDER: "openai", OPENAI_API_KEY: "test" },
  { MODEL: "OpenAI/gpt-test", MODEL_PROVIDER: " OpenAI ", OPENAI_API_KEY: "test" },
]) {
  test(`normalizes provider configuration: ${JSON.stringify(config)}`, () => {
    const check = preflight(envFile(config));
    const runtime = modelConfig(config);
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.equal(runtime.status, 0, runtime.stderr);
    assert.equal(JSON.parse(runtime.stdout), "openai:gpt-test");
  });
}
for (const provider of ["openai", "openrouter"]) {
  for (const model of ["   ", "openai:", "openai/", "openai:   "]) {
    test(`rejects empty model ID: ${provider} ${JSON.stringify(model)}`, () => {
      const config = { MODEL_PROVIDER: provider, MODEL: model, OPENAI_API_KEY: "test", OPENROUTER_API_KEY: "test" };
      const check = preflight(envFile(config));
      const runtime = modelConfig(config);
      assert.equal(check.status, 1, check.stdout + check.stderr);
      assert.match(check.stdout, /MODEL must include a non-empty model identifier/);
      assert.notEqual(runtime.status, 0);
      assert.match(runtime.stderr, /MODEL must include a non-empty model identifier/);
    });
  }
}
