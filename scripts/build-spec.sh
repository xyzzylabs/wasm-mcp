#!/usr/bin/env bash
# Build the baked spec artifacts from the vendored checkouts.
#
# Everything is pure TypeScript — no Python, Sphinx, SpecTec, OCaml,
# or LaTeX. The instruction index + macro table are extracted from the
# upstream sources by src/parser/upstream.ts; sections come from the
# RST (core) and Bikeshed (js-api / web-api) sources; proposals from
# the WebAssembly/proposals Markdown.

set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p build

if ! find vendor -maxdepth 1 -type d -name 'wasm-spec-*' | read -r _; then
  echo "error: no vendor/wasm-spec-* checkouts — run \`npm run fetch-spec\` first" >&2
  exit 1
fi

echo "==> Building unified baked artifacts (instructions + sections + types)" >&2
npx --no-install tsx src/index/build_spec.ts

echo "==> Building auxiliary spec sections (js-api, web-api)" >&2
npx --no-install tsx src/index/build_aux_specs.ts

if find vendor -maxdepth 1 -type d -name 'wasm-proposals-*' | read -r _; then
  echo "==> Building proposals index" >&2
  npx --no-install tsx src/index/build_proposals.ts
fi
