#!/usr/bin/env bash
# Clone WebAssembly/spec at the SHAs recorded in vendor/PINNED.txt.
#
# Reads `key=sha` lines from vendor/PINNED.txt. For each entry whose
# key is `spec/<branch>`, clones https://github.com/WebAssembly/spec
# into vendor/wasm-spec-<branch>/ and checks out the exact SHA.
#
# GitHub's git server supports fetching by commit SHA when
# uploadpack.allowReachableSHA1InWant is enabled (it is, repo-wide),
# so we can do a shallow checkout of any historical commit without
# downloading the full history.

set -euo pipefail

cd "$(dirname "$0")/.."

PIN_FILE="vendor/PINNED.txt"
REPO_URL="${WASM_SPEC_REPO:-https://github.com/WebAssembly/spec}"
PROPOSALS_URL="${WASM_PROPOSALS_REPO:-https://github.com/WebAssembly/proposals}"

if [[ ! -f "$PIN_FILE" ]]; then
  echo "error: $PIN_FILE not found" >&2
  exit 1
fi

mkdir -p vendor

clone_at_sha() {
  local dest="$1"
  local sha="$2"
  local url="$3"

  if [[ -d "$dest/.git" ]]; then
    local current
    current=$(git -C "$dest" rev-parse HEAD 2>/dev/null || echo "")
    if [[ "$current" == "$sha" ]]; then
      echo "==> $dest already at $sha" >&2
      return 0
    fi
    echo "==> Updating $dest to $sha" >&2
    git -C "$dest" fetch --depth=1 origin "$sha" >&2
    git -C "$dest" checkout --detach FETCH_HEAD >&2
  else
    echo "==> Cloning $url@$sha → $dest" >&2
    git init --quiet "$dest"
    git -C "$dest" remote add origin "$url"
    git -C "$dest" fetch --depth=1 origin "$sha" >&2
    git -C "$dest" checkout --detach FETCH_HEAD >&2
  fi
}

# Iterate over pins. Skip blanks and comments.
while IFS= read -r raw; do
  line="${raw%%#*}"
  line="${line## }"
  line="${line%% }"
  [[ -z "$line" ]] && continue

  key="${line%%=*}"
  sha="${line##*=}"
  key="${key// /}"
  sha="${sha// /}"
  [[ -z "$key" || -z "$sha" ]] && continue

  case "$key" in
    spec/*)
      branch="${key#spec/}"
      clone_at_sha "vendor/wasm-spec-$branch" "$sha" "$REPO_URL"
      ;;
    proposals/*)
      branch="${key#proposals/}"
      clone_at_sha "vendor/wasm-proposals-$branch" "$sha" "$PROPOSALS_URL"
      ;;
    *)
      echo "==> Skipping unknown pin key: $key" >&2
      ;;
  esac
done < "$PIN_FILE"

echo "✓ vendor/ populated from $PIN_FILE" >&2
