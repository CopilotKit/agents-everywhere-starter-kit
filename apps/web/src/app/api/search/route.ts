/**
 * Server-side search for the voice agent.
 *
 * The voice agent's tools execute in the browser, so they cannot read
 * EXA_API_KEY. This route keeps the key server-side and exposes the same
 * `searchWeb` capability the Slack and web surfaces use.
 */
import { searchWeb } from "agent-core";

export async function POST(request: Request) {
  const body = (await request.json()) as { query?: unknown; results?: unknown };
  const query = typeof body.query === "string" ? body.query : "";
  if (!query) {
    return Response.json({ error: "A query string is required." }, { status: 400 });
  }
  const results = typeof body.results === "number" ? body.results : 5;
  return Response.json({ results: await searchWeb({ query, results }) });
}
