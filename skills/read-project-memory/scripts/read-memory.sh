#!/usr/bin/env bash
# read-memory.sh — print the Claude auto-memory for a project directory.
#
# Claude Code stores per-project memory under:
#   ~/.claude/projects/<slug>/memory/
# where <slug> is the absolute project path with every "/", "." and "_"
# replaced by "-" (e.g. /Users/x/Development/linuxsync ->
# -Users-x-Development-linuxsync).
#
# This script reconstructs that slug from a directory, walking UP through
# ancestor directories until it finds one that has a memory/ folder, then
# prints MEMORY.md (the index) followed by every individual memory file.
#
# Usage:
#   read-memory.sh [DIR]        # DIR defaults to $PWD
#   read-memory.sh --index DIR  # print only MEMORY.md (the index)
#   read-memory.sh --list DIR   # print only the file paths, no contents

set -euo pipefail

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

mode="full"
case "${1:-}" in
  --index) mode="index"; shift ;;
  --list)  mode="list";  shift ;;
  --help|-h)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    exit 0 ;;
esac

# Resolve target dir to an absolute path.
target="${1:-$PWD}"
if command -v realpath >/dev/null 2>&1; then
  target="$(realpath "$target" 2>/dev/null || echo "$target")"
fi
case "$target" in
  /*) ;;                       # already absolute
  *) target="$PWD/$target" ;;
esac

slugify() { printf '%s' "$1" | sed 's#[/._]#-#g'; }

# Walk up ancestors until we find a project dir that has memory files.
memdir=""
dir="$target"
while :; do
  candidate="$CLAUDE_HOME/projects/$(slugify "$dir")/memory"
  if [ -d "$candidate" ]; then
    memdir="$candidate"
    break
  fi
  parent="$(dirname "$dir")"
  [ "$parent" = "$dir" ] && break   # reached filesystem root
  dir="$parent"
done

if [ -z "$memdir" ]; then
  echo "No Claude project memory found for '$target' (or any ancestor)." >&2
  echo "Looked under: $CLAUDE_HOME/projects/<slug>/memory/" >&2
  exit 1
fi

index="$memdir/MEMORY.md"

if [ "$mode" = "list" ]; then
  [ -f "$index" ] && echo "$index"
  find "$memdir" -maxdepth 1 -type f -name '*.md' ! -name 'MEMORY.md' | sort
  exit 0
fi

echo "# Project memory: $memdir"
echo

if [ -f "$index" ]; then
  echo "===== MEMORY.md (index) ====="
  cat "$index"
  echo
fi

[ "$mode" = "index" ] && exit 0

# Print each individual memory file (skip the index, already shown).
while IFS= read -r f; do
  echo "===== $(basename "$f") ====="
  cat "$f"
  echo
done < <(find "$memdir" -maxdepth 1 -type f -name '*.md' ! -name 'MEMORY.md' | sort)
