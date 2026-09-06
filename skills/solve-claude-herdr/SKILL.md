---
name: solve-claude-herdr
description: Delegate a hard implementation task to a visible, steerable Claude Code agent in a sibling Herdr pane. Use when the user invokes `$solve-claude-herdr [task]` or asks another Claude to investigate, edit, and verify through Herdr. Use `solve-claude-auto` for detached Rudder delegation.
---

# solve-claude-herdr

Package the task into a standalone brief and run Claude Code in a sibling Herdr pane.
Claude must investigate, implement, and verify the solution.

## Preconditions and brief

Read and follow the installed `herdr` skill. Require `HERDR_ENV=1`; otherwise tell the
user to start Herdr and retry. Do not fall back to Rudder.

Include the goal, completion condition, exact failures, prior attempts, load-bearing
files, reproduction and verification commands, repo instructions, scope fences, and
unrelated dirty work. Tell Claude to investigate before editing and mark uncertain
behavioral choices with `// TODO(sub-claude):`. Record a fixed-path working-tree
baseline. Write `.scratch/<feature-slug>/solve-claude-herdr.prompt.md` and append:

```text
Work autonomously to completion — do not stop to ask me for confirmation mid-task. Investigate, implement the fix directly in the files, then run the verify command(s) above and iterate until they pass (or until you've hit a genuine blocker).

At the very end, print a **"Handoff report"**:
- What the root cause turned out to be (one or two lines).
- Changes applied, grouped by file, one line each on what and why.
- Verification: the exact command you ran and its result (passed / still failing + the remaining error).
- Anything you deliberately did NOT do, with why (uncertain / behavioral / out of scope), and any follow-up the human must run (regenerate types, set env var, rerun migration, etc.).
```

## Start and coordinate Claude

Use `claude-opus-5` by default, `claude-sonnet-5` for bounded routine work, and
`claude-fable-5` for the hardest or highest-risk task. Honor an explicit choice. Split
one sibling pane in the useful direction, preserve `$PWD`, and keep focus on the caller.

When the ordinary launcher owns valid authentication:

```sh
herdr agent start solve_claude --kind claude --pane PANE_ID -- \
  --model claude-opus-5 --dangerously-skip-permissions --add-dir "$PWD"
```

On the Mac, prefer `/Users/safzan/.local/bin/claude-t3` when executable. Start it with
`herdr pane run`, wait for Claude detection, and rename that pane's detected agent to
`solve_claude`. Never inspect or propagate credentials.

Prompt the named agent from the fixed file with `--wait --timeout 3600000`. If Claude
blocks, inspect its state and output and ask the user before answering approvals or
behavior-changing questions. Forward updates into the same agent. Do not launch a
competing solve. Use `send-keys ... ctrl+c` only when the user cancels.

When settled, read recent unwrapped output, compare against the baseline, and rerun
proportionate verification independently. Ask Claude for a fixed scratch report file
only if terminal output is unrecoverable. Report the pane, prompt path, handoff,
verification, and whether edits are local, committed, or pushed. Leave the pane open.

