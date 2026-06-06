#!/usr/bin/env node
// wasm-mcp — Model Context Protocol server for the WebAssembly core
// specification.
//
// Read-only, SHA-pinned, structured lookup. Runs as a stdio MCP
// server (for local Claude Code use). A hosted Cloudflare Worker
// deployment will reuse the same tool implementations behind a
// streamable-HTTP transport (see `worker/`).
//
// Every tool is registered from the shared TOOLS registry in
// ./tool_meta.ts — the same array the docs generator reads, so the
// server and its documentation can't drift.
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
import { TOOLS, setPackageInfo } from "./tool_meta.js";

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
setPackageInfo(PACKAGE);

const server = new McpServer(
  { name: PACKAGE.name, version: PACKAGE.version },
  { instructions: SERVER_INSTRUCTIONS },
);

for (const tool of TOOLS) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args: Record<string, unknown>) => {
      const result = tool.handler(args ?? {});
      if (result === null || result === undefined) {
        return {
          content: [{ type: "text", text: `No result for ${tool.name}. Try a search tool.` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
