---
name: review-codex-herdr
description: Run a fresh Codex review in a visible, steerable sibling Herdr pane, then apply confident critical and important fixes. Use when the user invokes `$review-codex-herdr [focus]` or asks to review the current diff through Herdr. Use `review-codex-auto` for a detached Rudder review.
---

# review-codex-herdr

Build a tailored review prompt and run Codex in a sibling Herdr pane. The user can
watch, focus, and interact with the reviewer in the Herdr panel.

## Preconditions

Read and follow the installed `herdr` skill. Before controlling the session, require:

```sh
test "${HERDR_ENV:-}" = 1
```

If this fails, tell the user to launch `herdr`, start their current agent inside a
pane, and invoke this skill again. Do not fall back to Rudder or control a session
from outside Herdr.

## Prepare the review

Treat text after the skill name as a focus hint. Inspect `git status -sb`, diff stats,
the appropriate working-tree or merge-base diff, and relevant project instructions.
Infer the change intent and select 3-6 review angles anchored to real files. Record a
fixed-path pre-run diff under `.scratch/<feature-slug>/` when the tree is dirty.

Write the prompt to `.scratch/<feature-slug>/review-codex-herdr.prompt.md`. It must ask
Codex to inspect the real diff, group findings by file as
`:line -- issue -- suggested fix`, tag each finding `critical`, `important`, or `nit`,
skip cosmetic nits, and flag uncertainty.

Append this block verbatim:

```text
After listing the findings, do not stop and do not wait for me to say "go fix". For each **critical** and **important** item where you are confident in the fix (or where your "suggested fix" note is concrete and self-contained), apply it directly to the files -- make the edit, don't just describe it. For items where you flagged uncertainty, where the fix would meaningfully change product behavior, or where it touches a deferred/out-of-scope area, leave a one-line `// TODO(review):` marker at the relevant spot instead of guessing.

Then, at the very end, print a **"Changes applied"** rundown:
- Group by file.
- For each edit: one line stating what changed and why, linking back to the finding number above.
- Separately list any items you intentionally did NOT apply, with one line each on why (uncertain / behavioral / deferred / out of scope).
- Note any follow-up the human should run (e.g. "regenerate convex types", "rerun typecheck", "set X env var") if the edits require it.
```

## Start and coordinate Codex

Inspect the caller layout. Split right when the pane is wide and down when it is tall.
Preserve `$PWD` and use `--no-focus`. Parse the new pane ID from JSON.

Start a uniquely named agent such as `review_codex`:

```sh
herdr agent start review_codex --kind codex --pane PANE_ID -- \
  -m gpt-5.6-sol --dangerously-bypass-approvals-and-sandbox
```

Add the installed Codex effort flag for a subtle or high-risk diff. Submit the prompt
from the fixed file and wait up to one hour:

```sh
herdr agent prompt review_codex "$(cat .scratch/<feature-slug>/review-codex-herdr.prompt.md)" \
  --wait --timeout 3600000
```

If the agent becomes blocked, read its state and pane output. Ask the user before
answering an approval or behavioral question. Forward user updates with another
`herdr agent prompt`; use `send-keys ... ctrl+c` only when the user cancels.

After completion, read recent unwrapped output and compare `git status -sb` with the
baseline. If the alternate screen hides the final report, ask Codex to write it to a
fixed Markdown file under the scratch directory, then read that file. Report the pane
name, prompt path, findings, applied changes, and verification. Leave the pane open.

