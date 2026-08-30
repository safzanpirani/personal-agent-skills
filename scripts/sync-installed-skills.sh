#!/bin/sh
set -eu

sync_script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
sync_repo_root=$(CDPATH= cd -- "$sync_script_dir/.." && pwd -P)
sync_manifest="$sync_script_dir/managed-skills.txt"
sync_mode=check
sync_agent_root=${AGENT_SKILLS_ROOT:-"${HOME:?HOME is required}/.agents/skills"}
sync_claude_root=${CLAUDE_SKILLS_ROOT:-"${HOME:?HOME is required}/.claude/skills"}
sync_claude_links=1

sync_usage() {
  cat <<'EOF'
Usage: sync-installed-skills.sh [--check|--apply] [options]

Options:
  --check              Report drift without changing files. This is the default.
  --apply              Mirror managed skills, verify hashes, and add missing Claude links.
  --agent-root DIR     Override the ~/.agents/skills destination.
  --claude-root DIR    Override the ~/.claude/skills link root.
  --skip-claude-links  Do not inspect or create Claude links.
  --manifest FILE      Override the managed skill manifest.
  -h, --help           Show this help.
EOF
}

sync_die() {
  printf 'sync-installed-skills: %s\n' "$*" >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) sync_mode=check ;;
    --apply) sync_mode=apply ;;
    --agent-root)
      [ "$#" -ge 2 ] || sync_die '--agent-root requires a directory'
      sync_agent_root=$2
      shift
      ;;
    --claude-root)
      [ "$#" -ge 2 ] || sync_die '--claude-root requires a directory'
      sync_claude_root=$2
      shift
      ;;
    --skip-claude-links) sync_claude_links=0 ;;
    --manifest)
      [ "$#" -ge 2 ] || sync_die '--manifest requires a file'
      sync_manifest=$2
      shift
      ;;
    -h|--help)
      sync_usage
      exit 0
      ;;
    *) sync_die "unknown option: $1" ;;
  esac
  shift
done

[ -f "$sync_manifest" ] || sync_die "manifest not found: $sync_manifest"
command -v diff >/dev/null 2>&1 || sync_die 'diff is required'
command -v find >/dev/null 2>&1 || sync_die 'find is required'
command -v shasum >/dev/null 2>&1 || sync_die 'shasum is required'
[ "$sync_mode" = check ] || command -v rsync >/dev/null 2>&1 || sync_die 'rsync is required for --apply'

