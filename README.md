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

## Local topology

This repository is the canonical source for shared personal skills. The
checked-in manifest at `scripts/managed-skills.txt` selects the skills that the
local sync command manages.

```bash
./scripts/sync-installed-skills.sh --check
./scripts/sync-installed-skills.sh --apply
```

The command mirrors each managed skill into `~/.agents/skills` and verifies a
deterministic SHA-256 tree hash. The command creates a Claude symlink only when
the corresponding `~/.claude/skills` entry is missing. It preserves direct
Claude directories as runtime-specific overrides. Codex discovers the shared
`.agents/skills` tree directly. The command does not modify independent copies
under `~/.codex/skills`.

`proofshot` stays outside the managed manifest because its Claude and Codex
installations carry runtime-specific guidance.

## Skills

- `bun-cli` — build a single-purpose CLI in Bun + TypeScript (pure core, thin frontends, hand-rolled flags, optional MCP server sharing the same core); ships a scaffold script.
- `bun-tui` — make a CLI's terminal output look designed: an escalation ladder from styled lines to live redraw to a fullscreen OpenTUI app, a Theme resolved once from the environment, pure snapshot-testable renderers, and the cell-width/ANSI/degradation rules; ships a scaffold for `render.ts` + `theme.ts` + tests. Pairs with `bun-cli`; defers to the upstream [`opentui`](https://github.com/anomalyco/opentui) skill for OpenTUI APIs.
- `chrome-cdp` — interact with an explicitly approved local Chrome session through Chrome DevTools Protocol.
- `code-refactor-review` — review diffs for reuse, composition, codebase consistency, and slop.
- `deslop` — clean AI-generated code slop from branch diffs while preserving behavior.
- `diagnose` — run a disciplined bug/performance diagnosis loop from reproduction to regression test.
- `grill-me` — interview relentlessly about a plan or design until the decision tree is resolved.
- `hallmark` — anti-AI-slop design skill for greenfield pages, audits, redesigns, and design extraction from URLs or screenshots.
- `handoff` — compact the current conversation into a handoff document for another agent.
- `i-have-adhd` — shape every response for an ADHD reader: lead with next actions, number steps, externalize state, cut tangents.
- `proofshot` — verify UI work in a real browser and hand back video proof, screenshots, and console/server error reports; "give me a before and after" checks out the base commit into a throwaway git worktree and records the same flow against old and new code. Requires the [`safzanpirani/proofshot`](https://github.com/safzanpirani/proofshot) fork of [`AmElmo/proofshot`](https://github.com/AmElmo/proofshot) plus [`agent-browser`](https://github.com/vercel-labs/agent-browser).
- `quality-code` — apply full-stack TypeScript quality principles for types, tests, observability, and abstractions.
- `read-project-memory` — load Claude Code's persistent per-project memory into other agent harnesses, with full, index-only, and file-list modes.
- `tandem-loop` — run one task through a multi-model plan → work → check loop using opencode as the harness (e.g. Kimi plans, DeepSeek implements, Kimi verifies, repeat until done); ships a headless script and native opencode agents.
- `review-codex-auto` — run a fresh, live-steerable Codex review through Rudder and apply confident critical and important fixes.
- `review-claude-auto` — run a fresh, live-steerable Claude review through Rudder and apply confident critical and important fixes.
- `solve-codex-auto` — delegate difficult implementation work to a live-steerable Codex Rudder session that investigates, edits, and verifies the current workspace.
- `solve-claude-auto` — delegate difficult implementation work to a live-steerable Claude Rudder session that investigates, edits, and verifies the current workspace.

The four `review-*-auto` and `solve-*-auto` skills rely on [Rudder](http://github.com/safzanpirani/rudder) for live steering and session management. Their direct Codex or Claude CLI paths provide non-steerable fallbacks when Rudder is unavailable.

- `write-a-prd` — turn a client brief into a local `issues/prd.md` product requirements document.
- `fix-merge-conflicts` — resolve merge conflicts non-interactively, validate build and tests, and finalize conflict resolution.
- `grill-with-docs` — grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation inline.
- `make-pr-easy-to-review` — prepare PRs by cleaning noisy history, improving descriptions, and adding reviewer guidance without behavior changes.
- `thermo-nuclear-code-quality-review` — extremely strict maintainability review for abstraction quality, giant files, and spaghetti-condition growth.
- `write-a-skill` — create new agent skills with proper structure, triggers, and optional references/scripts.
