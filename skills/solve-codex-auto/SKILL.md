---
name: solve-codex-auto
description: Hand a hard, stuck, or context-heavy task to a live-steerable Codex Rudder session so Codex investigates and implements the fix autonomously on the current workspace, using a fresh thread by default or deliberately resuming/forking a discovered thread when continuity matters. Runs on Codex's separate quota instead of the Claude budget. Use when the user invokes `$solve-codex-auto [task]`, says "hand this to codex" / "let codex take it" / "I'm stuck, use codex", when a bug or feature has resisted a couple of attempts, or when Claude usage limits are a concern and autonomous fix work should be routed off the Claude quota. For fresh-eyes review of an existing diff use `review-codex-auto`; for a one-shot prompt without execution use `review-codex`.
metadata:
  short-description: Delegate work to a live-steerable Codex
---

# solve-codex-auto

Your job: package the problem you're struggling with into a self-contained brief, then run it through a Codex CLI subprocess in headless mode so Codex investigates and *implements* the fix. Start fresh by default; resume or fork only after discovering an exact relevant prior thread as described below. This is for delegation, not review — Codex should end with working code, not a list of suggestions. It runs on Codex's separate quota, so this is also the right move when the Claude 5-hour limit is a concern (see [[feedback_codex_over_subagents]]).

If invoked as `$solve-codex-auto <text>`, treat the text as the task statement. Otherwise infer the stuck task from the recent conversation.

## Dependency

This skill relies on [Rudder](http://github.com/safzanpirani/rudder) for live steering and session management. The direct Codex CLI path provides a non-steerable fallback when Rudder is unavailable.

## Steerable Codex command

Prefer Codex Rudder and run it backgrounded. Rudder owns the app-server
connection, streams the task, and accepts `turn/steer` from a separate command:

```bash
rudder run \
  --cwd "$PWD" \
  --prompt-file "$PROMPT_FILE" \
  --state-dir "$RUN_DIR" \
  --model gpt-5.6-sol \
  --sandbox danger-full-access
```

- `--cwd "$PWD"` keeps the sub-Codex in the current repo.
- `--sandbox danger-full-access` is the default for this skill (user policy, 2026-07-23): the
  sandbox's network block wasted whole delegated runs (fleet/ssh, npm installs, live-gateway
  tests all die under workspace-write). Codex gets full disk + internet access.
- Rudder writes `events.jsonl`, `trace.log`, `output.md`, and `state.json` under `$RUN_DIR`.
- Add `--effort high` when the problem is genuinely subtle.

Fallback only when `command -v rudder` fails:

```bash
codex exec --json -C "$PWD" --dangerously-bypass-approvals-and-sandbox -m gpt-5.6-sol -o "$OUTPUT_FILE" - < "$PROMPT_FILE" > "$LIVE_LOG" 2>&1
```

If the fallback must be detached manually, stdin still must be redirected from
the prompt file (or from `/dev/null` after passing a prompt another way). Never
launch `nohup codex exec ... &` with inherited stdin: Codex can print its banner
and exit 0 without starting the task, making the missing output look like a
successful run.

## Thread discovery, resume, and fork

Before choosing a thread mode, distinguish a live turn from a completed prior
thread. If this skill already has an active `$RUN_DIR`, use `rudder status` and
`rudder steer`; never launch a second turn to replace or compete with it.

For a possible continuation, discover candidates with Rudder rather than
guessing an ID:

```bash
rudder thread list \
  --limit 20 --cwd-filter "$PWD"
rudder thread search \
  --limit 10 "<distinctive task keywords>"
rudder thread read \
  --include-turns THREAD_ID
rudder thread turns \
  --limit 20 THREAD_ID
```

`thread search` is global, so verify the candidate's `cwd` exactly matches
`$PWD`; never select from a snippet alone. Inspect the candidate with
`thread read --include-turns` and confirm its goal and recent outcome. If the
run uses a private app-server child after `--`, use that same child command for
thread commands so discovery and execution use the same history/auth backend.

Choose exactly one mode:

- **Fresh (default):** no exact match, multiple plausible matches, an unrelated
  task, or the user asked for fresh eyes. Use the normal `rudder run` command.
