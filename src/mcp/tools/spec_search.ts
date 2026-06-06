// MCP tool: spec_search — full-text-ish search across the spec
// section index (anchors, titles, and prose). The entry point when
// you don't know the exact anchor. Returns ranked lightweight hits
// with a matched_on field and a prose snippet for body matches.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadSections } from "../../spec/spec_data.js";
import { searchSpec, type SpecSearchHit } from "../../spec/sections_query.js";
import type { VersionValue } from "../../versions.js";

export const specSearchSchema = {
  query: z
    .string()
    .min(1)
    .describe(
      "Search text. Matched against clause anchors/ids, titles, and prose. E.g. `block type`, `trap`, `funcref`, `little endian`.",
    ),
  limit: z.number().int().min(1).max(100).default(20).describe("Max ranked hits returned."),
  version: versionArg,
};

export type SpecSearchArgs = { query: string; limit?: number; version?: VersionValue };

export const specSearchExamples = [
  {
    q: "Where does the spec define traps?",
    input: { query: "trap" },
    note: "Ranks title matches above prose matches; prose hits include a snippet around the match.",
  },
  {
    q: "Find the block type section",
    input: { query: "block type" },
    note: "Title substring search surfaces syntax-blocktype near the top.",
  },
];

export interface SpecSearchResult {
  count: number;
  hits: SpecSearchHit[];
}

export function specSearch(args: SpecSearchArgs): SpecSearchResult {
  const sections = loadSections(args.version);
  const hits = searchSpec(sections, args.query, args.limit ?? 20);
  return { count: hits.length, hits };
}
