# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/xyzzylabs/wasm-mcp/security/advisories/new)
rather than opening a public issue. We'll acknowledge within a few
days and keep you updated on a fix.

## Threat model

wasm-mcp is intentionally small and low-risk by construction:

- **No code execution.** No tool compiles, validates-by-running,
  instantiates, or otherwise runs any WebAssembly or arbitrary code.
  Spec rules are returned as data, never applied.
- **No network at request time.** All spec data is fetched and
  indexed at build time and baked into the package / Worker bundle.
  The running server makes no outbound requests while handling a
  request.
- **No state, no auth, no secrets, no PII.** The service is anonymous
  and stateless: no accounts, no cookies, no stored request bodies.
- **Read-only.** No tool writes outside an optional local cache.

### Hosted endpoint

The hosted Cloudflare Worker is unauthenticated by design. It applies
per-IP rate limiting (30 requests / 60 s) as abuse protection; the
hosting platform processes connection metadata (e.g. IP address)
transiently for that purpose and for standard request logging. See
the [Privacy Policy](docs/privacy.md).

## Supported versions

Only the latest published version is supported. Spec-data refreshes
ship as patch releases; security fixes target the latest release.

## Supply chain

- The runtime package depends only on `@modelcontextprotocol/sdk` and
  `zod`.
- Spec data is pinned to specific upstream commits
  ([`vendor/PINNED.txt`](vendor/PINNED.txt)) and regenerated in CI;
  the npm package ships with provenance attestation.
- GitHub Actions workflows declare minimal permissions and never
  interpolate untrusted input into shell steps.
