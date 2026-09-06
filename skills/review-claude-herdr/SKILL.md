---
name: review-claude-herdr
description: Run a fresh Claude Code review in a visible, steerable sibling Herdr pane, then apply confident critical and important fixes. Use when the user invokes `$review-claude-herdr [focus]` or asks for a Claude review through Herdr. Use `review-claude-auto` for a detached Rudder review.
---

# review-claude-herdr

Build a tailored review prompt and run Claude Code in a sibling Herdr pane. The user
can watch and interact with the reviewer through the Herdr panel.

## Preconditions and prompt

Read and follow the installed `herdr` skill. Require `HERDR_ENV=1`; otherwise tell the
user to start Herdr and invoke this skill again. Do not fall back to Rudder.

Treat trailing text as a focus hint. Inspect the real diff, relevant project/domain
instructions, and load-bearing hunks. Record a fixed-path baseline when the tree is
dirty. Write `.scratch/<feature-slug>/review-claude-herdr.prompt.md`. Ask Claude to
group findings by file as `:line -- issue -- suggested fix`, tag severity, skip cosmetic
nits, flag uncertainty, and inspect the diff itself.

Append this block verbatim:

```text
After listing the findings, do not stop and do not wait for me to say "go fix". For each **critical** and **important** item where you are confident in the fix (or where your "suggested fix" note is concrete and self-contained), apply it directly to the files -- make the edit, don't just describe it. For items where you flagged uncertainty, where the fix would meaningfully change product behavior, or where it touches a deferred/out-of-scope area, leave a one-line `// TODO(review):` marker at the relevant spot instead of guessing.

Then, at the very end, print a **"Changes applied"** rundown:
- Group by file.
- For each edit: one line stating what changed and why, linking back to the finding number above.
- Separately list any items you intentionally did NOT apply, with one line each on why (uncertain / behavioral / deferred / out of scope).
- Note any follow-up the human should run (e.g. "regenerate convex types", "rerun typecheck", "set X env var") if the edits require it.
```

## Start and coordinate Claude

Use `claude-opus-5` by default, `claude-sonnet-5` for a routine narrow review, and
`claude-fable-5` for the highest-risk review. Honor an explicit choice. Split one
sibling pane without changing focus and preserve `$PWD`.

When the ordinary `claude` launcher owns valid authentication:

```sh
herdr agent start review_claude --kind claude --pane PANE_ID -- \
  --model claude-opus-5 --dangerously-skip-permissions --add-dir "$PWD"
```

On the Mac, prefer `/Users/safzan/.local/bin/claude-t3` when executable. Run that
launcher with `herdr pane run`, wait for Herdr to detect Claude, then assign the unique
name with `herdr agent rename PANE_ID review_claude`. Never inspect or copy its token.

Prompt the named agent from the fixed file with `--wait --timeout 3600000`. Inspect any
blocked state before responding and ask the user about approvals or behavioral choices.
Forward corrections into the same agent. After completion, read recent output, compare
the tree with the baseline, and verify the edits. Use a scratch report file only when
the alternate screen hides the final answer. Report the pane, paths, findings, changes,
and verification. Leave the pane open.

