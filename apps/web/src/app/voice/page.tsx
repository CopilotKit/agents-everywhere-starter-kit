"use client";

/**
 * In the room — the voice surface.
 *
 * Honest about what is shared: the Realtime API is a different model family, so
 * this does NOT run `BuiltInAgent`. What it shares with every other surface is
 * the part that matters — the same SYSTEM_PROMPT and the same `searchWeb`
 * capability. The transport changes; the agent's character does not.
 *
 * Transport choice is not cosmetic:
 *   WebRTC    — browser and mobile clients capturing audio directly  ← this file
 *   WebSocket — your server receiving audio from a media pipeline
 *   SIP       — telephony
 */
import { useCallback, useRef, useState } from "react";
import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { SYSTEM_PROMPT, searchWebParameters } from "agent-core/shared";
import { REALTIME_MODEL } from "@/lib/realtime-config";

type Status = "idle" | "connecting" | "live" | "error";

const searchTheWeb = tool({
  name: "search_web",
  description:
    "Search the live web. Use it for anything time-sensitive or factual you would otherwise guess at. Keep spoken answers to two sentences.",
  parameters: searchWebParameters,
  // Tools run in the BROWSER here, so this cannot read EXA_API_KEY. It calls a
  // server route that holds the key instead.
  execute: async ({ query, results }) => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, results }),
    });
    if (!response.ok) return "Search is unavailable right now. Say so rather than guessing.";
    const data = (await response.json()) as { results?: unknown };
    return JSON.stringify(data.results ?? []);
  },
});

const voiceAgent = new RealtimeAgent({
  name: "Everywhere",
  instructions: [
    SYSTEM_PROMPT,
    "",
    "You are speaking out loud. Two extra rules for voice:",
    "- Answer in one or two sentences. Nobody wants a paragraph read to them.",
    "- Never read out a URL, an id, or a code block. Describe it instead.",
  ].join("\n"),
  tools: [searchTheWeb],
});

export default function VoicePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();
  const [transcript, setTranscript] = useState<string[]>([]);
  const sessionRef = useRef<RealtimeSession | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(undefined);
    try {
      const response = await fetch("/api/realtime-token", { method: "POST" });
      const data = (await response.json()) as { value?: string; error?: string };
      if (!response.ok || !data.value) {
        throw new Error(data.error ?? "Could not mint a session token.");
      }

      const session = new RealtimeSession(voiceAgent, {
        transport: "webrtc",
        model: REALTIME_MODEL,
      });

      session.on("history_updated", (history) => {
        const lines = history
          .filter((item) => item.type === "message")
          .map((item) => {
            const text = item.content
              .map((part) =>
                "transcript" in part ? (part.transcript ?? "") : "text" in part ? part.text : "",
              )
              .join(" ")
              .trim();
            return text ? `${item.role === "user" ? "you" : "agent"}  ${text}` : "";
          })
          .filter(Boolean);
        setTranscript(lines);
      });

      session.on("error", (event) => {
        setError(String((event as { error?: unknown }).error ?? event));
        setStatus("error");
      });

      // The ephemeral secret, never the API key.
      await session.connect({ apiKey: data.value });
      sessionRef.current = session;
      setStatus("live");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  return (
    <main className="ck-page">
      <p className="ck-eyebrow">In the room</p>
      <h1>Talk to it.</h1>
      <p className="ck-dek">
        WebRTC straight from this browser to OpenAI Realtime, on <code>{REALTIME_MODEL}</code>. Same
        prompt and same web-search capability as the Slack and web surfaces — only the transport
        changed.
      </p>

      <div className="ck-actions" style={{ marginTop: "2rem" }}>
        {status === "live" ? (
          <button type="button" className="ck-btn" onClick={disconnect}>
            End call
          </button>
        ) : (
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            onClick={connect}
            disabled={status === "connecting"}
          >
            {status === "connecting" ? "Connecting…" : "Start talking"}
          </button>
        )}
        <span className="ck-status" data-status={status}>
          {status}
        </span>
      </div>

      {status === "live" && (
        <p className="ck-dek" style={{ marginTop: "1rem" }}>
          Your microphone is open. Try: &ldquo;What shipped in the CopilotKit Channels SDK?&rdquo;
        </p>
      )}

      {error && (
        <article className="ck-card ck-card--gate" style={{ marginTop: "1.5rem" }}>
          <h3>Could not connect</h3>
          <p>{error}</p>
          <p>
            Check <code>OPENAI_API_KEY</code>, and that your account has Realtime access. Browsers
            also require HTTPS or localhost for microphone permission.
          </p>
        </article>
      )}

      {transcript.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Transcript</h2>
          <pre className="ck-transcript">{transcript.join("\n")}</pre>
        </section>
      )}
    </main>
  );
}
