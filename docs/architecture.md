# Architecture

`wasm-mcp` is built around one idea: **all the work happens at build
time**, so the running server is a pure, deterministic lookup over
static JSON.

## The contract

Every tool is:

- **Read-only** — no state mutation, no writes outside an optional
  local cache.
- **Deterministic** — same input → same output, over a pinned spec
  commit ([`vendor/PINNED.txt`](https://github.com/xyzzylabs/wasm-mcp/blob/main/vendor/PINNED.txt)).
- **No execution** — never compiles, validates-by-running,
  instantiates, or runs any WebAssembly or arbitrary code. Validation
  and reduction rules are returned as *data*.
- **No auth, no secrets, no PII** — usable anonymously.
- **No network at request time** — all spec data is fetched and
  indexed at build time and baked in.

This contract is the whole reason the server can run as an
unauthenticated hosted endpoint.

## Build-time pipeline

```
WebAssembly/spec @ pinned SHA          WebAssembly/proposals @ pinned SHA
        │                                       │
        ▼                                       ▼
 scripts/dump-instructions.py            *.md phase tables
  (AST-parses index-instructions.py       │
   + macros.def — no code executed)       │
        │                                  │
        ▼                                  ▼
 src/parser/instructions.ts        src/parser/proposals.ts
 src/parser/sections.ts  (RST)
 src/parser/types.ts
        │                                  │
        └──────────► src/index/build_spec.ts ◄── build_proposals.ts
                            │
                            ▼
        build/wasm-spec-core-main.json   build/wasm-proposals-main.json
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     stdio server (npx)         Cloudflare Worker (bundled)
```

### Why not run SpecTec?

Since 2025 the spec is authored in [SpecTec](https://github.com/WebAssembly/spec/tree/main/spectec),
an OCaml DSL that generates the rendered prose and the formal
typing/reduction rules. Building the full rendered HTML needs an
OCaml + SpecTec + Sphinx + LaTeX toolchain.

`wasm-mcp` deliberately avoids that. Instead:

- **Instructions** come from AST-parsing the upstream Python index
  (`document/core/appendix/index-instructions.py`) plus the LaTeX
  macro table (`document/core/util/macros.def`). No upstream code is
  executed — the Python `ast` module reads the literal data.
- **Sections** come from parsing the reStructuredText sources
  directly. The prose is kept; the SpecTec splice macros
  (`$${rule: …}`) are recorded as `formal_refs` and linked to the
  rendered spec URL.

This keeps the build fast and deterministic over any pinned commit,
with no heavy native toolchain — at the cost of not rendering the
formal grammar/reduction notation inline (the `url` field links it).

## Shared query logic

The ranking and filtering logic lives in dependency-free modules under
[`src/spec/`](https://github.com/xyzzylabs/wasm-mcp/tree/main/src/spec)
(`instructions_query`, `sections_query`, `proposals_query`). Both the
stdio server and the Worker import the *same* functions, so results
can't drift between transports — a test asserts the Worker's tool set
equals the declared hosted set.

## Tool definitions as a single source

Every tool's name, description, Zod schema, and examples live once in
[`src/mcp/tool_meta.ts`](https://github.com/xyzzylabs/wasm-mcp/blob/main/src/mcp/tool_meta.ts).
The stdio server registers from it, and this docs site's
[Tool reference](/tools) is generated from it — so the docs always
match the running server.
