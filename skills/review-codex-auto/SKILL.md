---
name: review-codex-auto
description: Generate a tailored review prompt and run a second Codex instance with codex exec to review and fix current changes. Use only when the user invokes /review-codex-auto, $review-codex-auto, or explicitly asks to auto-run a Codex review from Codex CLI headless mode.
---

# Review Codex Auto

Use this skill only on explicit invocation. It launches another Codex instance through `codex exec`, so avoid implicit recursion.

## Goal

Generate a targeted review prompt for the current branch, run that prompt through a second headless Codex instance, and report the second instance's final output.

## Codex CLI Shape

Use plain `codex exec`, not `codex exec review`, because the prompt requires the reviewer to apply confident fixes after listing findings.

```bash
codex exec -C "$PWD" -s workspace-write -o "$OUTPUT_FILE" - < "$PROMPT_FILE"
```

- `-C "$PWD"` keeps the review in the current repo.
- `-` reads the generated prompt from stdin.
- `-s workspace-write` allows edits while keeping sandboxing enabled.
- `-o "$OUTPUT_FILE"` saves the final reviewer message.
- Do not use `--dangerously-bypass-approvals-and-sandbox` unless the user explicitly asks.

## Build The Review Prompt

1. Inspect scope with `git status -sb`, `git diff --stat`, and a few load-bearing `git diff` hunks.
2. If on a feature branch, include the base diff stat from `git diff $(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master)...HEAD --stat`.
3. Read relevant context if present: `CLAUDE.md`, `AGENTS.md`, `README.md`, and `docs/architecture*`.
4. Infer one-line intent.
5. Choose 3-6 concrete review angles anchored to changed files.
6. Include any user focus hint.

The generated prompt must tell the second Codex to:
- Run the relevant git diff commands itself.
- Group findings by file.
- Use `:line -- issue -- suggested fix`, tagged `critical / important / nit`.
- Skip pure style/naming nits unless they hide a bug.
- Flag uncertainty instead of guessing.
- After listing findings, apply confident `critical` and `important` fixes directly.
- Leave `// TODO(review):` markers for uncertain, behavioral, deferred, or out-of-scope fixes.
- End with a grouped `Changes applied` rundown and follow-up commands the human should run.

## Report Back

After `codex exec` completes, read the output file and summarize:
- prompt file path
- output file path
- Codex final message
- any files the second Codex says it changed

If `codex` is missing, return the generated prompt instead and state that the CLI was unavailable.

