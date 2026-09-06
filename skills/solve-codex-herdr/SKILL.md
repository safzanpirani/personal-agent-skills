---
name: solve-codex-herdr
description: Delegate a hard implementation task to a visible, steerable Codex agent in a sibling Herdr pane. Use when the user invokes `$solve-codex-herdr [task]` or asks another Codex to investigate, edit, and verify through Herdr. Use `solve-codex-auto` for detached Rudder delegation.
---

# solve-codex-herdr

Package the task into a standalone brief and run a fresh Codex agent in a sibling
Herdr pane. Codex must investigate, implement, and verify the solution.

## Preconditions

Read and follow the installed `herdr` skill. Require `HERDR_ENV=1`. If the caller is
outside Herdr, tell the user to start Herdr and invoke this skill again. Do not replace
the requested workflow with Rudder.

## Build the brief

Treat text after the skill name as the task. Otherwise infer it from current context.
Include the completion condition, exact failing evidence, prior attempts, load-bearing
files, reproduction and verification commands, project instructions, scope fences,
and unrelated dirty work to preserve. Tell Codex to investigate before editing and to
mark uncertain behavioral choices with `// TODO(codex):`.

Record `git status -sb` and a fixed-path pre-run diff. Write the brief to
`.scratch/<feature-slug>/solve-codex-herdr.prompt.md`. Append this block verbatim:

```text
Work autonomously to completion — do not stop to ask me for confirmation mid-task. Investigate, implement the fix directly in the files, then run the verify command(s) above and iterate until they pass (or until you've hit a genuine blocker).

At the very end, print a **"Handoff report"**:
- What the root cause turned out to be (one or two lines).
- Changes applied, grouped by file, one line each on what and why.
- Verification: the exact command you ran and its result (passed / still failing + the remaining error).
- Anything you deliberately did NOT do, with why (uncertain / behavioral / out of scope), and any follow-up the human must run (regenerate types, set env var, rerun migration, etc.).
```

## Start and coordinate Codex

Inspect the caller layout, create one sibling pane in the useful direction, preserve
`$PWD`, keep focus on the caller, and parse the pane ID from JSON. Choose a unique
agent name such as `solve_codex`.

```sh
herdr agent start solve_codex --kind codex --pane PANE_ID -- \
  -m gpt-5.6-sol --dangerously-bypass-approvals-and-sandbox
herdr agent prompt solve_codex "$(cat .scratch/<feature-slug>/solve-codex-herdr.prompt.md)" \
  --wait --timeout 3600000
```

Use high effort for a genuinely subtle problem. If Codex becomes blocked, inspect the
agent state and output. Ask the user before answering approvals or questions that
change behavior. Send new user context into the same agent. Do not start a competing
agent for the same task. Use `send-keys ... ctrl+c` only when the user cancels.

When settled, read recent unwrapped output, compare the working tree with the baseline,
and rerun proportionate verification. If the alternate screen hides the report, ask
Codex to write it to a fixed scratch Markdown file. Report the pane name, prompt path,
handoff, verification, and whether changes are local, committed, or pushed. Leave the
pane open for follow-up.

