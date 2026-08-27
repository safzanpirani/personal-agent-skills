---
name: solve-claude-auto
description: Delegate a hard, stuck, or context-heavy implementation task to a fresh, live-steerable Claude Code session managed by Rudder. Use when the user invokes `$solve-claude-auto [task]`, asks to hand work to another Claude, or a clean-context Claude should investigate, edit, and verify the current workspace end to end. For review of an existing diff use `review-claude-auto`.
metadata:
  short-description: Delegate implementation to Claude through Rudder
---

# solve-claude-auto

Package the task into a self-contained brief, then run a fresh Claude Code
session through Rudder so Claude investigates and implements the fix. This is
delegation, not consultation: the expected result is working, verified code.

Treat text after `$solve-claude-auto` as the task statement. Otherwise infer
the task from the current conversation. This consumes Claude quota; use
`solve-codex-auto` when the user wants the separate Codex budget.

## Build the brief

A fresh Claude session has none of the parent conversation. Include:

1. The concrete goal and completion condition.
2. What has already been tried, with exact errors, failing tests, or stack
   traces rather than paraphrases.
3. Load-bearing files and relevant symbols.
4. Exact reproduction and verification commands.
5. Constraints from `AGENTS.md`, `CLAUDE.md`, `CONTEXT-MAP.md`, relevant
   `CONTEXT.md`/ADRs, and the README.
6. Explicit scope fences and unrelated dirty changes to preserve.

Tell Claude to investigate before editing, implement the fix directly, run the
verification commands, iterate when they fail, and mark genuinely uncertain
behavioral choices with `// TODO(sub-claude):` rather than guessing.

Always append this block verbatim:

```text
Work autonomously to completion — do not stop to ask me for confirmation mid-task. Investigate, implement the fix directly in the files, then run the verify command(s) above and iterate until they pass (or until you've hit a genuine blocker).

At the very end, print a **"Handoff report"**:
- What the root cause turned out to be (one or two lines).
- Changes applied, grouped by file, one line each on what and why.
- Verification: the exact command you ran and its result (passed / still failing + the remaining error).
- Anything you deliberately did NOT do, with why (uncertain / behavioral / out of scope), and any follow-up the human must run (regenerate types, set env var, rerun migration, etc.).
```

## Prepare the workspace

Use fixed literal paths under `.scratch/<feature-slug>/`. Do not use shell
variables created in one tool call and assumed to exist in another. Never reuse
a prior run directory.

Before launch, capture `git status -sb` and a fixed-path pre-run diff so the
sub-Claude's changes remain attributable. Use a separate worktree for risky or
competing approaches. Preserve unrelated user changes.

Resolve Claude once, then substitute its absolute path for `CLAUDE_PATH`. Prefer
`/Users/safzan/.local/bin/claude-t3` when it exists and is executable; it reads
the long-lived setup token from the macOS Keychain, which the bare binary cannot
do in a detached process. Otherwise fall back to `command -v claude`. Do not
inspect or propagate credentials.

Choose one exact model ID for every launch:

- `claude-sonnet-5` for routine, bounded work when speed or quota conservation
  matters more than maximum capability.
- `claude-opus-5` for hard, stuck, or context-heavy implementation work. Use
  this model by default when the user has not selected another model.
- `claude-fable-5` for the hardest or highest-risk work when its higher cost is
  justified.

Honor an explicit user choice among these three models. Substitute the chosen
literal ID in the command instead of relying on the host's Claude default.

## Launch through Rudder

```bash
rudder run \
  --provider claude \
  --claude-path CLAUDE_PATH \
  --cwd "$PWD" \
  --prompt-file .scratch/<feature-slug>/solve-claude.prompt.md \
  --state-dir .scratch/<feature-slug>/solve-claude.run \
  --model claude-opus-5 \
  --effort high \
  --sandbox danger-full-access
```

Launch with the harness's background or ongoing-process facility. The Rudder
controller must remain alive while the parent agent monitors it; do not rely on
a foreground tool call with a short timeout.

Claude-specific rules:

- Always pass `--provider claude`; Rudder defaults to Codex.
- Always pass one of `--model claude-fable-5`,
  `--model claude-sonnet-5`, or `--model claude-opus-5` according to the
  selection rules above.
- `danger-full-access` maps to Claude's `bypassPermissions` and is appropriate
  for this autonomous edit/test skill. Use `workspace-write` only when network
  and out-of-workspace access are definitely unnecessary; use `read-only` for
  advisory consultation rather than implementation.
- Authentication belongs to the selected Claude CLI or configured wrapper.
  Never place tokens or secret contents in argv, prompts, artifacts, or logs.
- Claude supports resume through a known provider session ID, but not Rudder's
  Codex-only thread discovery/fork commands.

## Monitor and steer

```bash
rudder peek --state-dir .scratch/<feature-slug>/solve-claude.run -n 25
rudder status --state-dir .scratch/<feature-slug>/solve-claude.run --json
```

`trace.log` contains Claude's reasoning summaries, tool progress, commentary,
and terminal transitions. `rudder tui` presents the same run live.

Forward new user information immediately into the same active turn:

```bash
rudder steer --state-dir .scratch/<feature-slug>/solve-claude.run \
  "<exact steering update>"
```

Use `--message-file` for multiline or shell-sensitive updates. Confirm the
steer was accepted. If the turn already ended, inspect its terminal result; do
not silently create a replacement. Never launch a competing run for the same
task while one is active.

For cancellation or a fundamentally wrong premise, use
`rudder interrupt --state-dir ...` rather than killing the process.

## Wait and verify

Wait with an explicit bound:

```bash
rudder wait --state-dir .scratch/<feature-slug>/solve-claude.run --timeout 1h
rudder status --state-dir .scratch/<feature-slug>/solve-claude.run --json
```

Trust `output.md` only when the final status is `completed`. On `failed`,
`interrupted`, or `stale`, report the state and remaining error; partial output
is not a successful handoff. Cross-check Claude's claimed changes against the
pre-run baseline and rerun proportionate verification independently.

Report the prompt, run, trace, and output paths; the Handoff report; exact
verification evidence; and whether changes are local, committed, or pushed.

## Continue the same Claude session

Selection order within one parent session is:

1. If the recorded run is active, steer it.
2. If it is terminal and this is a direct continuation, obtain its exact
   `threadId` from `rudder status --json`, write a continuation prompt, create a
   new run directory, and add `--resume-thread THREAD_ID` to the Claude Rudder
   command.
3. Otherwise start fresh.

Do not use `rudder thread list/search/read`, `--fork-thread`, or turn-boundary
selectors for Claude. Do not guess among old session IDs or silently fall back
to fresh after a resume failure.

## Fallback

If Rudder is unavailable but Claude exists, run this non-steerable fallback
through the harness's background facility:

```bash
claude -p --output-format stream-json --verbose \
  --model claude-opus-5 \
  --dangerously-skip-permissions --add-dir "$PWD" \
  < .scratch/<feature-slug>/solve-claude.prompt.md \
  > .scratch/<feature-slug>/solve-claude.live.jsonl 2>&1
```

Extract the final result only after exit. If Claude is also unavailable,
provide the generated brief and report the missing tools.
