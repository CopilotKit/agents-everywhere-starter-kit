/**
 * Isomorphic schemas and types. Safe in a browser bundle — no Node imports.
 */
import { z } from "zod";

export const searchWebParameters = z.object({
  query: z.string().describe("What to search for, phrased as a natural-language question."),
  results: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("How many results to return. Keep it small; a thread is not a search page."),
});

export type SearchWebArgs = z.infer<typeof searchWebParameters>;

export interface SearchHit {
  title: string;
  url: string;
  published?: string;
  highlight?: string;
}
