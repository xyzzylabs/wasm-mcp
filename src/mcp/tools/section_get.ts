// MCP tool: section_get — fetch one spec clause by id or anchor
// (e.g. `syntax-numtype`, `valid-unreachable`, `binary-instr`).
// Returns the clause's title, cleaned prose, cross-references, the
// SpecTec formal-rule names it references, and the rendered URL.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadSections } from "../../spec/spec_data.js";
import { getClause } from "../../spec/sections_query.js";
import type { SpecClause } from "../../parser/sections.js";
import type { VersionValue } from "../../versions.js";

export const sectionGetSchema = {
  id: z
    .string()
    .min(1)
    .describe(
      "Clause id or anchor, e.g. `syntax-numtype`, `valid-unreachable`, `exec-nop`, `binary-instr`, `text-instr`. These match the stable fragment ids in the rendered spec.",
    ),
  version: versionArg,
};

export type SectionGetArgs = { id: string; version?: VersionValue };

export const sectionGetExamples = [
  {
    q: "Get the number types section",
    input: { id: "syntax-numtype" },
    note: "Returns the Number Types clause: prose, the i32/i64/f32/f64 formal refs, and the spec URL.",
  },
  {
    q: "Read the validation rule anchor for unreachable",
    input: { id: "valid-unreachable" },
    note: "Validation/execution clauses are SpecTec-spliced; prose may be terse but `formal_refs` names the rule and `url` links the rendered notation.",
  },
];

export function sectionGet(args: SectionGetArgs): SpecClause | null {
  const sections = loadSections(args.version);
  return getClause(sections, args.id);
}
