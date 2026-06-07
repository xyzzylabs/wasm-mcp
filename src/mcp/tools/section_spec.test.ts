import { describe, it, expect } from "vitest";
import { sectionGet } from "./section_get.js";
import { sectionList } from "./section_list.js";
import { specSearch } from "./spec_search.js";

// Multi-spec coverage: section_get / section_list / spec_search route
// to core / js-api / web-api via the `spec` argument.

describe("section tools span core / js-api / web-api", () => {
  it("section_get defaults to core", () => {
    expect(sectionGet({ id: "syntax-numtype" })?.title).toBe("Number Types");
  });

  it("section_get reads js-api when spec=js-api", () => {
    const c = sectionGet({ id: "memories", spec: "js-api" });
    expect(c).not.toBeNull();
    expect(c!.path).toBe("js-api");
    expect(c!.url).toContain("/js-api/#memories");
  });

  it("section_get reads web-api when spec=web-api", () => {
    const c = sectionGet({ id: "streaming-modules", spec: "web-api" });
    expect(c?.path).toBe("web-api");
  });

  it("a core anchor is absent from js-api", () => {
    expect(sectionGet({ id: "syntax-numtype", spec: "js-api" })).toBeNull();
  });

  it("section_list scopes to the chosen spec", () => {
    const js = sectionList({ spec: "js-api" });
    expect(js.count).toBeGreaterThan(10);
    expect(js.sections.every((s) => s.path === "js-api")).toBe(true);
  });

  it("spec_search finds js-api content", () => {
    const r = specSearch({ query: "instantiate", spec: "js-api" });
    expect(r.count).toBeGreaterThan(0);
  });
});
