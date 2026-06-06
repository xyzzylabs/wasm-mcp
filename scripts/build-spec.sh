#!/usr/bin/env bash
# Build baked instruction artifacts for every vendored snapshot.
#
# For each `vendor/wasm-spec-<branch>/` populated by fetch-spec.sh:
#   1. Dump the structured instruction + macro data with the upstream
#      Python sources (via `scripts/dump-instructions.py`).
#   2. Run `src/index/build_instructions.ts` to normalise the dump
#      into `build/wasm-spec-core-<branch>.json`.
#
# No Sphinx / SpecTec / OCaml / LaTeX involved — the instruction
# index data lives directly in `index-instructions.py` upstream. The
# heavier toolchain becomes necessary only when section/clause/search
# tools land (they need rendered HTML).

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required (used to AST-parse the upstream index)" >&2
  exit 1
fi

mkdir -p build

mapfile -t SNAPSHOTS < <(find vendor -maxdepth 1 -mindepth 1 -type d -name 'wasm-spec-*' | sort)
if [[ ${#SNAPSHOTS[@]} -eq 0 ]]; then
  echo "error: no vendor/wasm-spec-* checkouts — run \`npm run fetch-spec\` first" >&2
  exit 1
fi

for snap in "${SNAPSHOTS[@]}"; do
  branch="${snap##*/wasm-spec-}"
  raw="build/instructions-raw-${branch}.json"
  echo "==> Dumping raw instructions from $snap → $raw" >&2
  python3 scripts/dump-instructions.py "$snap" > "$raw"
done

echo "==> Building unified baked artifacts (instructions + sections + types)" >&2
npx --no-install tsx src/index/build_spec.ts

if find vendor -maxdepth 1 -type d -name 'wasm-proposals-*' | read -r _; then
  echo "==> Building proposals index" >&2
  npx --no-install tsx src/index/build_proposals.ts
fi
