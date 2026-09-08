/**
 * Model resolution.
 *
 * Defaults to OpenAI (marquee sponsor) on `gpt-5.6-sol`, with `gpt-6-astra` one
 * env var away. Setting OPENROUTER_API_KEY flips the whole kit onto
 * OpenRouter with no other change — that is your insurance if OpenAI
 * rate-limits you at 14:00 with the demo at 15:30.
 *
 * Verified against @copilotkit/runtime@1.70.1: `BuiltInAgent` accepts either a
 * `"provider/model"` string or an AI SDK `LanguageModel` instance, and its
 * internal resolver normalises `/` and `:` to the same thing.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { DEFAULT_MODEL } from "./model-meta";

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
