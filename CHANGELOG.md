# Changelog

All notable changes to `wasm-mcp` are recorded here. Versions follow
[Semantic Versioning](https://semver.org/): tool-schema or behavior
changes that aren't backward-compatible bump the major; new tools or
optional schema fields bump the minor; internal fixes bump the patch.

## A note on data-refresh versions

This file records **code changes** — new tools, schema tweaks,
internal fixes. Spec-data freshness rides a separate track: an
auto-refresh workflow SHA-diffs the upstream `WebAssembly/spec` and
`WebAssembly/proposals` repositories and ships a PATCH release when
the pinned commit moves, re-baking the indexed JSON. Those data-only
PATCH releases are noted here briefly; the pinned SHAs live in
[`vendor/PINNED.txt`](vendor/PINNED.txt) and are reported by the
`spec_version` tool.

## 0.2.0

### Added

- `instruction_get` now returns per-instruction **trap conditions**: a
  `traps` array (each `{ condition, name }`, with the spec's canonical
  trap name) plus a `can_trap` boolean. Empty for instructions that
  never trap (e.g. `i32.add`). Covers the finite trapping set —
  integer `div`/`rem`, non-saturating float→int `trunc` (not
  `trunc_sat`), memory loads/stores + bulk ops, table ops,
  `call_indirect`, `unreachable`, and the single-condition reference
  instructions. Derived at build time from the pinned spec; trap names
  verified against the spec's own `test/core/*.wast` `assert_trap`
  messages.
- `instruction_list` gains a `can_trap` filter, and its rows now carry
  `can_trap`.

Pin unchanged.

## 0.1.0 — initial release

### Added

- A read-only MCP server over the WebAssembly specification,
  SHA-pinned and deterministic, distributed as both an npm stdio
  package and a hosted Cloudflare Worker.
- Tools: `spec_version`, `instruction_get`, `instruction_list`,
  `instruction_search`, `type_get`, `section_get`, `section_list`,
  `spec_search`, `proposal_list`.
- `section_get`, `section_list`, and `spec_search` span all three
  specs in the `WebAssembly/spec` repo via a `spec` argument: `core`
  (default), `js-api` (JavaScript embedding), and `web-api` (Web
  integration). Instruction and type tools are `core`-only.
- Build pipeline: clones `WebAssembly/spec` at the pinned SHA,
  extracts the structured instruction index + macro table from the
  upstream sources, parses the reStructuredText (core) and Bikeshed
  (js-api / web-api) sections into anchor-addressable clauses, derives
  a type catalog, and indexes the `WebAssembly/proposals` Markdown
  tables — all baked into JSON at build time so the running server
  does pure local lookups.
- Tool definitions live in a single registry (`src/mcp/tool_meta.ts`)
  shared by the server and the docs generator, so the published tool
  docs can't drift from the server.
- A VitePress documentation site, served as the hosted Worker's static
  assets, with an auto-generated tool reference and snapshots page.
- Pinned at `WebAssembly/spec@7a366e15` and
  `WebAssembly/proposals@e007b5c9`.
