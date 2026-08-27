---
name: review-claude-auto
description: Generate a tailored review prompt and run it through a fresh, live-steerable Claude Code session managed by Rudder, then apply confident critical and important fixes. Use for a Claude review of the current diff or when the user invokes `$review-claude-auto [focus hint]`.
metadata:
  short-description: Run a live-steerable Claude review through Rudder
---

# review-claude-auto

Build a tailored review prompt, then run a fresh Claude Code session through
Rudder. The reviewer must inspect the real diff, report findings, and apply
confident critical and important fixes. Do not merely print the prompt unless
both Rudder and Claude Code are unavailable or the user asks for prompt-only
output.

Treat text after `$review-claude-auto` as a focus hint.

## Inspect and prepare

1. Run `git status -sb`, `git diff --stat`, and the appropriate working-tree or
   `<merge-base>...HEAD` diff. Sample the load-bearing hunks when the diff is
   large.
2. Read relevant `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTEXT-MAP.md`,
   `CONTEXT.md`, and ADRs. Preserve repo-local instructions and unrelated dirty
   changes.
3. Infer the change intent and choose 3-6 review angles anchored to actual
   files. Weight them toward the user's focus hint.
4. Record a pre-run baseline for dirty trees, such as a fixed-path patch under
   the task scratch directory, so Claude's edits remain attributable. Use a
   separate worktree when the review is risky enough to require isolation.

The prompt must ask Claude to inspect the real diff; group findings by file as
`:line -- issue -- suggested fix` tagged `critical`, `important`, or `nit`;
skip cosmetic nits unless they conceal a bug; flag uncertainty; and apply
confident critical and important fixes directly.

Always append this block verbatim:

```text
After listing the findings, do not stop and do not wait for me to say "go fix". For each **critical** and **important** item where you are confident in the fix (or where your "suggested fix" note is concrete and self-contained), apply it directly to the files -- make the edit, don't just describe it. For items where you flagged uncertainty, where the fix would meaningfully change product behavior, or where it touches a deferred/out-of-scope area, leave a one-line `// TODO(review):` marker at the relevant spot instead of guessing.

Then, at the very end, print a **"Changes applied"** rundown:
- Group by file.
- For each edit: one line stating what changed and why, linking back to the finding number above.
- Separately list any items you intentionally did NOT apply, with one line each on why (uncertain / behavioral / deferred / out of scope).
- Note any follow-up the human should run (e.g. "regenerate convex types", "rerun typecheck", "set X env var") if the edits require it.
```

## Launch through Rudder

Use fixed literal paths under `.scratch/<feature-slug>/`; do not reuse a prior
run directory. Resolve Claude once and substitute that absolute path for
`CLAUDE_PATH`. Prefer `/Users/safzan/.local/bin/claude-t3` when it exists and is
executable; it reads the long-lived setup token from the macOS Keychain, which
the bare binary cannot do in a detached process. Otherwise fall back to
`command -v claude`. This avoids PATH differences in detached processes without
exposing authentication data.

Choose one exact model ID for every launch:

- `claude-sonnet-5` for a narrow, routine review when speed or quota
  conservation matters more than maximum capability.
- `claude-opus-5` for complex or context-heavy reviews. Use this model by
  default when the user has not selected another model.
- `claude-fable-5` for the hardest, security-sensitive, or highest-risk reviews
  when its higher cost is justified.

Honor an explicit user choice among these three models. Substitute the chosen
literal ID in the command instead of relying on the host's Claude default.

```bash
rudder run \
  --provider claude \
  --claude-path CLAUDE_PATH \
  --cwd "$PWD" \
  --prompt-file .scratch/<feature-slug>/review-claude.prompt.md \
  --state-dir .scratch/<feature-slug>/review-claude.run \
  --model claude-opus-5 \
  --effort high \
  --sandbox danger-full-access
```

Launch it with the harness's background or ongoing-process facility so Rudder
stays alive while this agent monitors and steers it. Do not use a foreground
tool call that will be killed by a short timeout.

Claude-specific rules:

- Keep `--provider claude`; Rudder otherwise defaults to Codex.
- Always pass one of `--model claude-fable-5`,
  `--model claude-sonnet-5`, or `--model claude-opus-5` according to the
  selection rules above.
- `danger-full-access` maps to Claude's `bypassPermissions`, matching this
  skill's autonomous edit-and-test behavior. Use `read-only` only for an
  explicitly advisory review with no edits.
- Never pass credentials, OAuth tokens, or environment-file contents. Claude
  authentication remains owned by the resolved CLI or its configured wrapper.
- Do not use `rudder thread ...` or `--fork-thread` for Claude; those are Codex
  facilities. A new review is fresh by default.

## Monitor, steer, and finish

```bash
rudder peek --state-dir .scratch/<feature-slug>/review-claude.run -n 25
rudder status --state-dir .scratch/<feature-slug>/review-claude.run --json
rudder wait --state-dir .scratch/<feature-slug>/review-claude.run --timeout 1h
```

`trace.log` contains readable reasoning summaries, tool lifecycle, commentary,
and terminal state. `rudder tui` shows the session live. `output.md` contains
completed assistant messages in order.

Forward user corrections into the active turn immediately:

```bash
rudder steer --state-dir .scratch/<feature-slug>/review-claude.run \
  "<exact steering update>"
```

Use `--message-file` for multiline or shell-sensitive steering. Use
`rudder interrupt --state-dir ...` when the user cancels or the premise is
invalid; do not kill the process or start a competing run.

After the bounded wait, inspect `status --json` first. Trust `output.md` only
when status is `completed`; on `failed`, `interrupted`, or `stale`, report that
state rather than presenting partial output as success. Cross-check the working
tree and relevant verification commands yourself.

Report the prompt path, run directory, trace path, Claude's final report,
verification evidence, and which changes are attributable to the review.

## Direct follow-up

Steer an active run. If it is terminal and continuity is explicitly useful,
read its `threadId` from `rudder status --json`, create a new prompt and a new
run directory, and add `--resume-thread THREAD_ID`. Do not guess a Claude
session ID, resume an active turn, or silently replace a failed resume with a
fresh review.

## Fallback

If Rudder is unavailable but Claude exists, use the non-steerable fallback:

```bash
claude -p --output-format stream-json --verbose \
  --model claude-opus-5 \
  --dangerously-skip-permissions --add-dir "$PWD" \
  < .scratch/<feature-slug>/review-claude.prompt.md \
  > .scratch/<feature-slug>/review-claude.live.jsonl 2>&1
```

Run it through the harness's background facility and extract the final result
only after exit. If Claude is also unavailable, provide the prompt and report
the missing tools.
