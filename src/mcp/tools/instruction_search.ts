// MCP tool: instruction_search — free-text search across instruction
// mnemonics, categories, and opcodes. The entry point when you don't
// know the exact mnemonic. Returns ranked lightweight hits; follow
// up with instruction_get for the full record.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadInstructions } from "../../spec/instructions_data.js";
import { searchInstructions, type InstructionSearchHit } from "../../spec/instructions_query.js";
import type { VersionValue } from "../../versions.js";

export const instructionSearchSchema = {
  query: z
    .string()
    .min(1)
    .describe(
      "Search text. Matched against mnemonic (exact > substring), category name, and opcode hex. E.g. `extend`, `trunc`, `vec`, `0x6a`.",
    ),
  limit: z.number().int().min(1).max(100).default(20).describe("Max ranked hits returned."),
  version: versionArg,
};

export type InstructionSearchArgs = {
  query: string;
  limit?: number;
  version?: VersionValue;
};

export const instructionSearchExamples = [
  {
    q: "Find all the extend instructions",
    input: { query: "extend" },
    note: "Substring match across mnemonics surfaces i32.extend8_s, i64.extend_i32_u, etc.",
  },
  {
    q: "Which instruction has opcode 0x6a?",
    input: { query: "0x6a" },
    note: "A hex query also matches by opcode — resolves i32.add at the top.",
  },
];

export interface InstructionSearchResult {
  count: number;
  hits: InstructionSearchHit[];
}

export function instructionSearch(args: InstructionSearchArgs): InstructionSearchResult {
  const records = loadInstructions(args.version);
  const hits = searchInstructions(records, args.query, args.limit ?? 20);
  return { count: hits.length, hits };
}
