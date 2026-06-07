# Contributing to wasm-mcp

Thanks for your interest. wasm-mcp is a small, public, read-only MCP
server over the WebAssembly specification. Contributions are welcome
as long as they keep the surface tight and the safety contract
intact.

## The contract (non-negotiable)

Every tool must be:

- **Read-only** — no state mutation, no writes outside an optional
  local cache.
- **Deterministic** — same input → same output, over the pinned spec
  commit in [`vendor/PINNED.txt`](vendor/PINNED.txt).
- **No execution** — never compile, validate-by-running, instantiate,
  or run any WebAssembly or arbitrary code. Validation and reduction
  rules are returned as *data*, never by *applying* them.
- **No auth, no secrets, no PII** — usable anonymously.
- **No network at request time** — all spec data is fetched and
  indexed at build time and baked in; the running server does pure
  local lookups.

If a proposed tool can't meet all five, it doesn't belong here. See
[`AGENTS.md`](AGENTS.md) for the full project rules.

## Project layout

| Path | What |
|---|---|
| `scripts/` | Fetch the pinned upstream repos + dump the structured instruction data (Python). |
| `src/parser/` | Turn upstream sources (RST, Bikeshed, Markdown, the macro table) into clean records. |
| `src/index/` | Build-time orchestrators that bake the JSON artifacts under `build/`. |
| `src/spec/` | Dependency-free query logic (shared by the stdio server and the Worker). |
| `src/mcp/` | The stdio MCP server + per-tool definitions; `tool_meta.ts` is the single source of truth. |
| `src/docs/` | Generates the dynamic docs pages from `tool_meta.ts` + the baked data. |
| `worker/` | The Cloudflare Worker (streamable-HTTP transport, bundles the baked JSON). |
| `docs/` | VitePress documentation site. |

## Development

```sh
npm ci
npm run fetch-spec        # clone the pinned upstream repos into vendor/
npm run build-spec        # bake build/*.json
npm run typecheck
npm test
npm run mcp               # run the stdio server locally (tsx)
npm run docs:dev          # preview the docs site
```

Worker:

```sh
cd worker && npm ci
npm test
npx wrangler dev          # local HTTP server (rebuilds docs assets first)
```

## Conventions

- TypeScript, strict mode. Zod for input schemas, with `.describe()`
  on every field.
- New tools are added to `src/mcp/tool_meta.ts` (the server and the
  docs `/tools` page both read it) and registered with
  `readOnlyHint: true`.
- Tests live next to source as `*.test.ts`; `vitest run` runs them.
- Bumping the pinned spec commit: edit `vendor/PINNED.txt`, then
  re-run `npm run fetch-spec && npm run build-spec && npm test`. The
  parser reports any dropped records so upstream changes surface.
- Commit messages and PR descriptions describe the change in general
  terms — they're part of the public surface.

## Releases

Releases are automated: a scheduled workflow SHA-diffs the upstream
repos and, when a pin moves, bumps the patch version and tags a
release that publishes to npm and redeploys the Worker. Code changes
land via PRs to `main`; data refreshes ride the patch track.
