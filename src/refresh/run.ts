// Refresh runner. Resolves the live HEAD SHA of each pinned upstream
// branch via `git ls-remote` (no auth, public repos), compares with
// the baked pins, and — when something moved — rewrites
// vendor/PINNED.txt and .last-refresh.json and bumps the package
// patch version.
//
// Designed to run in CI on a schedule. It emits machine-readable
// outputs to $GITHUB_OUTPUT so the workflow can decide whether to
// commit + tag a release. Run with `--apply` to write changes;
// without it, the script only reports (dry run).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, VENDOR_ROOT } from "../paths.js";
import { readPins } from "../spec/pin.js";
import { decideRefresh, bumpPatch } from "./decide.js";

// Map each pin key to the upstream repo + branch it tracks.
const PIN_SOURCES: Record<string, { repo: string; branch: string }> = {
  "spec/main": { repo: "https://github.com/WebAssembly/spec", branch: "main" },
  "proposals/main": { repo: "https://github.com/WebAssembly/proposals", branch: "main" },
};

function lsRemote(repo: string, branch: string): string | null {
  try {
    const out = execFileSync("git", ["ls-remote", repo, `refs/heads/${branch}`], {
      encoding: "utf8",
    });
    const sha = out.split(/\s+/)[0]?.trim();
    return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

function setOutput(key: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) writeFileSync(file, `${key}=${value}\n`, { flag: "a" });
}

function main() {
  const apply = process.argv.includes("--apply");

  const current: Record<string, string> = {};
  for (const pin of readPins()) current[pin.key] = pin.sha;

  const upstream: Record<string, string> = {};
  for (const [key, src] of Object.entries(PIN_SOURCES)) {
    if (!(key in current)) continue;
    const sha = lsRemote(src.repo, src.branch);
    if (sha) upstream[key] = sha;
    else console.error(`warning: could not resolve ${key} (${src.repo}@${src.branch})`);
  }

  const decision = decideRefresh(current, upstream);
  for (const m of decision.moved) {
    console.log(`moved: ${m.key}  ${m.from.slice(0, 10)} → ${m.to.slice(0, 10)}`);
  }
  if (!decision.needsRefresh) {
    console.log("up to date — nothing to refresh");
    setOutput("moved", "false");
    return;
  }

  setOutput("moved", "true");

  if (!apply) {
    console.log("(dry run — pass --apply to write changes)");
    return;
  }

  // Rewrite vendor/PINNED.txt, preserving comments + ordering.
  const pinFile = resolve(VENDOR_ROOT, "PINNED.txt");
  const moved = new Map(decision.moved.map((m) => [m.key, m.to]));
  const lines = readFileSync(pinFile, "utf8").split("\n");
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return line;
    const eq = line.indexOf("=");
    if (eq < 0) return line;
    const key = line.slice(0, eq).trim();
    return moved.has(key) ? `${key}=${moved.get(key)}` : line;
  });
  writeFileSync(pinFile, rewritten.join("\n"));

  // Bump the package patch version.
  const pkgPath = resolve(REPO_ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  const nextVersion = bumpPatch(pkg.version);
  pkg.version = nextVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  // Update .last-refresh.json.
  const refreshPath = resolve(REPO_ROOT, ".last-refresh.json");
  const refreshed: Record<string, string> = {};
  for (const [key] of Object.entries(current)) refreshed[key] = upstream[key] ?? current[key]!;
  const lastRefresh = {
    refreshed_at: new Date().toISOString(),
    last_npm_publish: { version: nextVersion },
    pins: refreshed,
  };
  writeFileSync(refreshPath, JSON.stringify(lastRefresh, null, 2) + "\n");

  console.log(`applied — version bumped to ${nextVersion}`);
  setOutput("version", nextVersion);
}

const entry = process.argv[1];
if (entry && (entry.endsWith("/run.ts") || entry.endsWith("/run.js"))) {
  main();
}
