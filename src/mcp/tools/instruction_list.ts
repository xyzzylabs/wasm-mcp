// MCP tool: instruction_list — enumerate WebAssembly instructions,
// optionally filtered by category, version, or mnemonic prefix.
// Returns lightweight rows (mnemonic, opcode bytes, category,
// version); follow up with instruction_get for the full record.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadInstructions } from "../../spec/spec_data.js";
import { listInstructions, type InstructionSummary } from "../../spec/instructions_query.js";
import { INSTRUCTION_CATEGORIES } from "../../parser/instructions.js";
import type { InstructionCategory } from "../../parser/instructions.js";
import { WASM_VERSIONS } from "../../parser/instructions.js";
import type { VersionValue } from "../../versions.js";

export const instructionListSchema = {
  category: z
    .enum(INSTRUCTION_CATEGORIES)
    .optional()
    .describe(
      "Filter by instruction category: control, numeric, parametric, variable, table, memory, ref, i31, struct, array, extern, vec (vector/SIMD).",
    ),
  introduced_in: z
    .enum(WASM_VERSIONS)
    .optional()
    .describe("Filter to instructions introduced in this WebAssembly version: `1.0`, `2.0`, or `3.0`."),
  prefix: z
    .string()
    .min(1)
    .optional()
    .describe("Filter to mnemonics starting with this prefix, e.g. `i32.` or `v128.`. Case-insensitive."),
  can_trap: z
    .boolean()
    .optional()
    .describe(
      "Filter by trapping behavior: `true` keeps only instructions that can trap at runtime, `false` keeps only those that never trap. See instruction_get for the per-instruction trap conditions.",
    ),
  version: versionArg,
};

export type InstructionListArgs = {
  category?: InstructionCategory;
  introduced_in?: (typeof WASM_VERSIONS)[number];
  prefix?: string;
  can_trap?: boolean;
  version?: VersionValue;
};

export const instructionListExamples = [
  {
    q: "List all control-flow instructions",
    input: { category: "control" },
    note: "Filters to the control category; rows are sorted by opcode.",
  },
  {
    q: "What memory instructions did Wasm 3.0 add?",
    input: { category: "memory", introduced_in: "3.0" },
    note: "Combine category + introduced_in to see what a release contributed.",
  },
  {
    q: "List the i32 numeric instructions",
    input: { prefix: "i32." },
    note: "Prefix filter is the quickest way to scope to one type family.",
  },
  {
    q: "Which instructions can trap?",
    input: { can_trap: true },
    note: "can_trap filters to the finite trapping set; each row's can_trap mirrors instruction_get's traps.",
  },
];

export interface InstructionListResult {
  count: number;
  instructions: InstructionSummary[];
}

export function instructionList(args: InstructionListArgs): InstructionListResult {
  const records = loadInstructions(args.version);
  const instructions = listInstructions(records, {
    category: args.category,
    version: args.introduced_in,
    prefix: args.prefix,
    can_trap: args.can_trap,
  });
  return { count: instructions.length, instructions };
}