- **Resume:** prefer this when the same parent agent session previously launched
  `solve-codex-auto` for this task and that Rudder turn is now terminal. Its
  recorded `$RUN_DIR` / `threadId` is an unambiguous match, and resuming avoids
  making Codex re-explore the codebase while preserving its earlier diagnosis,
  edits, verification, and handoff context. Also resume when discovery finds one
  equally unambiguous direct continuation in the same repo. Add
  `--resume-thread THREAD_ID`. The new brief should state what changed or what
  remains to do since the previous turn instead of restating the whole task as
  if the model has no history.
- **Fork:** prior context is useful but the new run should explore an alternate
  approach or preserve the source conversation unchanged. Add
  `--fork-thread THREAD_ID`; optionally add `--fork-before-turn TURN_ID` to
  exclude that turn and everything after it, or `--fork-through-turn TURN_ID`
  to include history through it. These selectors are mutually exclusive.

Conversation forks do not isolate filesystem edits. The dirty-tree guard and,
for risky alternatives, a separate Git worktree still apply. Never resume or
fork an active turn; steer it. Never silently choose among ambiguous candidates
or turn a failed resume/fork into a fresh run. Once a useful thread ID is known,
optionally give it a concise discoverable name with `rudder thread name
THREAD_ID "solve: <short task>"`.

Selection order within one parent session is therefore: steer its active Rudder
turn; otherwise resume its completed matching solve thread; otherwise discover
an older exact match; otherwise start fresh. Fork instead of resume when the
user wants an alternate path that keeps the source conversation intact.

## How to build the brief

For a fresh thread, Codex has none of this session's context, so the brief must
stand alone. For a resumed/forked thread, preserve the requirements below but
lead with the new information, remaining work, or changed constraints; do not
make Codex repeat exploration already present in the selected history.

1. **State the goal** in one or two lines: what should be true when this is done.
2. **State what's been tried and why it failed** — the whole point of handing off is that you're stuck. Include the actual error output, stack traces, or failing test names verbatim. Don't paraphrase errors.
3. **Point at the load-bearing files** — exact paths and, where you know them, the functions/lines involved. Save Codex the rediscovery cost.
4. **Give the repro / verify command** — how Codex confirms it's actually fixed (test command, curl, build, typecheck).
5. **Pull in project constraints** from `CLAUDE.md`, `AGENTS.md`, `README.md`, or relevant `docs/` — conventions, forbidden patterns, env setup, remote-access notes (e.g. "ssh main, then wsl") Codex can't infer.
6. **Draw the fences**: what's in scope vs. explicitly off-limits, so Codex doesn't refactor the world.

## Required contents of the generated Codex prompt

- The goal, the failing state (with real error text), and the suspect files.
- Instruction to investigate first (run the repro, read the cited files) before editing.
- Instruction to **implement** the fix directly — edit files, don't just describe.
- The exact command(s) to verify the fix works, and to run them before declaring done.
- Scope fences (touch these areas, leave those alone).
- Instruction to flag genuine uncertainty with a `// TODO(codex):` marker rather than guessing when a choice would meaningfully change product behavior.

Always append this verbatim close-out block:

```text
Work autonomously to completion — do not stop to ask me for confirmation mid-task. Investigate, implement the fix directly in the files, then run the verify command(s) above and iterate until they pass (or until you've hit a genuine blocker).

At the very end, print a **"Handoff report"**:
- What the root cause turned out to be (one or two lines).
- Changes applied, grouped by file, one line each on what and why.
- Verification: the exact command you ran and its result (passed / still failing + the remaining error).
- Anything you deliberately did NOT do, with why (uncertain / behavioral / out of scope), and any follow-up the human must run (regenerate types, set env var, rerun migration, etc.).
```

## Execution steps

> **Dirty-tree guard:** before launching, run `git status -sb`; if the tree has
> uncommitted changes, snapshot the baseline first (`git stash create` and record
> the hash, or save `git diff > $SCRATCH/pre-run.diff`) so the sub-Codex's edits
> stay attributable afterwards. For risky runs, prefer a separate `git worktree`.

