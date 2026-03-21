#!/usr/bin/env bash
# install skills into claude code (~/.claude/skills/)
#
# - only touches skills that belong to this toolkit
# - never removes skills it doesn't own
# - safe to re-run — keeps everything in sync
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"
THIRD_PARTY_DIR="$SCRIPT_DIR/third-party-skills"
CLAUDE_SKILLS="$HOME/.claude/skills"

# ensure ~/.claude/skills is a real directory
if [ -L "$CLAUDE_SKILLS" ]; then
  echo "replacing symlink $CLAUDE_SKILLS -> $(readlink "$CLAUDE_SKILLS") with directory"
  rm "$CLAUDE_SKILLS"
fi
mkdir -p "$CLAUDE_SKILLS"

link_skill() {
  local source="$1" name="$2"
  local target="$CLAUDE_SKILLS/$name"

  # already correct
  if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
    echo "  $name (up to date)"
    return
  fi

  # exists but we don't own it (not a symlink pointing into our tree)
  if [ -e "$target" ] && ! [ -L "$target" ]; then
    if readlink "$target" 2>/dev/null | grep -q "$SCRIPT_DIR"; then :; else
      echo "  $name (skipped — exists and not managed by agent-toolkit)"
      return
    fi
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
