#!/usr/bin/env bash
# Render a live codex-exec --json log into a readable step trace.
# Usage: peek.sh <live_json_log> [N]   (N = last N events, default 25)
set -euo pipefail
LOG="${1:?usage: peek.sh <live_json_log> [N]}"
N="${2:-25}"
[ -f "$LOG" ] || { echo "(no log yet at $LOG)"; exit 0; }
jq -rc '
  if .type=="item.started" or .type=="item.completed" then
    .item as $i
    | ($i.status // (if .type=="item.completed" then "done" else "…" end)) as $st
    | if $i.type=="command_execution" then "[\($st)] $ \($i.command|gsub("\n";" ")|.[0:80])"
      elif $i.type=="reasoning" then "[think] \($i.text // ""|gsub("\n";" ")|.[0:90])"
      elif $i.type=="agent_message" then "[say] \($i.text // ""|gsub("\n";" ")|.[0:90])"
      elif $i.type=="error" then "[warn] \($i.message // ""|gsub("\n";" ")|.[0:90])"
      else "[\($i.type)] \($st)" end
  elif .type=="turn.completed" then "[usage] out=\(.usage.output_tokens) in=\(.usage.input_tokens) cached=\(.usage.cached_input_tokens)"
  elif .type=="turn.started" then "[turn] started"
  else empty end
' "$LOG" 2>/dev/null | tail -n "$N"
