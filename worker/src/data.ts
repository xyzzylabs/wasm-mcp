// Bundled spec data. Unlike the tc39-mcp Worker (which reads parsed
// snapshots from R2), wasm-mcp's baked artifacts are small enough
// (~0.8 MB) to inline directly into the Worker bundle. esbuild
// embeds these JSON imports at build time, so the running Worker does
// pure in-memory lookups — no network, no storage binding, the same
// determinism contract as the stdio package.

import specJson from "../../build/wasm-spec-core-main.json";
import proposalsJson from "../../build/wasm-proposals-main.json";

import type { InstructionRecord } from "../../src/parser/instructions.js";
import type { SpecClause } from "../../src/parser/sections.js";
import type { TypeEntry } from "../../src/parser/types.js";
import type { Proposal } from "../../src/parser/proposals.js";

interface SpecSnapshot {
  pin: { key: string; sha: string; spec: "core"; version: string };
  instructions: InstructionRecord[];
  sections: SpecClause[];
  types: TypeEntry[];
  report: Record<string, number>;
}
interface ProposalsSnapshot {
  pin: { key: string; sha: string; repo: "proposals"; version: string };
  proposals: Proposal[];
}

export const SPEC = specJson as unknown as SpecSnapshot;
export const PROPOSALS = proposalsJson as unknown as ProposalsSnapshot;
