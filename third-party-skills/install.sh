#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$SCRIPT_DIR/manifest.json"
DEST="$SCRIPT_DIR/installed"

if ! command -v jq &>/dev/null; then
  echo "error: jq is required (brew install jq)" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: $MANIFEST not found" >&2
  exit 1
fi

mkdir -p "$DEST"

for name in $(jq -r 'keys[]' "$MANIFEST"); do
  repo=$(jq -r ".\"$name\".repo" "$MANIFEST")
  path=$(jq -r ".\"$name\".path" "$MANIFEST")
  ref=$(jq -r ".\"$name\".ref // \"main\"" "$MANIFEST")
  target="$DEST/$name"

  echo "[$name] $repo ($path @ ${ref:0:8})"

  if [[ -d "$target" ]]; then
    echo "  already exists, removing..."
    rm -rf "$target"
  fi

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  git init -q "$tmp/repo"
  (
    cd "$tmp/repo"
    git remote add origin "https://github.com/$repo.git"
    git sparse-checkout set "$path"
    git fetch --depth 1 origin "$ref" 2>/dev/null
    git checkout FETCH_HEAD 2>/dev/null
  )

  cp -r "$tmp/repo/$path" "$target"
  rm -rf "$tmp"
  trap - EXIT

  echo "  -> $target"
done

echo ""
echo "done. $(jq 'length' "$MANIFEST") third-party skills installed."
