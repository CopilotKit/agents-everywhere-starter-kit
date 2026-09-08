/**
 * Grounded web search, surface-agnostic.
 *
 * Each surface wraps this in its own tool mechanism — `defineChannelTool` for
 * Channels, a server tool for the web app — so the implementation lives in one
 * place and the binding lives at the edge.
 */
import { Exa } from "exa-js";
import type { SearchHit, SearchWebArgs } from "../schemas";

/**
 * Exa search profiles are a latency dial, and the choice is not cosmetic:
 * `instant` ~250ms and `fast` ~450ms are the only sane options inside a chat
 * thread. `deep-reasoning` can take 40 seconds, which reads as a hung bot.
 */
const SEARCH_TYPE = (process.env.EXA_SEARCH_TYPE ?? "fast") as
  "instant" | "fast" | "auto" | "deep-lite" | "deep" | "deep-reasoning";

export function isSearchConfigured(): boolean {
  return Boolean(process.env.EXA_API_KEY);
}

export async function searchWeb({ query, results }: SearchWebArgs): Promise<SearchHit[] | string> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return "Web search is not configured on this deployment (no EXA_API_KEY). Say so rather than guessing.";
  }

  const exa = new Exa(apiKey);
  const response = await exa.searchAndContents(query, {
    type: SEARCH_TYPE,
    numResults: results,
    highlights: { numSentences: 2, highlightsPerUrl: 1 },
  });

  return response.results.map((hit) => ({
    title: hit.title ?? hit.url,
    url: hit.url,
    published: hit.publishedDate ?? undefined,
    highlight: hit.highlights?.[0],
  }));
}
