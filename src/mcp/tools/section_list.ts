// MCP tool: section_list — enumerate spec clauses for navigation,
// optionally filtered by source path (structure / validation /
// execution / binary / text live under distinct paths), anchor
// prefix, heading presence, or depth. Returns lightweight rows;
// follow up with section_get.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadSections } from "../../spec/spec_data.js";
import { listSections, type SectionSummary } from "../../spec/sections_query.js";
import type { VersionValue } from "../../versions.js";

export const sectionListSchema = {
  path: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Filter to a source path / prefix. Top-level areas: `intro`, `syntax` (structure), `valid` (validation), `exec` (execution), `binary`, `text`, `appendix`. Sub-paths like `syntax/types` also work.",
    ),
  anchor_prefix: z
    .string()
    .min(1)
    .optional()
    .describe("Filter to clauses whose id/anchor starts with this prefix, e.g. `syntax-`, `valid-`, `exec-`."),
  titled_only: z
    .boolean()
    .default(false)
    .describe("Drop anchor-only content blocks (keep only clauses with a heading)."),
  max_level: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .describe("Cap heading depth (1 = page titles only). Anchor-only blocks are unaffected."),
  version: versionArg,
};

export type SectionListArgs = {
  path?: string;
  anchor_prefix?: string;
  titled_only?: boolean;
  max_level?: number;
  version?: VersionValue;
};

export const sectionListExamples = [
  {
    q: "Outline the binary format sections",
    input: { path: "binary", titled_only: true },
    note: "Path filter scopes to one area; titled_only yields a clean outline.",
  },
  {
    q: "List every validation clause",
    input: { anchor_prefix: "valid-" },
    note: "Anchor-prefix filter gathers all clauses in one rule family.",
  },
];

export interface SectionListResult {
  count: number;
  sections: SectionSummary[];
}

export function sectionList(args: SectionListArgs): SectionListResult {
  const sections = loadSections(args.version);
  const out = listSections(sections, {
    path: args.path,
    anchor_prefix: args.anchor_prefix,
    titled_only: args.titled_only,
    max_level: args.max_level,
  });
  return { count: out.length, sections: out };
}
