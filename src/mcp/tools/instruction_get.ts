// MCP tool: instruction_get — fetch one WebAssembly instruction by
// mnemonic (`i32.add`) or binary opcode (`0x6a`). Returns the full
// structured record: opcode bytes, category, version, stack type
// signature, and validation/execution prose anchors + URLs.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadInstructions } from "../../spec/instructions_data.js";
import { getInstruction } from "../../spec/instructions_query.js";
import type { InstructionRecord } from "../../parser/instructions.js";
import type { VersionValue } from "../../versions.js";

export const instructionGetSchema = {
  mnemonic: z
    .string()
    .min(1)
    .optional()
    .describe("Instruction mnemonic, e.g. `i32.add`, `br_if`, `local.get`. Case-insensitive. Exact match."),
  opcode: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Binary opcode as hex bytes, e.g. `0x6a`, `6a`, or multi-byte `0xfd 0x89 0x02`. Exact match. Used when `mnemonic` is absent or doesn't match.",
    ),
  version: versionArg,
};

export type InstructionGetArgs = {
  mnemonic?: string;
  opcode?: string;
  version?: VersionValue;
};

export const instructionGetExamples = [
  {
    q: "Get the i32.add instruction",
    input: { mnemonic: "i32.add" },
    note: "Returns opcode 0x6a, the [i32 i32] → [i32] signature, and validation/execution anchors.",
  },
  {
    q: "What instruction is opcode 0x0d?",
    input: { opcode: "0x0d" },
    note: "Reverse lookup by binary opcode — resolves to br_if.",
  },
];

export function instructionGet(args: InstructionGetArgs): InstructionRecord | null {
  if (args.mnemonic === undefined && args.opcode === undefined) return null;
  const records = loadInstructions(args.version);
  return getInstruction(records, { mnemonic: args.mnemonic, opcode: args.opcode });
}
