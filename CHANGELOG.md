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

## [Unreleased]

### Added

- `section_get`, `section_list`, and `spec_search` now span all three
  specs in the `WebAssembly/spec` repo via a `spec` argument: `core`
  (default), `js-api` (JavaScript embedding), and `web-api` (Web
  integration). The js-api/web-api Bikeshed sources are parsed into
  the same anchor-addressable clause shape. Instruction and type
  tools remain `core`-only.
- A VitePress documentation site (served as the hosted Worker's static
  assets) with an auto-generated tool reference and snapshots page.

### Changed

- Tool definitions are now sourced from a single registry
  (`src/mcp/tool_meta.ts`) shared by the server and the docs
  generator, so the published tool docs can't drift from the server.

## 0.1.0 — initial release

### Added

- Initial release. A read-only MCP server over the WebAssembly core
  specification, SHA-pinned and deterministic, distributed as both an
  npm stdio package and a hosted Cloudflare Worker.
- Tools: `spec_version`, `instruction_get`, `instruction_list`,
  `instruction_search`, `type_get`, `section_get`, `section_list`,
  `spec_search`, `proposal_list`.
- Build pipeline: clones `WebAssembly/spec` at the pinned SHA, dumps
  the structured instruction index + macro table from the upstream
  Python sources, parses the reStructuredText sections into
  anchor-addressable clauses, derives a type catalog, and indexes the
  `WebAssembly/proposals` Markdown tables — all baked into JSON at
  build time so the running server does pure local lookups.
- Pinned at `WebAssembly/spec@7a366e15` and
  `WebAssembly/proposals@e007b5c9`.
