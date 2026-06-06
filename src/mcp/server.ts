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
import { instructionGet, instructionGetSchema } from "./tools/instruction_get.js";
import { instructionList, instructionListSchema } from "./tools/instruction_list.js";
import { instructionSearch, instructionSearchSchema } from "./tools/instruction_search.js";

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

server.registerTool(
  "instruction_get",
  {
    title: "Get instruction",
    description:
      "Fetch one WebAssembly instruction by mnemonic (`i32.add`, `br_if`) or binary opcode (`0x6a`, `0xfd 0x89 0x02`) as structured JSON: opcode bytes, category, introducing version, stack type signature, and validation/execution prose anchors + spec URLs. Provide `mnemonic` or `opcode` (mnemonic wins if both match).",
    inputSchema: instructionGetSchema,
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const r = instructionGet(args);
    if (!r) {
      return {
        content: [
          {
            type: "text",
            text: `No instruction matched (mnemonic: ${args.mnemonic ?? "—"}, opcode: ${args.opcode ?? "—"}). Try instruction_search.`,
          },
        ],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
  },
);

server.registerTool(
  "instruction_list",
  {
    title: "List instructions",
    description:
      "Enumerate WebAssembly instructions with optional filters: `category` (control, numeric, parametric, variable, table, memory, ref, i31, struct, array, extern, vec), `introduced_in` (1.0 | 2.0 | 3.0), and `prefix` (mnemonic prefix like `i32.`). Returns lightweight rows sorted by opcode; follow up with instruction_get for full detail.",
    inputSchema: instructionListSchema,
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const r = instructionList(args);
    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
  },
);

server.registerTool(
  "instruction_search",
  {
    title: "Search instructions",
    description:
      "Search WebAssembly instructions by free-text query, matched against mnemonic (exact > substring), category name, and opcode hex. The entry point when you don't know the exact mnemonic. Returns ranked lightweight hits with a `matched_on` field; follow up with instruction_get.",
    inputSchema: instructionSearchSchema,
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const r = instructionSearch(args);
    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
