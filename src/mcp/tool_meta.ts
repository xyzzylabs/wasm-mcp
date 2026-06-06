// Single source of truth for the tool surface: name, title,
// description, Zod input schema, handler, and usage examples for
// every tool. Both the stdio server (src/mcp/server.ts) and the docs
// generator (src/docs/build_docs.ts) consume this array, so a tool's
// description and examples live in exactly one place and can't drift
// between the running server and its documentation.

import type { ZodRawShape } from "zod";

import { specVersion, specVersionSchema } from "./tools/spec_version.js";
import {
  instructionGet,
  instructionGetSchema,
  instructionGetExamples,
} from "./tools/instruction_get.js";
import {
  instructionList,
  instructionListSchema,
  instructionListExamples,
} from "./tools/instruction_list.js";
import {
  instructionSearch,
  instructionSearchSchema,
  instructionSearchExamples,
} from "./tools/instruction_search.js";
import { typeGet, typeGetSchema, typeGetExamples } from "./tools/type_get.js";
import { sectionGet, sectionGetSchema, sectionGetExamples } from "./tools/section_get.js";
import { sectionList, sectionListSchema, sectionListExamples } from "./tools/section_list.js";
import { specSearch, specSearchSchema, specSearchExamples } from "./tools/spec_search.js";
import { proposalList, proposalListSchema, proposalListExamples } from "./tools/proposal_list.js";

/** One usage example shown in the docs tool reference. */
export interface ToolExample {
  /** Plain-language question this call answers. */
  q: string;
  /** The `arguments` object passed to the tool. */
  input: Record<string, unknown>;
  /** Optional note on what the result looks like / why. */
  note?: string;
}

/**
 * A tool's complete public definition. `handler` returns either the
 * result payload (serialised as JSON text) or null. Returning null
 * is rendered as an isError response by the server.
 */
export interface ToolMeta {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  examples: ToolExample[];
  handler: (args: Record<string, unknown>) => unknown;
}

export const TOOLS: ToolMeta[] = [
  {
    name: "spec_version",
    title: "Pinned spec version",
    description:
      "Return self-description of this MCP server: package name + version, plus the pinned upstream commit SHA for every spec snapshot baked into the package. Use this first when citing the spec, or to verify the server's freshness and reproducibility.",
    inputSchema: specVersionSchema,
    examples: [],
    handler: () => specVersion(PACKAGE_INFO),
  },
  {
    name: "instruction_get",
    title: "Get instruction",
    description:
      "Fetch one WebAssembly instruction by mnemonic (`i32.add`, `br_if`) or binary opcode (`0x6a`, `0xfd 0x89 0x02`) as structured JSON: opcode bytes, category, introducing version, stack type signature, and validation/execution prose anchors + spec URLs. Provide `mnemonic` or `opcode` (mnemonic wins if both match).",
    inputSchema: instructionGetSchema,
    examples: instructionGetExamples,
    handler: (a) => instructionGet(a),
  },
  {
    name: "instruction_list",
    title: "List instructions",
    description:
      "Enumerate WebAssembly instructions with optional filters: `category` (control, numeric, parametric, variable, table, memory, ref, i31, struct, array, extern, vec), `introduced_in` (1.0 | 2.0 | 3.0), and `prefix` (mnemonic prefix like `i32.`). Returns lightweight rows sorted by opcode; follow up with instruction_get for full detail.",
    inputSchema: instructionListSchema,
    examples: instructionListExamples,
    handler: (a) => instructionList(a),
  },
  {
    name: "instruction_search",
    title: "Search instructions",
    description:
      "Search WebAssembly instructions by free-text query, matched against mnemonic (exact > substring), category name, and opcode hex. The entry point when you don't know the exact mnemonic. Returns ranked lightweight hits with a `matched_on` field; follow up with instruction_get.",
    inputSchema: instructionSearchSchema,
    examples: instructionSearchExamples,
    handler: (a) => instructionSearch(a as { query: string }),
  },
  {
    name: "type_get",
    title: "Get type",
    description:
      "Look up a WebAssembly type or type form by name: concrete value types (`i32`, `i64`, `f32`, `f64`, `v128`, `funcref`, `externref`, …) or type forms (`functype`, `limits`, `memtype`, `tabletype`, `globaltype`, `reftype`, `valtype`, `rectype`, `heaptype`, …). Returns its classification, sibling members for category types, defining clause prose, SpecTec formal-rule references, and the rendered spec URL.",
    inputSchema: typeGetSchema,
    examples: typeGetExamples,
    handler: (a) => typeGet(a as { name: string }),
  },
  {
    name: "section_get",
    title: "Get spec section",
    description:
      "Fetch one spec clause by id or anchor (e.g. `syntax-numtype`, `valid-unreachable`, `exec-nop`, `binary-instr`, `text-instr`) — matching the rendered spec's stable fragment ids. Returns the clause title, cleaned prose, `:ref:` cross-references, the SpecTec `formal_refs` it cites, and the rendered URL. Validation/execution clauses are SpecTec-generated: prose may be terse, but formal_refs + url point to the formal rule.",
    inputSchema: sectionGetSchema,
    examples: sectionGetExamples,
    handler: (a) => sectionGet(a as { id: string }),
  },
  {
    name: "section_list",
    title: "List spec sections",
    description:
      "Enumerate spec clauses for navigation, filterable by source `path` (`intro`, `syntax`, `valid`, `exec`, `binary`, `text`, `appendix`, or sub-paths like `syntax/types`), `anchor_prefix` (`syntax-`, `valid-`, …), `titled_only`, and `max_level`. Returns lightweight rows {id, anchors, title, level, path, url}; follow up with section_get.",
    inputSchema: sectionListSchema,
    examples: sectionListExamples,
    handler: (a) => sectionList(a),
  },
  {
    name: "spec_search",
    title: "Search spec",
    description:
      "Full-text search across the spec section index — clause anchors/ids, titles, and prose. The entry point when you don't know the exact anchor. Returns ranked hits with a `matched_on` field (anchor-exact > title > anchor > prose) and a prose snippet for body matches; follow up with section_get.",
    inputSchema: specSearchSchema,
    examples: specSearchExamples,
    handler: (a) => specSearch(a as { query: string }),
  },
  {
    name: "proposal_list",
    title: "List WebAssembly proposals",
    description:
      "List WebAssembly proposals and their phases from the pinned WebAssembly/proposals repository. Filter by `status` (phase-0…phase-5, finished, inactive), `phase` (0–5), `champion` substring, `affects` (finished proposals touching core / js-api / web-api), or `contains` (name/champion substring). Each row carries name, status, phase, champion, affected_specs, spec_version, and the proposal URL.",
    inputSchema: proposalListSchema,
    examples: proposalListExamples,
    handler: (a) => proposalList(a),
  },
];

// The server injects the real package info before registering tools;
// the docs generator never calls the spec_version handler, so a
// placeholder is fine there. Kept module-scoped so the TOOLS array
// stays a plain literal.
export let PACKAGE_INFO: { name: string; version: string } = {
  name: "wasm-mcp",
  version: "0.0.0",
};
export function setPackageInfo(info: { name: string; version: string }): void {
  PACKAGE_INFO = info;
}
