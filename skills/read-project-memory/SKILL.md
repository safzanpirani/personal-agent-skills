---
name: read-project-memory
description: Read Claude Code's per-project auto-memory (MEMORY.md index + individual fact files) for a working directory, so non-Claude agents (Codex, opencode, Cursor, Gemini CLI, etc.) can load the same persistent project context that Claude Code auto-loads. Use at the start of a session, or when the user asks to "load memory", "read the project memory", "check what you remember about this project", or wants context an earlier Claude Code session saved.
---

# read-project-memory

Claude Code keeps persistent per-project memory as markdown files under
`~/.claude/projects/<slug>/memory/`, where `<slug>` is the absolute project
path with every `/`, `.`, and `_` replaced by `-`. Claude Code auto-loads the
`MEMORY.md` index each session; other agents do not. This skill lets any agent
read that same memory.

## Quick start

Run the bundled script (from the project dir, or pass a path):

```sh
scripts/read-memory.sh                       # memory for $PWD (walks up to find it)
scripts/read-memory.sh /path/to/project      # memory for a specific directory
```

Read the full output into your context — it is the project's persistent memory.
The `MEMORY.md` block is the index; the remaining blocks are the individual
facts. Treat these as background context that was true when written; if a memory
names a file, flag, or command, verify it still exists before acting on it.

## Modes

```sh
scripts/read-memory.sh --index [DIR]   # only the MEMORY.md index (cheap orientation)
scripts/read-memory.sh --list  [DIR]   # only file paths, no contents
scripts/read-memory.sh --help
```

Use `--index` first if you just want the one-line index and will pull specific
fact files (shown by `--list`) on demand.

## Notes

- The script walks **up** from the target directory, so it works from a
  subdirectory of the project.
- Set `CLAUDE_CONFIG_DIR` if the user's Claude home is not `~/.claude`.
- If no memory exists for the directory (or any ancestor), the script exits
  non-zero with a message — that just means no Claude session has saved memory
  for this project yet.
