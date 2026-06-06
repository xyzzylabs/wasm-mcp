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