case "$sync_agent_root" in
  ''|'/'|"$HOME"|"$sync_repo_root"|"$sync_repo_root"/*)
    sync_die "unsafe agent root: $sync_agent_root"
    ;;
esac
case "$sync_claude_root" in
  ''|'/'|"$HOME"|"$sync_repo_root"|"$sync_repo_root"/*)
    sync_die "unsafe Claude root: $sync_claude_root"
    ;;
esac

sync_tree_hash() (
  sync_hash_root=$1
  CDPATH= cd -- "$sync_hash_root"
  find . \( -type f -o -type l \) -print | LC_ALL=C sort | while IFS= read -r sync_hash_entry; do
    if [ -L "$sync_hash_entry" ]; then
      printf 'link\t%s\t%s\n' "$sync_hash_entry" "$(readlink "$sync_hash_entry")"
    else
      sync_file_hash=$(shasum -a 256 "$sync_hash_entry" | awk '{print $1}')
      printf 'file\t%s\t%s\n' "$sync_hash_entry" "$sync_file_hash"
    fi
  done | shasum -a 256 | awk '{print $1}'
)

sync_validate_manifest() {
  sync_seen=' '
  while IFS= read -r sync_skill_name || [ -n "$sync_skill_name" ]; do
    case "$sync_skill_name" in
      ''|'#'*) continue ;;
      *[!A-Za-z0-9_-]*) sync_die "invalid skill name: $sync_skill_name" ;;
    esac
    case "$sync_seen" in
      *" $sync_skill_name "*) sync_die "duplicate skill: $sync_skill_name" ;;
    esac
    sync_seen="$sync_seen$sync_skill_name "
    [ -f "$sync_repo_root/skills/$sync_skill_name/SKILL.md" ] || sync_die "missing source skill: $sync_skill_name"
  done < "$sync_manifest"
}

sync_verify_agents() {
  sync_verify_failures=0
  while IFS= read -r sync_skill_name || [ -n "$sync_skill_name" ]; do
    case "$sync_skill_name" in ''|'#'*) continue ;; esac
    sync_source_dir="$sync_repo_root/skills/$sync_skill_name"
    sync_destination_dir="$sync_agent_root/$sync_skill_name"
    sync_source_hash=$(sync_tree_hash "$sync_source_dir")
    if [ ! -d "$sync_destination_dir" ]; then
      printf '%s\tMISSING\t%s\n' "$sync_skill_name" "$sync_source_hash"
      sync_verify_failures=$((sync_verify_failures + 1))
      continue
    fi
    if [ -L "$sync_destination_dir" ]; then
      printf '%s\tINVALID_DESTINATION_SYMLINK\n' "$sync_skill_name"
      sync_verify_failures=$((sync_verify_failures + 1))
      continue
    fi
    sync_destination_hash=$(sync_tree_hash "$sync_destination_dir")
    if diff -qr "$sync_source_dir" "$sync_destination_dir" >/dev/null; then
      printf '%s\tOK\t%s\n' "$sync_skill_name" "$sync_source_hash"
    else
      printf '%s\tDRIFT\tsource=%s\tdestination=%s\n' "$sync_skill_name" "$sync_source_hash" "$sync_destination_hash"
      sync_verify_failures=$((sync_verify_failures + 1))
    fi
  done < "$sync_manifest"
  return "$sync_verify_failures"
}

sync_apply_agents() {
  /bin/mkdir -p "$sync_agent_root"
  while IFS= read -r sync_skill_name || [ -n "$sync_skill_name" ]; do
    case "$sync_skill_name" in ''|'#'*) continue ;; esac
    sync_source_dir="$sync_repo_root/skills/$sync_skill_name"
    sync_destination_dir="$sync_agent_root/$sync_skill_name"
    [ ! -L "$sync_destination_dir" ] || sync_die "destination skill is a symlink: $sync_destination_dir"
    /bin/mkdir -p "$sync_destination_dir"
    rsync -a --delete -- "$sync_source_dir/" "$sync_destination_dir/"
    printf '%s\tSYNCED\n' "$sync_skill_name"
  done < "$sync_manifest"
}

sync_apply_claude_links() {
  /bin/mkdir -p "$sync_claude_root"
  while IFS= read -r sync_skill_name || [ -n "$sync_skill_name" ]; do
    case "$sync_skill_name" in ''|'#'*) continue ;; esac
    sync_claude_entry="$sync_claude_root/$sync_skill_name"
    sync_destination_dir="$sync_agent_root/$sync_skill_name"
    if [ ! -e "$sync_claude_entry" ] && [ ! -L "$sync_claude_entry" ]; then
      /bin/ln -s "$sync_destination_dir" "$sync_claude_entry"
      printf '%s\tCLAUDE_LINKED\n' "$sync_skill_name"
    fi
  done < "$sync_manifest"
}

sync_verify_claude_links() {
  sync_link_failures=0
  while IFS= read -r sync_skill_name || [ -n "$sync_skill_name" ]; do
    case "$sync_skill_name" in ''|'#'*) continue ;; esac
    sync_claude_entry="$sync_claude_root/$sync_skill_name"
    sync_destination_dir="$sync_agent_root/$sync_skill_name"
    if [ -L "$sync_claude_entry" ] && [ "$sync_claude_entry" -ef "$sync_destination_dir" ]; then
      printf '%s\tCLAUDE_LINK_OK\n' "$sync_skill_name"
    elif [ -d "$sync_claude_entry" ] && [ ! -L "$sync_claude_entry" ]; then
      printf '%s\tCLAUDE_OVERRIDE\n' "$sync_skill_name"
    elif [ ! -e "$sync_claude_entry" ] && [ ! -L "$sync_claude_entry" ]; then
      printf '%s\tCLAUDE_LINK_MISSING\n' "$sync_skill_name"
      sync_link_failures=$((sync_link_failures + 1))
    else
      printf '%s\tCLAUDE_LINK_DRIFT\n' "$sync_skill_name"
      sync_link_failures=$((sync_link_failures + 1))
    fi
  done < "$sync_manifest"
  return "$sync_link_failures"
}

sync_validate_manifest

if [ "$sync_mode" = apply ]; then
  sync_apply_agents
fi

sync_failures=0
sync_verify_agents || sync_failures=$?

if [ "$sync_claude_links" -eq 1 ]; then
  if [ "$sync_mode" = apply ]; then
    sync_apply_claude_links
  fi
  sync_verify_claude_links || sync_failures=$((sync_failures + $?))
fi

if [ "$sync_failures" -ne 0 ]; then
  printf 'RESULT\tDRIFT\t%d\n' "$sync_failures"
  exit 1
fi

printf 'RESULT\tOK\n'
