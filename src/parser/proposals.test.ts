import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import {
  parseActiveProposals,
  parseFinishedProposals,
  parseAllProposals,
  type Proposal,
} from "./proposals.js";
import { listProposals } from "../spec/proposals_query.js";

function loadBaked(): Proposal[] {
  const snap = JSON.parse(
    readFileSync(resolve(BUILD_DIR, "wasm-proposals-main.json"), "utf8"),
  ) as { proposals: Proposal[] };
  return snap.proposals;
}

describe("proposal markdown parsing", () => {
  it("parses an active phase table with resolved URL", () => {
    const md = [
      "### Phase 4 - Standardize the Feature (WG)",
      "",
      "| Proposal | Champion |",
      "| -------- | -------- |",
      "| [Threads][threads] | Conrad Watt |",
      "",
      "[threads]: https://github.com/webassembly/threads",
    ].join("\n");
    const out = parseActiveProposals(md);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Threads",
      status: "phase-4",
      phase: 4,
      champion: "Conrad Watt",
      url: "https://github.com/webassembly/threads",
    });
  });

  it("parses finished proposals with affected specs + version", () => {
    const md = [
      "| Proposal | Champion | Meeting notes | Affected specs | Spec Version |",
      "| -------- | -------- | ------------- | -------------- | :----------: |",
      "| [Tail call][tail_call] | Andreas Rossberg | [WG][x] | core | 3.0 |",
      "",
      "[tail_call]: https://github.com/WebAssembly/tail-call",
    ].join("\n");
    const out = parseFinishedProposals(md);
    expect(out[0]).toMatchObject({
      name: "Tail call",
      status: "finished",
      affected_specs: ["core"],
      spec_version: "3.0",
    });
  });
});

describe("proposals (pinned build)", () => {
  const proposals = loadBaked();

  it("has a healthy mix of statuses", () => {
    expect(proposals.length).toBeGreaterThan(40);
    const statuses = new Set(proposals.map((p) => p.status));
    expect(statuses.has("finished")).toBe(true);
    expect(statuses.has("inactive")).toBe(true);
  });

  it("includes known finished 3.0 proposals", () => {
    const gc = proposals.find((p) => p.name === "Garbage collection");
    expect(gc?.status).toBe("finished");
    expect(gc?.spec_version).toBe("3.0");
    expect(gc?.affected_specs).toContain("core");
  });

  it("filters by status and affected spec", () => {
    const finishedCore = listProposals(proposals, { status: "finished", affects: "js-api" });
    expect(finishedCore.length).toBeGreaterThan(0);
    expect(finishedCore.every((p) => p.affected_specs.includes("js-api"))).toBe(true);
  });

  it("filters by phase and champion", () => {
    const byPhase = listProposals(proposals, { phase: 3 });
    expect(byPhase.every((p) => p.phase === 3)).toBe(true);
    const byChampion = listProposals(proposals, { champion: "rossberg" });
    expect(byChampion.length).toBeGreaterThan(0);
  });
});
