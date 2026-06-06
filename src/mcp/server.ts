#!/usr/bin/env node
// wasm-mcp — Model Context Protocol server for the WebAssembly core
// specification.
//
// Read-only, SHA-pinned, structured lookup. Runs as a stdio MCP
// server (for local Claude Code use). A hosted Cloudflare Worker
// deployment will reuse the same tool implementations behind a
// streamable-HTTP transport (see `worker/`).
//
// Wire into Claude Code by adding to your project's `.mcp.json`:
//
//   {
//     "mcpServers": {
//       "wasm": {
//         "type": "stdio",
//         "command": "npx",
//         "args": ["wasm-mcp"]
//       }
//     }
//   }

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { specVersion, specVersionSchema } from "./tools/spec_version.js";

function readPackageInfo(): { name: string; version: string } {
  try {
    const req = createRequire(import.meta.url);
    const path = req.resolve("../../package.json");
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { name?: string; version?: string };
    return { name: pkg.name ?? "wasm-mcp", version: pkg.version ?? "unknown" };
  } catch {
    return { name: "wasm-mcp", version: "unknown" };
  }
}
const PACKAGE = readPackageInfo();

const server = new McpServer(
  { name: PACKAGE.name, version: PACKAGE.version },
  { instructions: SERVER_INSTRUCTIONS },
);

server.registerTool(
  "spec_version",
  {
    title: "Pinned spec version",
    description:
      "Return self-description of this MCP server: package name + version, plus the pinned upstream commit SHA for every spec snapshot baked into the package. Use this first when citing the spec, or to verify the server's freshness and reproducibility.",
    inputSchema: specVersionSchema,
    annotations: { readOnlyHint: true },
  },
  async () => {
    const r = specVersion(PACKAGE);
    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
