/**
 * Resolves an `info_gap` blocker with a real Exa search. Server-only: reuses
 * agent-core's searchWeb, which reads EXA_API_KEY from the environment.
 */
import { searchWeb, type SearchHit } from "agent-core";
import fallback from "./fallback-research.json" with { type: "json" };
import type { Blocker, Resolution } from "./graph-types";

const SUMMARY_MAX_CHARS = 320;

// Exa's `highlight` can pack several matched snippets into one string,
// separated by "\n...\n". Keep only the first, and cut at a sentence
// boundary so the demo shows a concrete sentence, not a wall of text.
function shortSummary(hit: SearchHit): string {
  const first = (hit.highlight ?? hit.title).split("\n...\n")[0].trim();
  // Split on sentence-ending periods only (lowercase/digit before the dot),
  // so "U.S." and similar abbreviations don't get treated as a sentence end.
  const sentences = first.split(/(?<=[a-z0-9])\.\s+/);
  let summary = "";
  for (const sentence of sentences) {
    const next = summary ? `${summary} ${sentence}.` : `${sentence}.`;
    if (summary && next.length > SUMMARY_MAX_CHARS) break;
    summary = next;
  }
  return summary || first.slice(0, SUMMARY_MAX_CHARS).trimEnd() + "…";
}

export async function researchBlocker(blocker: Blocker): Promise<Resolution> {
  try {
    const query = `${blocker.label}. What does the owner (${blocker.owner}) need to know to resolve this async, with sources?`;
    const hits = await searchWeb({ query, results: 3 });

    if (typeof hits === "string" || hits.length === 0) {
      throw new Error(typeof hits === "string" ? hits : "No results.");
    }

    return {
      summary: shortSummary(hits[0]),
      sources: hits.map((hit) => ({ title: hit.title, url: hit.url })),
    };
  } catch {
    // Demo must not die on a flaky live call. Cached backup, clearly not live.
    return fallback.default;
  }
}
