// Static /privacy response. The hosted endpoint is anonymous and
// stateless: no accounts, no cookies, no request bodies stored. This
// page states that posture plainly so the deployment can run as an
// unauthenticated public service.

export const PRIVACY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>wasm-mcp — Privacy</title>
<style>
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.5rem; } code { background: #f2f2f2; padding: 0 .25em; border-radius: 3px; }
  a { color: #5546ff; }
</style>
</head>
<body>
<h1>wasm-mcp — Privacy</h1>
<p>wasm-mcp is an unofficial, read-only Model Context Protocol server
over the WebAssembly specification. It is not affiliated with the W3C
WebAssembly Community Group or Working Group.</p>

<h2>What we collect</h2>
<p>Nothing personal. The service requires no account, no API key, and
sets no cookies. Requests are anonymous.</p>

<h2>What the server does</h2>
<p>Every tool is a pure local lookup over spec data baked into the
deployment at build time. The server performs no outbound network
requests while handling a request, stores no request bodies, and
writes nothing to disk.</p>

<h2>Operational data</h2>
<p>To protect the service from abuse it applies per-IP rate limiting,
and the hosting platform (Cloudflare) processes connection metadata
(such as IP address) transiently for that purpose and for standard
request logging. We do not build profiles, set tracking identifiers,
or sell data. See Cloudflare's privacy documentation for how the
platform handles network metadata.</p>

<h2>Contact</h2>
<p>Source and issues:
<a href="https://github.com/xyzzylabs/wasm-mcp">github.com/xyzzylabs/wasm-mcp</a>.</p>
</body>
</html>
`;
