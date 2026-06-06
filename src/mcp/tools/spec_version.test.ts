import { describe, it, expect } from "vitest";
import { specVersion, SpecVersionResultSchema } from "./spec_version.js";

describe("spec_version", () => {
  it("returns name, version, and at least one pin", () => {
    const r = specVersion({ name: "wasm-mcp", version: "0.1.0" });
    expect(r.name).toBe("wasm-mcp");
    expect(r.version).toBe("0.1.0");
    expect(r.pins.length).toBeGreaterThan(0);
  });

  it("includes spec/main from vendor/PINNED.txt", () => {
    const r = specVersion({ name: "wasm-mcp", version: "0.0.0" });
    const main = r.pins.find((p) => p.key === "spec/main");
    expect(main).toBeDefined();
    // 40-char hex SHA.
    expect(main!.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("matches its declared output schema", () => {
    const r = specVersion({ name: "wasm-mcp", version: "0.1.0" });
    expect(() => SpecVersionResultSchema.parse(r)).not.toThrow();
  });
});
