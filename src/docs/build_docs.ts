// Build-time generator for the dynamic docs pages:
//
//   - docs/tools.md      — the full tool reference, rendered from the
//                          shared TOOLS registry (src/mcp/tool_meta.ts):
//                          each tool's description, input-field table
//                          (via Zod → JSON Schema), and usage examples.
//   - docs/snapshots.md  — the pinned upstream commits + index sizes,
//                          read from the baked build/*.json artifacts.
//   - docs/changelog.md  — a verbatim copy of the repo-root CHANGELOG
//                          so VitePress can route it.
//
// All three are gitignored build artifacts EXCEPT docs/tools.md, which
// is tracked so a fresh clone / GitHub browse shows the full reference
// without a build step (matching tc39-mcp).
//
// Run via `npm run docs:data` (chained by docs:dev / docs:build).

import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { REPO_ROOT, BUILD_DIR } from "../paths.js";
import { TOOLS, type ToolMeta } from "../mcp/tool_meta.js";

const DOCS_DIR = resolve(REPO_ROOT, "docs");

// ─── tools.md ───────────────────────────────────────────────────────

interface JsonSchemaProp {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

function fieldType(prop: JsonSchemaProp): string {
  if (prop.enum) return prop.enum.map((v) => `\`${String(v)}\``).join(" \\| ");
  if (prop.type === "integer") return "number";
  return prop.type ?? "any";
}

function renderToolFields(tool: ToolMeta): string {
  const schema = z.toJSONSchema(z.object(tool.inputSchema)) as {
    properties?: Record<string, JsonSchemaProp>;
    required?: string[];
  };
  const props = schema.properties ?? {};
  const keys = Object.keys(props);
  if (keys.length === 0) return "_No parameters._\n";

  const required = new Set(schema.required ?? []);
  let md = "| Field | Type | Required | Description |\n|---|---|---|---|\n";
  for (const key of keys) {
    const p = props[key]!;
    // A field with a default is optional from the caller's view, even
    // if Zod lists it in `required`.
    const hasDefault = p.default !== undefined;
    const req = required.has(key) && !hasDefault ? "yes" : "no";
    let desc = (p.description ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    if (hasDefault) desc += ` _(default: \`${String(p.default)}\`)_`;
    md += `| \`${key}\` | ${fieldType(p)} | ${req} | ${desc.trim()} |\n`;
  }
  return md;
}

function renderToolExamples(tool: ToolMeta): string {
  if (tool.examples.length === 0) return "";
  let md = "\n**Examples**\n\n";
  for (const ex of tool.examples) {
    md += `- ${ex.q}\n`;
    md += "  ```json\n";
    md += `  ${JSON.stringify(ex.input)}\n`;
    md += "  ```\n";
    if (ex.note) md += `  ${ex.note}\n`;
  }
  return md;
}

export function renderToolsPage(tools: ToolMeta[]): string {
  let md = `# Tool reference

This page is generated from the server's tool definitions
([\`src/mcp/tool_meta.ts\`](https://github.com/xyzzylabs/wasm-mcp/blob/main/src/mcp/tool_meta.ts))
— the same source the running server registers, so it never drifts.

All ${tools.length} tools are **read-only** (\`readOnlyHint: true\`),
deterministic over the pinned spec commit, and perform no execution
or network I/O.

`;
  for (const tool of tools) {
    md += `## ${tool.name}\n\n`;
    md += `${tool.description}\n\n`;
    md += `**Title:** ${tool.title}\n\n`;
    md += renderToolFields(tool);
    md += renderToolExamples(tool);
    md += "\n";
  }
  return md;
}

// ─── snapshots.md ───────────────────────────────────────────────────

interface PinHeader {
  pin?: { key?: string; sha?: string; version?: string };
}

interface SnapshotRow {
  label: string;
  repo: string;
  sha: string;
  short: string;
  bytes: number;
  count: string;
}

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

export function readSnapshots(buildDir: string): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  const specFile = resolve(buildDir, "wasm-spec-core-main.json");
  if (existsSync(specFile)) {
    const parsed = JSON.parse(readFileSync(specFile, "utf8")) as PinHeader & {
      instructions?: unknown[];
      sections?: unknown[];
      types?: unknown[];
    };
    rows.push({
      label: "core spec",
      repo: "WebAssembly/spec",
      sha: parsed.pin?.sha ?? "—",
      short: (parsed.pin?.sha ?? "").slice(0, 10),
      bytes: statSync(specFile).size,
      count: `${parsed.instructions?.length ?? 0} instr · ${parsed.sections?.length ?? 0} sections · ${parsed.types?.length ?? 0} types`,
    });
  }
  const propFile = resolve(buildDir, "wasm-proposals-main.json");
  if (existsSync(propFile)) {
    const parsed = JSON.parse(readFileSync(propFile, "utf8")) as PinHeader & {
      proposals?: unknown[];
    };
    rows.push({
      label: "proposals",
      repo: "WebAssembly/proposals",
      sha: parsed.pin?.sha ?? "—",
      short: (parsed.pin?.sha ?? "").slice(0, 10),
      bytes: statSync(propFile).size,
      count: `${parsed.proposals?.length ?? 0} proposals`,
    });
  }
  return rows;
}

const SNAPSHOTS_PLACEHOLDER = `# Snapshots

::: warning Snapshot data not built yet
Run \`npm run fetch-spec && npm run build-spec\`, then re-run
\`npm run docs:data\`. The published site is generated by CI, which
always populates this page from a fresh build.
:::
`;

export function renderSnapshotsPage(rows: SnapshotRow[]): string {
  if (rows.length === 0) return SNAPSHOTS_PLACEHOLDER;
  let md = `# Snapshots

Every response is deterministic over these SHA-pinned upstream
commits. The same pins are queryable at runtime via
[\`spec_version\`](/tools#spec-version).

| Source | Repo | Commit | Indexed | Size |
|---|---|---|---|---|
`;
  for (const r of rows) {
    const shaCell = `[\`${r.short}\`](https://github.com/${r.repo}/commit/${r.sha})`;
    md += `| ${r.label} | ${r.repo} | ${shaCell} | ${r.count} | ${fmtBytes(r.bytes)} |\n`;
  }
  md += `
## How this stays current

A scheduled GitHub Actions workflow SHA-diffs the upstream repos
daily. When a pin moves it re-pins, bumps the patch version, and tags
a release — which republishes the npm package and redeploys the
hosted Worker, regenerating this page. See
[Deployment](/deployment).
`;
  return md;
}

// ─── changelog.md ───────────────────────────────────────────────────

export function rewriteRelativeLinks(md: string): string {
  return md.replace(
    /\]\(((?!https?:\/\/|#|\/|mailto:)[^)\s]+)\)/g,
    "](https://github.com/xyzzylabs/wasm-mcp/blob/main/$1)",
  );
}

export function copyChangelog(rootDir: string, docsDir: string): boolean {
  const src = resolve(rootDir, "CHANGELOG.md");
  if (!existsSync(src)) return false;
  writeFileSync(resolve(docsDir, "changelog.md"), rewriteRelativeLinks(readFileSync(src, "utf8")));
  return true;
}

// ─── driver ─────────────────────────────────────────────────────────

export function buildDocsData(rootDir: string): void {
  writeFileSync(resolve(DOCS_DIR, "tools.md"), renderToolsPage(TOOLS));
  writeFileSync(resolve(DOCS_DIR, "snapshots.md"), renderSnapshotsPage(readSnapshots(BUILD_DIR)));
  copyChangelog(rootDir, DOCS_DIR);
}

const entry = process.argv[1];
if (entry && (entry.endsWith("/build_docs.ts") || entry.endsWith("/build_docs.js"))) {
  buildDocsData(REPO_ROOT);
  console.log("✓ docs data generated (tools.md, snapshots.md, changelog.md)");
}