> **Paths must be fixed literals, not `mktemp`-into-a-shell-var.** Each Bash tool call is a fresh shell — a `PROMPT_FILE=$(mktemp)` set in one call is **empty** in the next, which silently breaks the run (past runs hit this and worked around it by stashing the path in a file). Use stable paths under your scratchpad dir and reuse them verbatim.

1. Pick fixed paths, e.g. `PROMPT_FILE=$SCRATCH/solve-codex.prompt.md` and `RUN_DIR=$SCRATCH/solve-codex.run`. Rudder's final output is `$RUN_DIR/output.md`, raw event log is `$RUN_DIR/events.jsonl`, and readable trace is `$RUN_DIR/trace.log`.
2. Write the generated brief to the prompt file (Write tool, or a heredoc **in the same Bash call** as the launch).
3. Launch the Rudder command **with `run_in_background: true`**. Foreground runs get killed at the Bash-tool timeout, so background is not optional for real tasks.
4. While it runs, peek whenever useful (or when the user asks "what's it doing?") — see [Monitoring](#monitoring). Report the current step in plain language.
5. Wait bounded, never unbounded: `rudder wait --state-dir "$RUN_DIR" --timeout 3600s` (`--timeout` takes a Go duration (`3600s`, `1h`); the default `0` waits forever; `rudder run` also has a one-hour turn watchdog unless `--turn-timeout 0` is explicitly passed). When it ends, check `rudder status --state-dir "$RUN_DIR" --json` first: trust `$RUN_DIR/output.md` only when `status` is `completed`; on `failed`/`interrupted`, report the `error` field instead (`output.md` may not exist at all on failure). `output.md` contains completed agent messages in order; use `$RUN_DIR/events.jsonl` when the raw event sequence is needed.
6. Report to the user: the prompt-file path, Rudder run/trace paths, output path, Codex's Handoff report, and — cross-checked against `git status -sb` / the verify command — whether it actually landed a working fix or stalled.

**Model / effort:** always pass **`-m gpt-5.6-sol`** — it is the user's configured default in
`~/.codex/config.toml` and their standing preference. Do **not** substitute `gpt-5.5` or any older
model, even for a "hard task". With Rudder use `--model gpt-5.6-sol` and add `--effort high` when
the problem is genuinely subtle.

**Sandbox:** use `--sandbox danger-full-access` for implementation tasks (the default for this
skill — full disk + internet, per user policy; the network block was wasting delegated runs). For
an advisory-only **consult** — where you want a recommendation, not edits — use `-s read-only` and
say so explicitly in the brief, otherwise Codex will start editing.

## Monitoring

Codex runs detached behind Rudder; watch its progress without blocking:

- **Peek on demand** — render the live trace:
  ```bash
  rudder peek --state-dir "$RUN_DIR" -n 25
  ```
- **Machine-readable status** — `rudder status --state-dir "$RUN_DIR" --json` reports active IDs, status, and steer count.
- **Auto-wake on a condition** — use the `Monitor` tool against `$RUN_DIR/trace.log` or `$RUN_DIR/state.json` instead of polling.

## Live steering

If the user adds context, corrects a premise, or changes priority while Codex
is active, forward that update into the same turn immediately:

```bash
rudder steer \
  --state-dir "$RUN_DIR" \
  "<the user's steering update, preserving exact literals>"
```

Use `--message-file` for multiline or shell-sensitive text. Report when the
steer is accepted. If Rudder says the turn is no longer active, read the final
output; never silently create a replacement turn.

To stop the run entirely (wrong premise, full change of direction), use
`rudder interrupt --state-dir "$RUN_DIR"`
instead of killing the process. If the controller dies unexpectedly, current
Rudder renders the non-terminal state as `stale` and makes wait/steer/interrupt
fail promptly. Report that state and only start a fresh run with the user's
go-ahead; never treat a restart as a continuation.

## Fallback

If Rudder is unavailable, use the `codex exec --json` fallback above. If
`command -v codex` also fails, output the generated brief in one fenced code
block and tell the user the Codex CLI was not found so they can run it elsewhere.
