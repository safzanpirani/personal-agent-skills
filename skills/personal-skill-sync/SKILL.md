---
name: personal-skill-sync
description: Reconciles Safzan's shared personal agent skills from the canonical public repository into `.agents` and Claude links while preserving runtime-specific overrides. Use when asked to sync, reconcile, install, validate, or publish personal agent skills across Codex and Claude.
---

# Personal skill sync

Use `/Users/safzan/Development/projects/personal-agent-skills` as the canonical
source for shared skills. The installed mirror lives under
`/Users/safzan/.agents/skills`.

## Check current drift

Run these commands from any directory:

```bash
repo=/Users/safzan/Development/projects/personal-agent-skills
git -C "$repo" status --short --branch
"$repo/scripts/sync-installed-skills.sh" --check
```

The check command exits 1 when it finds drift. Report `MISSING`, `DRIFT`,
`CLAUDE_LINK_MISSING`, and `CLAUDE_LINK_DRIFT`. Treat `CLAUDE_OVERRIDE` as an
intentional direct directory.

Stop after the report when the user asks only for an audit or status check.

## Apply a requested sync

1. Inspect the canonical repository's dirty state. Identify changes that affect
   managed skill directories. Preserve unrelated work.
2. Run `scripts/sync-installed-skills.sh --apply` when the user asks to sync,
   reconcile, or install the shared skills.
3. Run `scripts/sync-installed-skills.sh --check` again. Require `RESULT OK`.
4. Validate every changed source skill with:

   ```bash
   python3 /Users/safzan/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
     "$repo/skills/<skill-name>"
   ```

The sync command verifies deterministic SHA-256 tree hashes. It creates only
missing Claude links. It preserves direct Claude directories.

## Preserve runtime boundaries

- Keep `proofshot` outside `scripts/managed-skills.txt` unless the user asks to
  reconcile its Claude and Codex variants.
- Do not modify independent `/Users/safzan/.codex/skills` copies unless the user
  names them as part of the task.
- Do not replace a direct Claude directory with a symlink.
- Do not commit `PAPERCUTS.md` or unrelated dirty files as part of a skill sync.

## Add or publish a shared skill

Add the source directory under `skills/`. Add its name to
`scripts/managed-skills.txt` and its description to `README.md`. Validate the
source before applying the sync.

Commit selected repository files and push only when the user requests those
external changes. Report source validation, installed hash verification,
commit, and push as separate outcomes.
