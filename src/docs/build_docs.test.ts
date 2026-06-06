import { describe, it, expect } from "vitest";
import { renderToolsPage, renderSnapshotsPage, rewriteRelativeLinks } from "./build_docs.js";
import { TOOLS } from "../mcp/tool_meta.js";

describe("renderToolsPage", () => {
  const md = renderToolsPage(TOOLS);

  it("documents every tool with a heading", () => {
    for (const t of TOOLS) {
      expect(md).toContain(`## ${t.name}`);
    }
  });

  it("renders the field table for a tool with params", () => {
    expect(md).toContain("| Field | Type | Required | Description |");
    expect(md).toContain("`mnemonic`");
  });

  it("marks defaulted args as not required and shows the default", () => {
    // The `version` arg defaults to `latest`, so it must not be required.
    const versionLine = md.split("\n").find((l) => l.includes("`version`"));
    expect(versionLine).toBeTruthy();
    expect(versionLine).toContain("default:");
    // The Required column for version is "no".
    expect(versionLine).toMatch(/\| no \|/);
  });

  it("includes examples for tools that have them", () => {
    expect(md).toContain("**Examples**");
    expect(md).toContain('{"mnemonic":"i32.add"}');
  });
});

describe("renderSnapshotsPage", () => {
  it("renders a placeholder when no snapshots exist", () => {
    expect(renderSnapshotsPage([])).toContain("Snapshot data not built yet");
  });

  it("renders a table row per snapshot", () => {
    const md = renderSnapshotsPage([
      {
        label: "core spec",
        repo: "WebAssembly/spec",
        sha: "a".repeat(40),
        short: "aaaaaaaaaa",
        bytes: 1024 * 1024,
        count: "497 instr",
      },
    ]);
    expect(md).toContain("core spec");
    expect(md).toContain("WebAssembly/spec/commit/" + "a".repeat(40));
    expect(md).toContain("1.0 MB");
  });
});

describe("rewriteRelativeLinks", () => {
  it("rewrites repo-relative links to GitHub blob URLs", () => {
    expect(rewriteRelativeLinks("see [pins](vendor/PINNED.txt)")).toBe(
      "see [pins](https://github.com/xyzzylabs/wasm-mcp/blob/main/vendor/PINNED.txt)",
    );
  });
  it("leaves absolute + anchor links alone", () => {
    const s = "[x](https://example.com) and [y](#frag) and [z](/abs)";
    expect(rewriteRelativeLinks(s)).toBe(s);
  });
});
