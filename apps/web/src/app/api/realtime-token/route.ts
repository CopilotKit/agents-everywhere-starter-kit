/**
 * Mints an ephemeral client secret for the Realtime API.
 *
 * The browser needs a credential to open its own WebRTC connection to OpenAI.
 * It must NEVER be your API key — this route exchanges the server-side key for
 * a short-lived secret scoped to one session.
 */
import { REALTIME_MODEL, REALTIME_VOICE } from "@/lib/realtime-config";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        audio: { output: { voice: REALTIME_VOICE } },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: `OpenAI refused the session: ${detail.slice(0, 300)}` },
      { status: response.status },
    );
  }

  const data = (await response.json()) as { value?: string };
  if (!data.value) {
    return Response.json({ error: "No ephemeral secret in the response." }, { status: 502 });
  }

  return Response.json({ value: data.value });
}
