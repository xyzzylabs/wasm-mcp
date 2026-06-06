// Cloudflare Worker entry point for the hosted wasm-mcp server.
//
// Speaks MCP's JSON-RPC over HTTP (POST /mcp). Each request is a
// single JSON-RPC envelope (or a batch array); we route `initialize`,
// `tools/list`, and `tools/call` to native handlers and dispatch tool
// calls through the shared registry in ./registry.ts.
//
// We don't use the official @modelcontextprotocol/sdk transport: its
// StreamableHTTPServerTransport assumes stateful Node sessions, while
// a stateless Worker treats each request as its own session. A
// minimal handler is smaller and simpler.
//
// All spec data is bundled into the Worker (see ./data.ts), so the
// running Worker performs no network or storage I/O — the same
// read-only / deterministic / no-network-at-request-time contract as
// the stdio package.

import { TOOL_REGISTRY } from "./registry.js";
import { PRIVACY_HTML } from "./privacy.js";
import { SERVER_INSTRUCTIONS } from "../../src/mcp/instructions.js";
import { SPEC, PROPOSALS } from "./data.js";
import rootPkg from "../../package.json";

const SERVER_VERSION = (rootPkg as { version?: string }).version ?? "unknown";
const SERVER_NAME = "wasm-mcp";

export interface Env {
  // Cloudflare's built-in per-Worker rate limiter (unsafe binding).
  // Optional so unit tests and local dev without the binding still run.
  RATE_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
  // Static-assets binding (the bundled landing page under public/).
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id",
};

export function dispatch(req: JsonRpcRequest): JsonRpcResponse {
  const id = req.id ?? null;
  try {
    switch (req.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            instructions: SERVER_INSTRUCTIONS,
          },
        };
      case "notifications/initialized":
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: TOOL_REGISTRY.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              annotations: { readOnlyHint: true },
            })),
          },
        };
      case "tools/call": {
        const p = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        const tool = TOOL_REGISTRY.find((t) => t.name === p.name);
        if (!tool) {
          return { jsonrpc: "2.0", id, error: { code: -32601, message: `No such tool: ${p.name}` } };
        }
        const result = tool.handler(p.arguments ?? {});
        if (result === null || result === undefined) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `No result for ${p.name}.` }],
              isError: true,
            },
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
        };
      }
      default:
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${req.method}` } };
    }
  } catch (e) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: e instanceof Error ? e.message : String(e) },
    };
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health probe.
    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({
        status: "ok",
        name: SERVER_NAME,
        version: SERVER_VERSION,
        spec_sha: SPEC.pin.sha,
        proposals_sha: PROPOSALS.pin.sha,
        tools: TOOL_REGISTRY.length,
      });
    }

    // Privacy statement (matches the hosted-endpoint posture).
    if (url.pathname === "/privacy" && request.method === "GET") {
      return new Response(PRIVACY_HTML, {
        headers: { "content-type": "text/html; charset=utf-8", ...corsHeaders },
      });
    }

    // Anything that isn't /mcp falls through to the bundled landing
    // page (Workers Assets), or a JSON identity if no ASSETS binding.
    if (url.pathname !== "/mcp") {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return jsonResponse(
        {
          name: SERVER_NAME,
          version: SERVER_VERSION,
          mcp_endpoint: `${url.origin}/mcp`,
          privacy: `${url.origin}/privacy`,
          docs: "https://github.com/xyzzylabs/wasm-mcp",
        },
        url.pathname === "/" ? 200 : 404,
      );
    }

    if (request.method !== "POST") {
      return new Response("Use POST /mcp for MCP protocol traffic.", {
        status: 405,
        headers: corsHeaders,
      });
    }

    // Per-IP rate limit: 30 req / 60 s (see wrangler.toml).
    if (env.RATE_LIMITER) {
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32000, message: "Rate limit exceeded. Try again in a minute." },
          }),
          { status: 429, headers: { "content-type": "application/json", "retry-after": "60", ...corsHeaders } },
        );
      }
    }

    let body: JsonRpcRequest | JsonRpcRequest[];
    try {
      body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
    } catch (e) {
      return jsonResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: " + (e instanceof Error ? e.message : String(e)) },
      });
    }

    const response = Array.isArray(body) ? body.map(dispatch) : dispatch(body);
    return jsonResponse(response);
  },
};
