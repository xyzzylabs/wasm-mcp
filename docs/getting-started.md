# Get started in 5 minutes

`wasm-mcp` is a read-only [Model Context Protocol](https://modelcontextprotocol.io)
server over the WebAssembly specification. It exposes the instruction
set, value/function types, spec sections, full-text search, and the
proposal phase list as structured tools, so an AI agent can cite the
spec precisely instead of guessing.

## Option A — local (stdio)

No install needed; `npx` fetches and runs it.

### Claude Code / Claude Desktop

Add to your project's `.mcp.json` (or the Claude Desktop config):

```json
{
  "mcpServers": {
    "wasm": { "command": "npx", "args": ["wasm-mcp"] }
  }
}
```

Restart the client; the `wasm` server's 9 tools appear in the tool
picker.

### Any MCP client

```sh
npx wasm-mcp        # speaks MCP over stdio
```

## Option B — hosted (HTTP)

Point any streamable-HTTP MCP client at the hosted Worker — nothing to
install:

```
https://mcp.xyzzylabs.ai/wasm/mcp
```

It's anonymous (no auth) and IP-rate-limited. `GET /health` reports
the pinned SHAs; see [Deployment](/deployment) to host your own.

## First calls

Once connected, try:

- `spec_version` — what commit is this data pinned to?
- `instruction_get { "mnemonic": "i32.add" }` — opcode, signature,
  anchors.
- `instruction_get { "opcode": "0x0d" }` — reverse-lookup by opcode.
- `instruction_list { "category": "vec", "introduced_in": "3.0" }` —
  what relaxed-SIMD instructions did Wasm 3.0 add?
- `type_get { "name": "funcref" }` — classification + sibling types.
- `spec_search { "query": "trap" }` — find clauses by text.
- `section_get { "id": "memories", "spec": "js-api" }` — read a
  JavaScript-embedding clause (the `spec` arg also takes `web-api`).
- `proposal_list { "status": "finished", "affects": "core" }` — what
  landed in the core spec.

The full surface, with every input field and more examples, is on the
[Tool reference](/tools).

## What you can rely on

- **Read-only & deterministic** — same input, same output, over a
  pinned spec commit. No tool mutates anything or runs any Wasm.
- **No network at request time** — all data is baked in at build time.
- **Honest provenance** — every section/instruction answer carries the
  stable anchor and the rendered spec URL; `spec_version` reports the
  exact pinned commits.
