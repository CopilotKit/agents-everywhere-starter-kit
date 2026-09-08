export const DEFAULT_MODEL = "gpt-5.6-sol";

/**
 * Alternates, documented so you don't have to go digging mid-build.
 *
 * Note on cost: the default is a flagship model. If you are running on hackathon
 * credits and burning through them, `gpt-5.6-luna` is ~25x cheaper per token and
 * is genuinely fine for chat-shaped work.
 */
export const MODEL_NOTES = {
  "gpt-5.6-sol": "default · flagship · $5.00/$30.00 per MTok",
  "gpt-6-astra": "most capable · built for the hardest end-to-end work",
  "gpt-5.6-terra": "balances capability with cost",
  "gpt-5.6-luna": "cheapest · $0.20/$1.20 per MTok · the one to switch to if credits run low",
} as const;
