/** Resolve the selected chat provider. Voice uses OpenAI Realtime separately. */
import { createOpenAI } from "@ai-sdk/openai";
import { DEFAULT_MODEL } from "./model-meta";

function canonicalProvider(provider: string) {
  const normalized = provider.trim().toLowerCase();
  return normalized === "gemini" || normalized === "google-gemini" ? "google" : normalized;
}

export function resolveModel() {
  const model = (process.env.MODEL || DEFAULT_MODEL).trim();
  const firstSeparator = model.search(/[:/]/);
  const candidatePrefix = firstSeparator >= 0 ? canonicalProvider(model.slice(0, firstSeparator)) : undefined;
  // A colon in a bare model name can introduce a variant, such as ':free'.
  // Only supported provider prefixes use colon syntax; publishers use '/'.
  const separator = firstSeparator >= 0 && (model[firstSeparator] === "/" ||
    ["openai", "openrouter", "anthropic", "google"].includes(candidatePrefix || ""))
    ? firstSeparator : -1;
  const prefix = separator >= 0 ? candidatePrefix : undefined;
  const modelId = separator >= 0 ? model.slice(separator + 1).trim() : model;
  if (!modelId) {
    throw new Error("MODEL must include a non-empty model identifier.");
  }
  // Preserve the original automatic router switch for existing .env files.
  const provider = canonicalProvider(process.env.MODEL_PROVIDER || "") ||
    (process.env.OPENROUTER_API_KEY ? "openrouter" : prefix || "openai");
  const keyNames: { [provider: string]: string | undefined } = {
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
  };
  const keyName = Object.hasOwn(keyNames, provider) ? keyNames[provider] : undefined;
  if (!keyName) {
    throw new Error(`Unsupported model provider '${provider}'. Set MODEL_PROVIDER to openai, openrouter, anthropic, or google.`);
  }
  if (provider !== "openrouter" && prefix && prefix !== provider) {
    throw new Error(`MODEL provider '${prefix}' does not match MODEL_PROVIDER '${provider}'.`);
  }
  const apiKey = process.env[keyName];
  if (!apiKey || apiKey === "stub-replace-me") {
    throw new Error(`${keyName} is required for ${provider}. Run npm run check-env.`);
  }

  if (provider === "openrouter") {
    const openRouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      headers: {
        "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://aitinkerers.org",
        "X-OpenRouter-Title": process.env.APP_TITLE ?? "Agents, Everywhere",
      },
    });
    // Change only a provider separator; keep suffixes such as ':free' intact.
    const slug = `${prefix || "openai"}/${modelId}`;
    // AI SDK OpenAI v3 defaults to /responses. OpenRouter uses /chat/completions.
    return openRouter.chat(slug);
  }

  return `${provider}:${modelId}`;
}
