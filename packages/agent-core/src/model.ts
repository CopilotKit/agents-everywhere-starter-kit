/**
 * Model resolution.
 *
 * Defaults to OpenAI (marquee sponsor, and `gpt-5.4-mini` is cheap enough to run
 * a whole build day on). Setting OPENROUTER_API_KEY flips the whole kit onto
 * OpenRouter with no other change — that is your insurance if OpenAI
 * rate-limits you at 14:00 with the demo at 15:30.
 *
 * Verified against @copilotkit/runtime@1.70.1: `BuiltInAgent` accepts either a
 * `"provider/model"` string or an AI SDK `LanguageModel` instance, and its
 * internal resolver normalises `/` and `:` to the same thing.
 */
import { createOpenAI } from "@ai-sdk/openai";

export const DEFAULT_MODEL = "gpt-5.4-mini";

/** Alternates, documented so you don't have to go digging mid-build. */
export const MODEL_NOTES = {
  "gpt-5.4-mini": "default · $0.38/$2.25 per MTok",
  "gpt-5.6-luna": "cheapest current model · $0.20/$1.20 per MTok",
  "gpt-5.6-sol": "flagship · reach for it when the agent has to reason",
  "gpt-6-astra": "most capable · slow and costly for a chat turn",
} as const;

export function resolveModel() {
  const model = (process.env.MODEL ?? DEFAULT_MODEL).trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (openRouterKey) {
    // OpenRouter is OpenAI-compatible, so the AI SDK's OpenAI provider drives it
    // directly. We build a LanguageModel rather than passing a string, because
    // the runtime's string resolver would eat the `openai/` half of an
    // OpenRouter slug as the provider name.
    const openRouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
      // Attribution headers put your build on OpenRouter's public rankings.
      headers: {
        "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://aitinkerers.org",
        "X-OpenRouter-Title": process.env.APP_TITLE ?? "Agents, Everywhere",
      },
    });
    return openRouter(model.includes("/") ? model : `openai/${model}`);
  }

  // A value that already names a provider passes through untouched, so you can
  // set MODEL=anthropic/claude-sonnet-4-6 or google/gemini-2.5-flash instead.
  return model.includes(":") || model.includes("/") ? model : `openai:${model}`;
}
