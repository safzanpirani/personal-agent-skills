# Personal Agent Skills

Personal collection of heavily used agent skills.

## Sources

- Cursor Team Kit skills copied from `cursor/plugins` at commit `3347cbab5b54136f6fba0994c3a01a56f7fb7fca`:
  - `fix-merge-conflicts`
  - `make-pr-easy-to-review`
  - `thermo-nuclear-code-quality-review`

## Install

```bash
npx skills add https://github.com/safzanpirani/personal-agent-skills --skill '*' --agent '*' -g -y
```

## Skills

- `chrome-cdp` — interact with an explicitly approved local Chrome session through Chrome DevTools Protocol.
- `code-refactor-review` — review diffs for reuse, composition, codebase consistency, and slop.
- `deslop` — clean AI-generated code slop from branch diffs while preserving behavior.
- `diagnose` — run a disciplined bug/performance diagnosis loop from reproduction to regression test.
- `grill-me` — interview relentlessly about a plan or design until the decision tree is resolved.
- `handoff` — compact the current conversation into a handoff document for another agent.
- `quality-code` — apply full-stack TypeScript quality principles for types, tests, observability, and abstractions.
- `review-codex-auto` — generate a current-branch review prompt, run a second headless Codex instance with `codex exec`, and report its output.
- `write-a-prd` — turn a client brief into a local `issues/prd.md` product requirements document.
- `fix-merge-conflicts` — resolve merge conflicts non-interactively, validate build and tests, and finalize conflict resolution.
- `grill-with-docs` — grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation inline.
- `make-pr-easy-to-review` — prepare PRs by cleaning noisy history, improving descriptions, and adding reviewer guidance without behavior changes.
- `thermo-nuclear-code-quality-review` — extremely strict maintainability review for abstraction quality, giant files, and spaghetti-condition growth.
- `write-a-skill` — create new agent skills with proper structure, triggers, and optional references/scripts.
