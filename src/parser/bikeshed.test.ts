import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { parseBikeshed } from "./bikeshed.js";
import type { SpecClause } from "./sections.js";

describe("parseBikeshed (unit)", () => {
  const src = [
    "<pre class=metadata>Title: X</pre>",
    '<h2 id="intro">Introduction</h2>',
    "By design, the [=scope=] of [[WEBASSEMBLY]] is narrow.",
    "The {{Module}} interface and |value| are defined.",
    "```js",
    "code block dropped",
    "```",
    '<h3 id="modules">Modules</h3>',
    "<p>A module record.</p>",
  ].join("\n");

  const clauses = parseBikeshed(src, "js-api");

  it("extracts headings with ids, titles, levels", () => {
    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toMatchObject({ id: "intro", title: "Introduction", level: 2, path: "js-api" });
    expect(clauses[1]).toMatchObject({ id: "modules", title: "Modules", level: 3 });
  });

  it("cleans Bikeshed shorthands and drops code blocks", () => {
    const intro = clauses[0]!;
    expect(intro.prose).toContain("scope");
    expect(intro.prose).toContain("WEBASSEMBLY");
    expect(intro.prose).toContain("Module");
    expect(intro.prose).toContain("value"); // |value| → value
    expect(intro.prose).not.toContain("code block dropped");
    expect(intro.crossrefs).toEqual(expect.arrayContaining(["scope", "Module"]));
  });

  it("builds rendered URLs under the spec slug", () => {
    expect(clauses[1]!.url).toBe("https://webassembly.github.io/spec/js-api/#modules");
  });
});

describe("js-api / web-api section artifacts (pinned build)", () => {
  function load(spec: string): SpecClause[] {
    return (
      JSON.parse(
        readFileSync(resolve(BUILD_DIR, `wasm-sections-${spec}-main.json`), "utf8"),
      ) as { sections: SpecClause[] }
    ).sections;
  }

  it("js-api has the core embedding sections", () => {
    const ids = new Set(load("js-api").map((c) => c.id));
    for (const id of ["modules", "instances", "memories", "tables", "globals"]) {
      expect(ids.has(id), `missing js-api #${id}`).toBe(true);
    }
  });

  it("web-api has streaming compilation", () => {
    const ids = new Set(load("web-api").map((c) => c.id));
    expect(ids.has("streaming-modules")).toBe(true);
  });
});
