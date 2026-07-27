#!/usr/bin/env bash
# tandem.sh — plan/work/check loop across two models via opencode.
# Planner + Reviewer = one model (default kimi), Worker = another (default deepseek).
set -uo pipefail

PLANNER="${TANDEM_PLANNER:-opencode-go/kimi-k3}"
WORKER="${TANDEM_WORKER:-opencode-go/deepseek-v4-pro}"
REVIEWER="${TANDEM_REVIEWER:-$PLANNER}"
MAX_ROUNDS="${TANDEM_ROUNDS:-5}"
DIR="$PWD"
TASK=""

usage() {
  cat <<EOF
usage: tandem.sh [options] "<task>"
  --planner  MODEL   provider/model for planning   (default: $PLANNER)
  --worker   MODEL   provider/model for execution  (default: $WORKER)
  --reviewer MODEL   provider/model for review     (default: \$planner)
  --rounds   N       max plan/work/check rounds    (default: $MAX_ROUNDS)
  --dir      PATH    working directory             (default: cwd)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --planner)  PLANNER="$2"; shift 2;;
    --worker)   WORKER="$2"; shift 2;;
    --reviewer) REVIEWER="$2"; shift 2;;
    --rounds)   MAX_ROUNDS="$2"; shift 2;;
    --dir)      DIR="$2"; shift 2;;
    -h|--help)  usage; exit 0;;
    *)          TASK="${TASK:+$TASK }$1"; shift;;
  esac
done
[ -n "$TASK" ] || { usage; exit 1; }
[ "$REVIEWER" = "" ] && REVIEWER="$PLANNER"

RUN="$DIR/.tandem/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN"
printf '%s\n' "$TASK" > "$RUN/task.md"

say() { printf '\n\033[1;36m[tandem]\033[0m %s\n' "$*"; }

# ask <model> <outfile> <prompt>
ask() {
  local model="$1" out="$2" prompt="$3"
  opencode run --dir "$DIR" -m "$model" --auto --title "tandem" "$prompt" \
    2>>"$RUN/stderr.log" | tee "$out"
}

STATUS_FILE="$RUN/status"
echo CONTINUE > "$STATUS_FILE"

for ((r=1; r<=MAX_ROUNDS; r++)); do
  say "round $r/$MAX_ROUNDS — PLAN ($PLANNER)"
  PREV_REVIEW=""
  [ -f "$RUN/review-$((r-1)).md" ] && PREV_REVIEW="$(cat "$RUN/review-$((r-1)).md")"
  ask "$PLANNER" "$RUN/plan-$r.md" "You are the PLANNER in a two-model loop. Do NOT edit files.
Inspect the repo as needed, then output a concrete, ordered implementation plan for the worker model.

TASK:
$TASK
${PREV_REVIEW:+
REVIEW FROM PREVIOUS ROUND (fix these, do not redo finished work):
$PREV_REVIEW}

Output only the plan: numbered steps, exact files/functions to touch, and the acceptance checks (commands to run) that prove it works."

  say "round $r — WORK ($WORKER)"
  ask "$WORKER" "$RUN/work-$r.md" "You are the WORKER in a two-model loop. Implement the plan below in this repo, end to end.
Make the edits, run the acceptance checks, and fix what fails. Do not ask questions — decide and proceed.

TASK:
$TASK

PLAN:
$(cat "$RUN/plan-$r.md")

Finish with a short report: files changed, commands run, and their actual output."

  say "round $r — CHECK ($REVIEWER)"
  ask "$REVIEWER" "$RUN/review-$r.md" "You are the REVIEWER in a two-model loop. Do NOT edit files.
Independently verify the worker's claims against the real repo state (read the diff, run the acceptance checks/tests yourself).

TASK:
$TASK

WORKER REPORT:
$(cat "$RUN/work-$r.md")

Be strict: unverified claims, stubs, broken builds, skipped requirements all fail.
End your reply with exactly one line:
VERDICT: DONE      — if the task is fully complete and verified
VERDICT: CONTINUE  — otherwise, preceded by a specific list of what remains"

  if grep -qE '^VERDICT:[[:space:]]*DONE' "$RUN/review-$r.md"; then
    echo DONE > "$STATUS_FILE"
    say "reviewer says DONE after $r round(s). artifacts: $RUN"
    exit 0
  fi
  say "reviewer says CONTINUE — looping"
done

say "hit max rounds ($MAX_ROUNDS) without a DONE verdict. artifacts: $RUN"
exit 2
