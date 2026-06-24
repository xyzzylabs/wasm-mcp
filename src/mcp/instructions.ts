// Server-level instructions surfaced to MCP clients during the
// initialize handshake. Clients that forward `instructions` into the
// LLM's system prompt give the agent this guidance automatically.
//
// Keep it focused on workflows and invariants; per-tool detail lives
// in each tool's `description`.

import { HOSTED_TOOLS, STDIO_ONLY_TOOLS, TOTAL_TOOL_COUNT } from "../spec/tool_inventory.js";

export const SERVER_INSTRUCTIONS = `
wasm-mcp serves read-only structured data from the WebAssembly core
specification (https://github.com/WebAssembly/spec). Every response
is deterministic over data pinned to a specific upstream commit and
baked into the package at build time.

Not affiliated with, endorsed by, or sponsored by the W3C WebAssembly
Community Group or Working Group.

Common workflow:
  1. \`spec_version\` — call first when you need to cite the spec or
     report what you're reading. Returns the pinned upstream commit.
  2. \`instruction_search\` — find an instruction from a partial name
     or symptom ("extend", "trunc", "0x6a") when you don't know the
     exact mnemonic. Returns ranked lightweight hits.
  3. \`instruction_get { mnemonic }\` or \`{ opcode }\` — the full
     record for one instruction: opcode bytes, category, stack type
     signature, and validation/execution prose anchors + URLs.
  4. \`instruction_list { category? }\` — enumerate instructions,
     filterable by category, introducing version, or mnemonic prefix.
  5. \`type_get { name }\` — a value type or type form ('i32',
     'funcref', 'functype', 'limits') with its defining clause prose.
  6. \`spec_search { query }\` — full-text search across clause
     anchors, titles, and prose when you don't know the anchor.
  7. \`section_get { id, spec? }\` — one spec clause by anchor (e.g.
     'syntax-numtype', 'valid-unreachable'): prose, cross-refs,
     SpecTec formal-rule references, and the rendered URL.
  8. \`section_list { spec?, path? }\` — navigate the clause tree,
     scoped to an area ('syntax', 'valid', 'exec', 'binary', 'text',
     'appendix').

The section tools (section_get / section_list / spec_search) cover
three specs via a 'spec' argument: 'core' (default — the instruction
set, validation, execution, binary + text formats), 'js-api' (the
JavaScript embedding API), and 'web-api' (Web-platform integration).
The instruction and type tools are 'core'-only.
  9. \`proposal_list { status? }\` — WebAssembly proposals and their
     phases, from the pinned WebAssembly/proposals repo.

Note on formal notation. Since 2025 the spec is authored in SpecTec;
validation / execution clauses are generated from formal rules. This
server keeps the hand-written prose and records each clause's SpecTec
rule names in 'formal_refs', with 'url' linking the rendered
notation. It does not itself render the formal grammar / reduction
rules — follow the URL for those.

The tool surface is intentionally narrow:
  - Read-only. No tool mutates state or writes to disk / the network.
  - Deterministic. Same input → same output, over the pinned commit.
  - No execution. Tools never compile, validate-by-running,
    instantiate, or run any WebAssembly or arbitrary code. Validation
    and reduction rules are returned as data (the prose / typing
    judgement), not by applying them.

Transport differences:
  - The stdio server (npx wasm-mcp) exposes all ${TOTAL_TOOL_COUNT} tools.
  - The hosted Cloudflare Worker exposes ${HOSTED_TOOLS.length} of them.
  - Tools that need a subprocess or filesystem (${STDIO_ONLY_TOOLS.length} today)
    are stdio-only.
`.trim();
