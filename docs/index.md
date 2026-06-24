---
layout: home

hero:
  name: wasm-mcp
  text: Structured MCP for the WebAssembly spec
  tagline: Instruction, type, section, and proposal lookup over the WebAssembly specification for any MCP-speaking AI agent — SHA-pinned, deterministic, read-only. Run it locally over stdio, or hit the hosted Cloudflare Worker over HTTP.
  actions:
    - theme: brand
      text: Tool reference
      link: /tools
    - theme: alt
      text: Get started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/xyzzylabs/wasm-mcp

features:
  - icon: 🤖
    title: Spec lookup for AI agents
    details: Any MCP client (Claude Code, Claude Desktop, Cursor, MCP Inspector) gets instruction_get, type_get, section_get, spec_search, and more — structured JSON answers grounded on real spec text instead of grep'd HTML. Every answer carries a stable anchor and the rendered spec URL.
  - icon: 🧩
    title: 9 tools
    details: "spec_version · instruction_get / list / search · type_get · section_get / list · spec_search · proposal_list"
  - icon: 🔢
    title: The instruction set, structured
    details: 497 instructions with binary opcodes, stack type signatures, categories (numeric, vector, reference, control, memory, …), introducing version (1.0 / 2.0 / 3.0), and validation + execution anchors. Look up by mnemonic (i32.add) or opcode (0x6a).
  - icon: 📖
    title: Sections, types & proposals
    details: 972 anchor-addressable core clauses with cleaned prose and cross-references, a 47-entry type catalog (value types + type forms), and the full WebAssembly/proposals phase list.
  - icon: 🌐
    title: Core + JS-API + Web-API
    details: section_get, section_list, and spec_search span all three specs in the WebAssembly/spec repo via a `spec` argument — the core language, the JavaScript embedding API (WebAssembly.instantiate, Module, Memory, …), and the Web-platform integration (streaming compilation).
  - icon: 🎯
    title: Deterministic over pinned data
    details: All data is fetched and indexed at build time from a pinned commit of WebAssembly/spec and baked into the package. Same input → same output. No network at request time.
  - icon: 🔌
    title: Two ways to run it
    details: Local stdio via `npx wasm-mcp`, or the hosted Cloudflare Worker over streamable HTTP. Same MCP protocol, same tools, two transports.
  - icon: 🚫
    title: Safe to host
    details: Read-only, no execution (never compiles, validates-by-running, or instantiates any Wasm), no auth, no secrets, no PII. The hosted endpoint is anonymous and IP-rate-limited.
  - icon: 🔄
    title: Auto-refreshing
    details: A scheduled workflow SHA-diffs the upstream repos daily and ships a patch release when the spec moves — npm package and hosted Worker stay current automatically.
---

> Not affiliated with, endorsed by, or maintained by the W3C WebAssembly Community Group or Working Group. It reads the publicly published WebAssembly specification.

## Install + run

::: code-group

```json [stdio (npx, recommended)]
// Wire into Claude Code via .mcp.json:
{
  "mcpServers": {
    "wasm": { "command": "npx", "args": ["wasm-mcp"] }
  }
}
```

```sh [hosted (HTTP)]
# Streamable-HTTP MCP endpoint — no install:
https://wasm-mcp.chicoxyzzy.workers.dev/mcp
```

:::

See [Get started](/getting-started) for a 5-minute walkthrough, or the
[Tool reference](/tools) for every tool's inputs and examples.
