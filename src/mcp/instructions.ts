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

Unofficial, community-maintained — not affiliated with, endorsed by,
or sponsored by the W3C WebAssembly Community Group or Working Group.

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
