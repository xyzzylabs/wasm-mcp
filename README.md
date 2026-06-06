# wasm-mcp

Unofficial Model Context Protocol server for the
[WebAssembly core specification](https://webassembly.github.io/spec/core/).
SHA-pinned, read-only, deterministic — safe to host as a public
unauthenticated endpoint.

> Not affiliated with, endorsed by, or sponsored by the W3C
> WebAssembly Community Group or Working Group.

## What it gives you

- `spec_version` — the pinned upstream commit and package version.
- `instruction_get` — opcode bytes, category, introducing version,
  stack type signature, and validation + execution prose anchors /
  URLs, by mnemonic (`i32.add`) or binary opcode (`0x6a`).
- `instruction_list` — enumerate, filterable by category (numeric,
  vector, reference, parametric, variable, table, memory, control,
  ref, i31, struct, array, extern), introducing version, or prefix.
- `instruction_search` — ranked free-text search across mnemonics,
  categories, and opcodes.
- `type_get` — value types (number / vector / reference) and type
  forms (`functype`, `limits`, `memtype`, …) with defining prose.
- `section_get` — one spec clause by id / anchor (structure,
  validation, execution, binary, text), with prose, cross-references,
  SpecTec formal-rule references, and the rendered URL.
- `section_list` — navigate the clause tree by area or anchor prefix.
- `spec_search` — full-text search across anchors, titles, and prose.
- `proposal_list` — WebAssembly proposals and their phases (from the
  pinned `WebAssembly/proposals` repo), filterable by status, phase,
  champion, or affected spec.

Planned for a later release:

- `js-api` / `web-api` coverage via the same section/search tools.

## Contract

Every tool is:

- **Read-only.** No state mutation, no writes outside an optional
  local cache.
- **Deterministic.** Same input → same output, over the pinned spec
  commit recorded in [`vendor/PINNED.txt`](vendor/PINNED.txt).
- **No execution.** Never compiles, validates-by-running,
  instantiates, or runs any WebAssembly or arbitrary code. Validation
  and reduction rules are returned as data.
- **No auth, no secrets, no PII.** Usable anonymously.
- **No network at request time.** All spec data is fetched and
  indexed at build time and baked into the package.

## Install (stdio, local)

```bash
npx wasm-mcp
```

Wire into Claude Code by adding to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "wasm": {
      "type": "stdio",
      "command": "npx",
      "args": ["wasm-mcp"]
    }
  }
}
```

## Hosted Worker

The Cloudflare Worker in [`worker/`](worker/) exposes the same tool
surface as the stdio package over streamable HTTP at a single
unauthenticated endpoint, rate-limited per source IP (30 req / 60 s):

```
https://wasm-mcp.chicoxyzzy.workers.dev/mcp
```

`GET /health` reports status and the pinned SHAs; `GET /privacy`
states the anonymous, no-storage posture. All spec data is bundled
into the Worker, so it does pure in-memory lookups — no storage, no
network at request time.

## Releases & data refresh

The pinned commits live in [`vendor/PINNED.txt`](vendor/PINNED.txt)
and are reported by `spec_version`. A scheduled GitHub Actions
workflow ([`refresh.yml`](.github/workflows/refresh.yml)) SHA-diffs
the upstream repos daily; when a pin moves it re-pins, bumps the patch
version, and tags a release, which publishes the npm package
([`release.yml`](.github/workflows/release.yml)) and redeploys the
Worker ([`deploy-worker.yml`](.github/workflows/deploy-worker.yml)).

Maintainers: these workflows need the repository secrets `NPM_TOKEN`
(release) and `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
(deploy).

## License

MIT — see [`LICENSE`](LICENSE).
