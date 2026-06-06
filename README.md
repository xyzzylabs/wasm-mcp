# wasm-mcp

Unofficial Model Context Protocol server for the
[WebAssembly core specification](https://webassembly.github.io/spec/core/).
SHA-pinned, read-only, deterministic — safe to host as a public
unauthenticated endpoint.

> Not affiliated with, endorsed by, or sponsored by the W3C
> WebAssembly Community Group or Working Group.

## What it gives you

- `spec_version` — the pinned upstream commit + when it was indexed.

More tools land in subsequent releases:

- `instruction_get` — opcode, immediates, stack signature, validation
  + execution prose anchors, by mnemonic (`i32.add`) or binary opcode.
- `instruction_list` / `instruction_search` — enumerate / search,
  filterable by category (numeric, vector, reference, parametric,
  variable, table, memory, control).
- `type_get` — value, vector, reference, function types, limits.
- `section_get` / `clause_get` — spec section by id / anchor
  (structure, validation, execution, binary, text).
- `spec_search` — full-text search with stable anchors.
- `proposal_list` — WebAssembly proposals + phases (optional).

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

The Cloudflare Worker deployment (when live) exposes the same tool
surface as the stdio package over streamable HTTP at a single
unauthenticated `/mcp` endpoint, rate-limited per source IP. See
[`worker/`](worker/) once it lands.

## License

MIT — see [`LICENSE`](LICENSE).
