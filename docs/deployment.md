# Hosting (Cloudflare Worker)

The hosted endpoint is a Cloudflare Worker that speaks MCP's JSON-RPC
over HTTP. It exposes the same 9 tools as the stdio package.

```
https://wasm-mcp.chicoxyzzy.workers.dev/mcp
```

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/mcp` | POST | MCP JSON-RPC (single or batch) |
| `/health` | GET | Status + pinned SHAs + tool count |
| `/privacy` | GET | Privacy statement |
| `/` | GET | Landing page |

## How it's built

The Worker **bundles the baked JSON directly** (`worker/src/data.ts`
imports `build/*.json`). The whole dataset is ~0.8 MB, which esbuild
inlines into a ~224 KiB gzipped bundle — comfortably within the
free-tier limit. So the running Worker does pure in-memory lookups:
no R2, no KV, no storage binding, no network at request time.

The tool registry ([`worker/src/registry.ts`](https://github.com/xyzzylabs/wasm-mcp/blob/main/worker/src/registry.ts))
calls the same shared query functions as the stdio server, so the two
transports rank and filter identically.

## Rate limiting & privacy

Requests are IP-bucketed at **30 / 60 s** via Cloudflare's `ratelimit`
binding — generous for any human or agent workflow, tight enough to
blunt scrapers. Since all data is bundled, this cap is purely abuse
protection.

The service is anonymous: no accounts, no cookies, no stored request
bodies. See the [Privacy Policy](/privacy).

## Deploy your own

```sh
cd worker
npm ci
# (from repo root, first) npm run fetch-spec && npm run build-spec
npx wrangler deploy
```

`wrangler.toml` declares the assets binding, the rate-limiter, and
observability. You'll need a Cloudflare account; `wrangler` prompts to
log in on first use.

## Auto-refresh

A scheduled GitHub Actions workflow
([`refresh.yml`](https://github.com/xyzzylabs/wasm-mcp/blob/main/.github/workflows/refresh.yml))
SHA-diffs the upstream `WebAssembly/spec` and `WebAssembly/proposals`
repos daily. When a pin has moved it re-pins, bumps the patch version,
and pushes a `v*` tag — which triggers the release workflow (npm
publish) and the deploy workflow (`wrangler deploy`), regenerating
this docs site along the way.

So the latency from an upstream merge to refreshed data on the hosted
endpoint and on npm is typically one refresh cycle.

## MCP Registry

Each release also publishes the server manifest
([`server.json`](https://github.com/xyzzylabs/wasm-mcp/blob/main/server.json))
to the [MCP Registry](https://registry.modelcontextprotocol.io) under
`io.github.xyzzylabs/wasm-mcp`, so the server is discoverable from MCP
client directories. Authentication is OIDC (GitHub Actions identity) —
no token; the npm package's `mcpName` field proves ownership.
