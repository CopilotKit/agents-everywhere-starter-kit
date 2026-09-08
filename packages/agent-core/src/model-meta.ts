export const DEFAULT_MODEL = "gpt-5.4-mini";

/** Alternates, documented so you don't have to go digging mid-build. */
export const MODEL_NOTES = {
  "gpt-5.4-mini": "default · $0.38/$2.25 per MTok",
  "gpt-5.6-luna": "cheapest current model · $0.20/$1.20 per MTok",
  "gpt-5.6-sol": "flagship · reach for it when the agent has to reason",
  "gpt-6-astra": "most capable · slow and costly for a chat turn",
} as const;
