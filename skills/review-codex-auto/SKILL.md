---
name: review-codex-auto
description: Generate a tailored Codex review prompt and run it through a live-steerable Codex Rudder session so Codex reviews and applies confident fixes to the current branch. Uses a fresh thread for fresh-eyes review by default, with deliberate discovery/resume/fork support for matching review continuations. Use when the user invokes `$review-codex-auto [focus hint]`, asks for a fresh-eyes Codex review of the current diff, or wants to spawn a sub-Codex reviewer that auto-applies critical/important fixes. Do not use for one-shot prompt generation without execution — that is `review-codex` territory.
metadata:
  short-description: Auto-run a live-steerable fresh Codex review
---

# review-codex-auto

Your job: generate a tailored review prompt for Codex, then automatically run it through a Codex CLI subprocess in headless mode. Use a fresh thread for the first fresh-eyes pass; use the same completed Rudder thread for a matching follow-up so the reviewer retains its prior findings and fixes. Do not merely print the prompt unless the Codex CLI is unavailable or the user explicitly asks for prompt-only output.

If the user invoked this with `$review-codex-auto <text>`, treat any text after the skill name as a **focus hint** and weight the review angles toward it.

## Dependency

This skill relies on [Rudder](http://github.com/safzanpirani/rudder) for live steering and session management. The direct Codex CLI path provides a non-steerable fallback when Rudder is unavailable.

## Steerable Codex command

Prefer Codex Rudder. It owns a `codex app-server` connection, streams progress,
and exposes `turn/steer` while the review is still running. Use a normal
prompt-driven turn, not app-server `review/start`, because native review turns
may reject same-turn steering and this prompt also asks Codex to apply fixes.

Preferred command pattern (substitute fixed literal paths):

```bash
rudder run \
  --cwd "$PWD" \
  --prompt-file "$PROMPT_FILE" \
  --state-dir "$RUN_DIR" \
  --model gpt-5.6-sol \
  --sandbox danger-full-access
```

Notes:
- `--cwd "$PWD"` keeps the sub-Codex in the current repo.
- `--sandbox danger-full-access` is the default for this skill (user policy, 2026-07-23): the
  sandbox's network block breaks fleet/ssh, package installs, and live-endpoint verification.
- Rudder writes `events.jsonl`, `trace.log`, `output.md`, and `state.json` under `$RUN_DIR`.
- Add `--effort high` for a hard/subtle diff.

Fallback only when `command -v rudder` fails:

```bash
codex exec --json -C "$PWD" --dangerously-bypass-approvals-and-sandbox -m gpt-5.6-sol -o "$OUTPUT_FILE" - < "$PROMPT_FILE" > "$LIVE_LOG" 2>&1
```

## Thread discovery, resume, and fork

Fresh eyes are part of this skill's purpose, so a fresh thread remains the
default for the first review of a change. If the same parent agent session
already launched `review-codex-auto` for this change, however, its Rudder
thread is the preferred context for a follow-up: steer it while active or resume
it after completion. That lets Codex retain its codebase exploration, findings,
fixes already applied, and unresolved review context. Also use prior history
when the user explicitly asks to continue, revisit, or branch an earlier Codex
review. Do not start a competing review while the matching turn is active.

Discover and inspect candidates before selecting one:

```bash
rudder thread list \
  --limit 20 --cwd-filter "$PWD"
rudder thread search \
  --limit 10 "<distinctive review keywords>"
rudder thread read \
  --include-turns THREAD_ID
rudder thread turns \
  --limit 20 THREAD_ID
```

`thread search` is global, so verify the candidate's `cwd` exactly matches
`$PWD`; never select from a snippet alone. Confirm the reviewed diff/intent and
recent outcome using `thread read --include-turns`. If the run uses a private
app-server child after `--`, use the same child command for discovery so both
operations use the same history/auth backend.

Choose exactly one mode:

- **Fresh (normal review):** use the ordinary `rudder run` command. This is
  mandatory for a requested fresh-eyes review or whenever candidates are
  absent, ambiguous, unrelated, or based on an obsolete diff.
- **Resume:** prefer this for a direct follow-up when the same parent session
  previously ran this skill for the current change and its Rudder turn is now
  terminal. Its recorded `$RUN_DIR` / `threadId` is already an unambiguous
  match. Also resume a single exact match found through discovery. Add
  `--resume-thread THREAD_ID`. Tell Codex what changed in the diff since its
  previous turn and ask it to re-check prior unresolved findings rather than
  re-exploring and duplicating the original review.
- **Fork:** when earlier review context is useful but a new review should test
  another hypothesis or preserve the original conversation, add
  `--fork-thread THREAD_ID`. Optionally use `--fork-before-turn TURN_ID` to
  exclude that turn and everything after it, or `--fork-through-turn TURN_ID`
  to include history through it. The two selectors are mutually exclusive.

A conversation fork does not create a Git worktree or restore the old diff.
Revalidate the current working tree and keep the dirty-tree guard. Never resume
or fork an active turn; steer it. Never silently choose among ambiguous matches
or fall back to fresh after a resume/fork error. Optionally name a useful thread
with `rudder thread name THREAD_ID "review: <short focus>"` so later discovery
does not depend only on prompt previews.

Selection order within one parent session is therefore: steer its active Rudder
review; otherwise resume its completed matching review; otherwise discover an
older exact match; otherwise start a fresh-eyes review. Fork instead of resume
when the user wants a separate review path that preserves the source thread.

## How to build the Codex prompt

1. Inspect the change scope:
   - `git status -sb`
   - `git diff --stat`
   - If on a feature branch: `git diff $(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master)...HEAD --stat`
   - Sample a few load-bearing hunks from `git diff`; do not read the whole diff if it is huge.

2. Infer the intent in one line: bugfix, refactor, new feature, migration, perf work, security fix, dependency bump, etc.

3. Read project context if present and relevant: `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/architecture*`. Pull out conventions or constraints the sub-Codex would not infer from the diff alone.

4. Pick 3-6 review angles that actually matter for this diff, anchored to specific files:
   - Migration: backward compatibility, rollback, idempotency, lock duration, `NOT NULL` on existing rows.
   - Auth/permissions: authorization boundary, token storage, session invalidation, IDOR.
   - UI: accessibility, loading/error states, performance on large lists, mobile.
   - Refactor: behavior preservation, callsite coverage, dead code left behind.
   - API: backward compatibility, error shapes, rate limits, input validation.

5. Weight the review angles toward any user focus hint.

## Required contents of the generated Codex prompt

The prompt you pass to the sub-Codex must include:
- One-line intent statement.
- Instruction for Codex to run `git status -sb`, `git diff --stat`, and `git diff` or the appropriate `<base>...HEAD` diff itself.
- Specific concerns anchored to filenames or hunks.
- Non-obvious project conventions from local docs.
- Findings format: group by file. Under each file, list findings as `:line -- issue -- suggested fix`, each tagged `critical / important / nit`.
- Instruction to skip pure style/naming nits unless they hide a bug.
- Instruction to flag uncertainty instead of guessing silently.

Always include this autonomous fix-and-report block verbatim:

```text
After listing the findings, do not stop and do not wait for me to say "go fix". For each **critical** and **important** item where you are confident in the fix (or where your "suggested fix" note is concrete and self-contained), apply it directly to the files -- make the edit, don't just describe it. For items where you flagged uncertainty, where the fix would meaningfully change product behavior, or where it touches a deferred/out-of-scope area, leave a one-line `// TODO(review):` marker at the relevant spot instead of guessing.

Then, at the very end, print a **"Changes applied"** rundown:
- Group by file.
- For each edit: one line stating what changed and why, linking back to the finding number above.
- Separately list any items you intentionally did NOT apply, with one line each on why (uncertain / behavioral / deferred / out of scope).
- Note any follow-up the human should run (e.g. "regenerate convex types", "rerun typecheck", "set X env var") if the edits require it.
```

> **Paths must be fixed literals, not `mktemp`-into-a-shell-var.** Each Bash tool call is a fresh shell — a var set in one call is empty in the next, silently breaking the run. Use stable paths under your scratchpad dir and reuse them verbatim (or write-prompt + launch in one Bash call). Never pipe codex to `| tail` — that discards the `-o` final message; keep `-o`.

## Execution steps

> **Dirty-tree guard:** before launching, run `git status -sb`; if the tree has
> uncommitted changes, snapshot the baseline first (`git stash create` and record
> the hash, or save `git diff > $SCRATCH/pre-run.diff`) so the sub-Codex's edits
> stay attributable afterwards. For risky runs, prefer a separate `git worktree`.

1. Pick fixed paths, e.g. `PROMPT_FILE=$SCRATCH/review-codex.prompt.md` and `RUN_DIR=$SCRATCH/review-codex.run`. Rudder's final output is `$RUN_DIR/output.md`, raw event log is `$RUN_DIR/events.jsonl`, and readable trace is `$RUN_DIR/trace.log`.
2. Write the generated Codex prompt to `$PROMPT_FILE`.
3. Launch the Rudder command above **with `run_in_background: true`** so control returns immediately and you can watch or steer the review (foreground runs get killed at the Bash-tool timeout).

Always pass **`--model gpt-5.6-sol`** (the user's configured default and standing preference). Do
not substitute `gpt-5.5` or an older model. Add `--effort high` for a hard/subtle diff.

4. While it runs, peek as useful (see [Monitoring](#monitoring)). When it exits: wait bounded, never unbounded: `rudder wait --state-dir "$RUN_DIR" --timeout 3600s` (`--timeout` takes a Go duration (`3600s`, `1h`); the default `0` waits forever; `rudder run` also has a one-hour turn watchdog unless `--turn-timeout 0` is explicitly passed). When it ends, check `rudder status --state-dir "$RUN_DIR" --json` first: trust `$RUN_DIR/output.md` only when `status` is `completed`; on `failed`/`interrupted`, report the `error` field instead (`output.md` may not exist at all on failure). `output.md` contains completed agent messages in order; use `$RUN_DIR/events.jsonl` when the raw event sequence is needed.
5. Report:
   - where the prompt file was written
   - where the Rudder run directory, trace, and Codex output file were written
   - the sub-Codex's final message
   - whether the sub-Codex changed files (cross-check with `git status -sb` after the run)

## Monitoring

Codex runs detached behind Rudder; watch its progress without blocking:

- **Peek on demand** — `rudder peek --state-dir "$RUN_DIR" -n 25` renders reasoning, commands, messages, steering, and terminal state.
- **Machine-readable status** — `rudder status --state-dir "$RUN_DIR" --json` reports the active thread/turn IDs and steer count.
- **Auto-wake on a condition** — point the `Monitor` tool at `$RUN_DIR/trace.log` or `$RUN_DIR/state.json` instead of polling.

## Live steering

If the user adds or corrects information while the review is active, forward it
into the same turn instead of waiting for completion or restarting Codex:

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
`command -v codex` also fails, output the generated prompt in one fenced code
block and tell the user the Codex CLI was not found.
