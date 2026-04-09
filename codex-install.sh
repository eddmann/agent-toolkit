#!/usr/bin/env bash
# install skills into Codex ($CODEX_HOME/skills, default ~/.codex/skills)
#
# - only touches skills that belong to this toolkit
# - never removes skills it doesn't own
# - safe to re-run - keeps everything in sync
# - preserves Codex's preinstalled ~/.codex/skills/.system skills
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"
THIRD_PARTY_DIR="$SCRIPT_DIR/third-party-skills"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
CODEX_SKILLS="$CODEX_HOME/skills"

if [ -e "$CODEX_SKILLS" ] && ! [ -d "$CODEX_SKILLS" ]; then
  echo "error: $CODEX_SKILLS exists and is not a directory" >&2
  exit 1
fi

mkdir -p "$CODEX_SKILLS"

is_managed_target() {
  local target="$1"

  [ -L "$target" ] || return 1

  case "$(readlink "$target")" in
    "$SCRIPT_DIR"/*) return 0 ;;
    *) return 1 ;;
  esac
}

link_skill() {
  local source="$1" name="$2"
  local target="$CODEX_SKILLS/$name"

  if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
    echo "  $name (up to date)"
    return
  fi

  if [ -e "$target" ] && ! [ -L "$target" ]; then
    echo "  $name (skipped - exists and not managed by agent-toolkit)"
    return
  fi

  if [ -L "$target" ] && ! is_managed_target "$target"; then
    echo "  $name (skipped - symlink exists and not managed by agent-toolkit)"
    return
  fi

  [ -e "$target" ] || [ -L "$target" ] && rm -f "$target"

  ln -s "$source" "$target"
  echo "  $name (linked)"
}

echo "codex skills:"
for skill in "$SKILLS_DIR"/*/; do
  link_skill "$skill" "$(basename "$skill")"
done

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
echo "restart Codex to pick up new skills."
