#!/usr/bin/env bash
# install skills into claude code (~/.claude/skills/)
#
# - only touches skills that belong to this toolkit
# - never removes skills it doesn't own
# - safe to re-run — keeps everything in sync
# - set SKIP_SKILLS="name1 name2" to omit specific skills (removes any
#   previously-linked copies of those skills)
set -euo pipefail

_SCRIPT_RAW_DIR="$(cd "$(dirname "$0")" && pwd -P)"
if command -v realpath >/dev/null 2>&1; then
  SCRIPT_DIR="$(realpath "$_SCRIPT_RAW_DIR")"
else
  SCRIPT_DIR="$_SCRIPT_RAW_DIR"
fi
SKILLS_DIR="$SCRIPT_DIR/skills"
THIRD_PARTY_DIR="$SCRIPT_DIR/third-party-skills"
CLAUDE_SKILLS="$HOME/.claude/skills"
SKIP_SKILLS="${SKIP_SKILLS:-}"

is_skipped() {
  local name="$1" skip
  for skip in $SKIP_SKILLS; do
    [ "$skip" = "$name" ] && return 0
  done
  return 1
}

# resolve a path to its canonical form (follows symlinks, normalises case
# on case-insensitive filesystems). prefers realpath; falls back to a
# pwd -P approximation when realpath is unavailable
canonical_path() {
  local p="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$p" 2>/dev/null || printf '%s\n' "$p"
  elif [ -d "$p" ]; then
    (cd "$p" && pwd -P)
  elif [ -e "$p" ] || [ -L "$p" ]; then
    local dir base
    dir="$(dirname "$p")"
    base="$(basename "$p")"
    if [ -d "$dir" ]; then
      printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
    else
      printf '%s\n' "$p"
    fi
  else
    printf '%s\n' "$p"
  fi
}

is_managed_target() {
  local target="$1"

  [ -L "$target" ] || return 1

  local resolved
  resolved="$(canonical_path "$(readlink "$target")")"

  case "$resolved" in
    "$SCRIPT_DIR"/*) return 0 ;;
    *) return 1 ;;
  esac
}

# ensure ~/.claude/skills is a real directory
if [ -L "$CLAUDE_SKILLS" ]; then
  echo "replacing symlink $CLAUDE_SKILLS -> $(readlink "$CLAUDE_SKILLS") with directory"
  rm "$CLAUDE_SKILLS"
fi
mkdir -p "$CLAUDE_SKILLS"

link_skill() {
  local source="$1" name="$2"
  local target="$CLAUDE_SKILLS/$name"

  if is_skipped "$name"; then
    if [ -L "$target" ] && is_managed_target "$target"; then
      rm -f "$target"
      echo "  $name (skipped — removed managed symlink)"
    else
      echo "  $name (skipped)"
    fi
    return
  fi

  # already correct
  if [ -L "$target" ] && [ "$(canonical_path "$(readlink "$target")")" = "$(canonical_path "$source")" ]; then
    echo "  $name (up to date)"
    return
  fi

  # exists but we don't own it (not a symlink pointing into our tree)
  if [ -e "$target" ] && ! [ -L "$target" ]; then
    echo "  $name (skipped — exists and not managed by agent-toolkit)"
    return
  fi

  # symlink exists but points outside our tree
  if [ -L "$target" ] && ! is_managed_target "$target"; then
    echo "  $name (skipped — symlink exists and not managed by agent-toolkit)"
    return
  fi

  # stale symlink pointing into our tree — safe to replace
  [ -e "$target" ] || [ -L "$target" ] && rm -f "$target"

  ln -s "$source" "$target"
  echo "  $name (linked)"
}

# first-party skills
echo "claude code skills:"
for skill in "$SKILLS_DIR"/*/; do
  link_skill "$skill" "$(basename "$skill")"
done

# third-party skills
if [ -f "$THIRD_PARTY_DIR/install.sh" ]; then
  echo ""
  echo "third-party skills:"
  bash "$THIRD_PARTY_DIR/install.sh"
  echo ""
  for skill in "$THIRD_PARTY_DIR/installed"/*/; do
    [ -d "$skill" ] || continue
    link_skill "$skill" "$(basename "$skill")"
  done
fi

echo ""
echo "done."
