/**
 * Shared between the token route and the browser session — they must agree on
 * the model, or the ephemeral secret will not match the session you open.
 *
 * `gpt-realtime-2.1` is the SDK default: low-latency voice with reasoning and
 * tool support. `gpt-realtime-1.5` is the best pure audio-in/audio-out model
 * if you do not need tools; `gpt-realtime-2.1-mini` is the cheap one.
 */
export const REALTIME_MODEL = process.env.NEXT_PUBLIC_REALTIME_MODEL ?? "gpt-realtime-2.1";
export const REALTIME_VOICE = process.env.NEXT_PUBLIC_REALTIME_VOICE ?? "marin";
