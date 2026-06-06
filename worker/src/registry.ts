// Worker tool registry. Each entry pairs a JSON-Schema input contract
// (returned verbatim in tools/list) with a handler that calls the
// SHARED pure query functions from ../../src/spec/*. Behaviour parity
// with the stdio server is guaranteed because the ranking / filtering
// logic lives in those shared modules — only the thin arg-mapping and
// the schema shape live here.

import { SPEC, PROPOSALS } from "./data.js";
import {
  getInstruction,
  listInstructions,
  searchInstructions,
} from "../../src/spec/instructions_query.js";
import { getClause, listSections, searchSpec } from "../../src/spec/sections_query.js";
import { getType } from "../../src/parser/types.js";
import { listProposals } from "../../src/spec/proposals_query.js";
import { INSTRUCTION_CATEGORIES, WASM_VERSIONS } from "../../src/parser/instructions.js";
import { PROPOSAL_STATUSES } from "../../src/parser/proposals.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => unknown;
}

const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

const str = (description: string) => ({ type: "string", description });
const int = (description: string, min?: number, max?: number) => ({
  type: "integer",
  ...(min !== undefined ? { minimum: min } : {}),
  ...(max !== undefined ? { maximum: max } : {}),
  description,
});

export const TOOL_REGISTRY: ToolDef[] = [
  {
    name: "spec_version",
    description:
      "Return this server's package version plus the pinned upstream commit SHA(s) the bundled data was indexed from.",
    inputSchema: obj({}),
    handler: () => ({
      spec: { key: SPEC.pin.key, sha: SPEC.pin.sha },
      proposals: { key: PROPOSALS.pin.key, sha: PROPOSALS.pin.sha },
    }),
  },
  {
    name: "instruction_get",
    description:
      "Fetch one WebAssembly instruction by mnemonic (`i32.add`) or binary opcode (`0x6a`, multi-byte `0xfd 0x89 0x02`): opcode bytes, category, introducing version, stack type signature, validation/execution anchors + URLs.",
    inputSchema: obj({
      mnemonic: str("Instruction mnemonic, e.g. `i32.add`. Case-insensitive, exact."),
      opcode: str("Binary opcode hex, e.g. `0x6a` or `0xfd 0x89 0x02`. Exact."),
    }),
    handler: (a) => {
      if (a.mnemonic === undefined && a.opcode === undefined) return null;
      return getInstruction(SPEC.instructions, {
        mnemonic: a.mnemonic as string | undefined,
        opcode: a.opcode as string | undefined,
      });
    },
  },
  {
    name: "instruction_list",
    description:
      "Enumerate WebAssembly instructions, filterable by `category`, `introduced_in` (1.0|2.0|3.0), and mnemonic `prefix`. Rows sorted by opcode.",
    inputSchema: obj({
      category: { type: "string", enum: [...INSTRUCTION_CATEGORIES], description: "Instruction category." },
      introduced_in: { type: "string", enum: [...WASM_VERSIONS], description: "Introducing version." },
      prefix: str("Mnemonic prefix, e.g. `i32.`. Case-insensitive."),
    }),
    handler: (a) => {
      const instructions = listInstructions(SPEC.instructions, {
        category: a.category as never,
        version: a.introduced_in as string | undefined,
        prefix: a.prefix as string | undefined,
      });
      return { count: instructions.length, instructions };
    },
  },
  {
    name: "instruction_search",
    description:
      "Ranked free-text search across instruction mnemonics, categories, and opcode hex. Returns hits with a `matched_on` field.",
    inputSchema: obj(
      { query: str("Search text."), limit: int("Max hits.", 1, 100) },
      ["query"],
    ),
    handler: (a) => {
      const hits = searchInstructions(SPEC.instructions, a.query as string, (a.limit as number) ?? 20);
      return { count: hits.length, hits };
    },
  },
  {
    name: "type_get",
    description:
      "Look up a value type (`i32`, `funcref`, `v128`, …) or type form (`functype`, `limits`, `memtype`, …): classification, sibling members, defining clause prose, formal refs, and URL.",
    inputSchema: obj({ name: str("Type or type-form name. Case-insensitive, exact.") }, ["name"]),
    handler: (a) => getType(SPEC.types, a.name as string),
  },
  {
    name: "section_get",
    description:
      "Fetch one spec clause by id or anchor (`syntax-numtype`, `valid-unreachable`, `binary-instr`, …): title, prose, cross-references, SpecTec formal refs, and rendered URL.",
    inputSchema: obj({ id: str("Clause id or anchor.") }, ["id"]),
    handler: (a) => getClause(SPEC.sections, a.id as string),
  },
  {
    name: "section_list",
    description:
      "Navigate the clause tree, filterable by source `path` (`syntax`, `valid`, `exec`, `binary`, `text`, `appendix`), `anchor_prefix`, `titled_only`, and `max_level`.",
    inputSchema: obj({
      path: str("Source path / prefix."),
      anchor_prefix: str("Id/anchor prefix."),
      titled_only: { type: "boolean", description: "Drop anchor-only blocks." },
      max_level: int("Cap heading depth.", 1, 6),
    }),
    handler: (a) => {
      const sections = listSections(SPEC.sections, {
        path: a.path as string | undefined,
        anchor_prefix: a.anchor_prefix as string | undefined,
        titled_only: a.titled_only as boolean | undefined,
        max_level: a.max_level as number | undefined,
      });
      return { count: sections.length, sections };
    },
  },
  {
    name: "spec_search",
    description:
      "Full-text search across clause anchors, titles, and prose. Ranked anchor-exact > title > anchor > prose, with snippets for body matches.",
    inputSchema: obj({ query: str("Search text."), limit: int("Max hits.", 1, 100) }, ["query"]),
    handler: (a) => {
      const hits = searchSpec(SPEC.sections, a.query as string, (a.limit as number) ?? 20);
      return { count: hits.length, hits };
    },
  },
  {
    name: "proposal_list",
    description:
      "List WebAssembly proposals + phases. Filter by `status` (phase-0…phase-5, finished, inactive), `phase` (0–5), `champion`, `affects` (core|js-api|web-api), or `contains`.",
    inputSchema: obj({
      status: { type: "string", enum: [...PROPOSAL_STATUSES], description: "Lifecycle status." },
      phase: int("Numeric phase 0–5.", 0, 5),
      champion: str("Champion substring."),
      affects: str("Affected spec (finished only)."),
      contains: str("Name/champion substring."),
    }),
    handler: (a) => {
      const proposals = listProposals(PROPOSALS.proposals, {
        status: a.status as never,
        phase: a.phase as number | undefined,
        champion: a.champion as string | undefined,
        affects: a.affects as string | undefined,
        contains: a.contains as string | undefined,
      });
      return { pin: { sha: PROPOSALS.pin.sha }, count: proposals.length, proposals };
    },
  },
];
