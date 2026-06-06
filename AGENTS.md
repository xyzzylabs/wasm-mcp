# Project rules for AI agents

This file follows the cross-tool [AGENTS.md](https://agents.md/)
convention. Tool-specific alias files (`CLAUDE.md`, etc.) import
this file via `@AGENTS.md` so every agent reads the same rules
with no drift.

## What wasm-mcp is

A general-purpose, public MCP server for the WebAssembly
specifications. It exposes structured instructions (mnemonics,
opcodes, type signatures, validation and execution rules), value /
function types, the binary and text formats, and spec section
retrieval over the Model Context Protocol — locally over stdio or
hosted as a Cloudflare Worker over HTTP. The data is SHA-pinned to a
specific commit of [WebAssembly/spec](https://github.com/WebAssembly/spec)
and indexed at build time; the running server does pure local lookups.

The `WebAssembly/spec` repository carries three specifications in
parallel under `/document/`:

- `core` — the WebAssembly core specification (instruction set,
  validation, execution, binary + text formats).
- `js-api` — the JavaScript embedding API (`WebAssembly.instantiate`,
  `WebAssembly.Module`, `WebAssembly.Memory`, …). Web IDL-based.
- `web-api` — additional Web-platform integration (streaming
  compilation, `fetch` integration).

All three share one pinned commit. `core` is the first-class target;
`js-api` and `web-api` are added in a later release via the same
`section_get` / `clause_get` / `spec_search` surface. The
instruction tools are intrinsically `core`-only.

The server is the product. Tools, dependencies, and documentation
should read as if written for any reader interested in the
WebAssembly spec — engine implementers, tooling authors, educators,
other agents — not for one specific downstream consumer.

## Hard rules

1. **The tool surface stays narrow.** Read-only, deterministic, no
   execution, no auth, no writes. New tools land only if they expose
   structured spec data and meet that contract. In particular: never
   compile, validate-by-running, instantiate, or run any WebAssembly
   or arbitrary code from a tool. Validation rules are returned as
   *data* (the prose / typing judgement), not by *applying* them.

2. **No network at request time.** All spec data is fetched at build
   time, indexed into JSON, and baked into the package. The running
   server reads JSON only.

3. **No subprocess fallbacks for hosted-incompatible paths.**
   Anything that can't run behind a Cloudflare Worker (shell-out,
   network call, filesystem write) doesn't belong in the tool
   surface.

4. **Comments and docs describe the code, not a downstream
   workflow.** Anything that would only make sense to someone
   familiar with a specific consumer of this server gets rewritten
   to describe the general behavior instead.

5. **Commit messages, PR descriptions, and issue titles are part of
   the project's public surface.** Same standard as code comments —
   describe what changed and why in general terms.

## Code conventions

- TypeScript everywhere. Strict mode. Zod for input schemas. JSDoc
  on every exported interface field.
- Tests live next to source as `*.test.ts`. `vitest run` runs them
  all.
- Tool names use `snake_case` (e.g. `instruction_get`,
  `section_get`).
- The pinned spec commit lives in `vendor/PINNED.txt`. The build
  pipeline reads from there and writes structured JSON into
  `build/`. Both `vendor/` and `build/` are gitignored.

## What you can reference

- Upstream WebAssembly repos: `WebAssembly/spec`,
  `WebAssembly/proposals`, individual `WebAssembly/*-proposal` repos.
- The rendered spec at <https://webassembly.github.io/spec/core/>
  for stable per-clause anchors.
- The SpecTec DSL (`spectec/`) for future extraction of typing /
  reduction rules.
- Tooling that publicly consumes the MCP protocol: Claude Code,
  Claude Desktop, MCP Inspector, Cursor, and other public agent
  frameworks.
- The hosted Cloudflare Worker deployment of THIS server (when it
  exists).
- General-purpose ecosystem packages: `cheerio`,
  `@modelcontextprotocol/sdk`, etc.

## When in doubt

Default to silence. If a comment doesn't help someone reading the
code understand the code, delete it. If a doc page implies a
specific use case rather than describing the capability, rewrite it
to describe the capability.
