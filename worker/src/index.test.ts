import { describe, it, expect } from "vitest";
import worker, { dispatch, type Env } from "./index.js";
import { TOOL_REGISTRY } from "./registry.js";
import { HOSTED_TOOLS } from "../../src/spec/tool_inventory.js";

const env: Env = {};

function rpc(method: string, params?: unknown, id: number | string = 1) {
  return new Request("https://example.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

describe("tool surface parity", () => {
  it("worker registry matches the declared hosted tool set", () => {
    const registryNames = new Set(TOOL_REGISTRY.map((t) => t.name));
    const hosted = new Set<string>(HOSTED_TOOLS);
    expect(registryNames).toEqual(hosted);
  });

  it("every tool has a non-empty description and object schema", () => {
    for (const t of TOOL_REGISTRY) {
      expect(t.description.length).toBeGreaterThan(10);
      expect((t.inputSchema as { type?: string }).type).toBe("object");
    }
  });
});

describe("dispatch", () => {
  it("initialize returns server info + instructions", () => {
    const r = dispatch({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect((r.result as { serverInfo: { name: string } }).serverInfo.name).toBe("wasm-mcp");
    expect((r.result as { instructions: string }).instructions).toContain("wasm-mcp");
  });

  it("tools/list returns all hosted tools", () => {
    const r = dispatch({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = (r.result as { tools: { name: string }[] }).tools;
    expect(tools).toHaveLength(HOSTED_TOOLS.length);
  });

  it("tools/call instruction_get resolves i32.add", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "instruction_get", arguments: { mnemonic: "i32.add" } },
    });
    const text = (r.result as { content: { text: string }[] }).content[0]!.text;
    expect(JSON.parse(text).opcodes).toEqual([0x6a]);
  });

  it("tools/call type_get resolves funcref", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "type_get", arguments: { name: "funcref" } },
    });
    const text = (r.result as { content: { text: string }[] }).content[0]!.text;
    expect(JSON.parse(text).kind).toBe("reference");
  });

  it("tools/call section_get routes to js-api when spec=js-api", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "section_get", arguments: { id: "memories", spec: "js-api" } },
    });
    const text = (r.result as { content: { text: string }[] }).content[0]!.text;
    expect(JSON.parse(text).path).toBe("js-api");
  });

  it("tools/call spec_search finds block types", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "spec_search", arguments: { query: "block type" } },
    });
    const text = (r.result as { content: { text: string }[] }).content[0]!.text;
    expect(JSON.parse(text).count).toBeGreaterThan(0);
  });

  it("tools/call proposal_list filters finished proposals", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "proposal_list", arguments: { status: "finished" } },
    });
    const text = (r.result as { content: { text: string }[] }).content[0]!.text;
    expect(JSON.parse(text).count).toBeGreaterThan(0);
  });

  it("unknown tool returns an error", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "nope", arguments: {} },
    });
    expect(r.error?.code).toBe(-32601);
  });

  it("instruction_get with no selector returns an isError result", () => {
    const r = dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "instruction_get", arguments: {} },
    });
    expect((r.result as { isError?: boolean }).isError).toBe(true);
  });
});

describe("fetch routing", () => {
  it("GET /health reports ok + pins", async () => {
    const res = await worker.fetch(new Request("https://example.com/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; spec_sha: string; tools: number };
    expect(body.status).toBe("ok");
    expect(body.spec_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(body.tools).toBe(HOSTED_TOOLS.length);
  });

  it("GET /privacy returns HTML", async () => {
    const res = await worker.fetch(new Request("https://example.com/privacy"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Privacy");
  });

  it("GET / returns JSON identity when no ASSETS binding", async () => {
    const res = await worker.fetch(new Request("https://example.com/"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; mcp_endpoint: string };
    expect(body.name).toBe("wasm-mcp");
    expect(body.mcp_endpoint).toBe("https://example.com/mcp");
  });

  it("POST /mcp dispatches a tools/call", async () => {
    const res = await worker.fetch(
      rpc("tools/call", { name: "spec_version", arguments: {} }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { content: { text: string }[] } };
    expect(JSON.parse(body.result.content[0]!.text).spec.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("GET /mcp is 405", async () => {
    const res = await worker.fetch(new Request("https://example.com/mcp"), env);
    expect(res.status).toBe(405);
  });

  it("OPTIONS returns CORS preflight", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/mcp", { method: "OPTIONS" }),
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("enforces the rate limiter when present", async () => {
    const limitedEnv: Env = { RATE_LIMITER: { limit: async () => ({ success: false }) } };
    const res = await worker.fetch(rpc("tools/list"), limitedEnv);
    expect(res.status).toBe(429);
  });
});
