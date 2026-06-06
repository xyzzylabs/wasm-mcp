import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { getType, type TypeEntry } from "./types.js";

function loadTypes(): TypeEntry[] {
  const snap = JSON.parse(
    readFileSync(resolve(BUILD_DIR, "wasm-spec-core-main.json"), "utf8"),
  ) as { types: TypeEntry[] };
  return snap.types;
}

const catalog = loadTypes();

describe("type catalog (pinned build)", () => {
  it("has a reasonable number of entries", () => {
    expect(catalog.length).toBeGreaterThan(20);
  });

  it("classifies i32 as a number type with siblings", () => {
    const t = getType(catalog, "i32")!;
    expect(t.kind).toBe("number");
    expect(t.members).toEqual(expect.arrayContaining(["i64", "f32", "f64"]));
    expect(t.members).not.toContain("i32");
    expect(t.url).toContain("#syntax-numtype");
    expect(t.prose.length).toBeGreaterThan(0);
  });

  it("classifies v128 as a vector type", () => {
    expect(getType(catalog, "v128")!.kind).toBe("vector");
  });

  it("classifies funcref as a reference type", () => {
    const t = getType(catalog, "funcref")!;
    expect(t.kind).toBe("reference");
    expect(t.members).toContain("externref");
  });

  it("exposes functype and limits as type forms", () => {
    expect(getType(catalog, "functype")!.kind).toBe("form");
    expect(getType(catalog, "limits")!.kind).toBe("form");
  });

  it("is case-insensitive and returns null for unknown", () => {
    expect(getType(catalog, "I32")!.name).toBe("i32");
    expect(getType(catalog, "nope")).toBeNull();
  });
});
