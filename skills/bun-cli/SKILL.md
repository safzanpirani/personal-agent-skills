---
name: bun-cli
description: Build a single-purpose CLI tool in Bun + TypeScript, in the house style used by `fleet`, `qb` and `see` — pure core, thin frontends, injected dependencies, hand-rolled flags, stdout-is-data, an optional MCP server sharing the same core. Includes a scaffold script that emits a project whose --help runs and whose tests pass immediately. Use when the user asks for a new CLI, script, or command-line tool, says "make a tool that…", wants a one-shot utility, wants an existing script turned into a proper CLI, wants a tool usable by both a human and an agent (CLI + MCP), or asks how their Bun/TS tools are structured.
---

# Bun/TS one-shot CLIs

## Prefer Bun's native APIs

**Before adding any dependency, read the `bun-native` skill** — the full Bun 1.4
dependency→built-in map (images, headless browser, markdown, cron, PTY,
JSON5/JSONC/TOML/XML, archives, ANSI string utils, compression, profiling), with
platform caveats verified against the docs. Target current stable Bun; pin both
`packageManager` and `@types/bun` to the runtime version.

The ones that come up most in CLI work:

- `Bun.spawn` and `Bun.$` instead of child-process wrappers. Keep subprocess calls
  shell-free unless shell syntax is the feature being requested. For interactive
  programs, `Bun.spawn(cmd, { terminal })` attaches a PTY (POSIX only) — no node-pty.
- `Bun.JSON5` / `Bun.JSONC` / `Bun.TOML` for config files users hand-edit —
  comments and trailing commas stop being parse errors, at zero deps.
- `Bun.Archive` for tarballs, `CompressionStream` for gzip/brotli/zstd.
- `Bun.Image` instead of sharp; `Bun.WebView` (experimental; zero-dep on macOS
  only) instead of Puppeteer for screenshot/scrape verbs.
- `Bun.cron` when the tool grows a "run this on a schedule" verb — the OS-level
  form registers with launchd/crontab/Task Scheduler and survives reboots.

Do not contort the program around a native API that lacks a required operation.
When a dependency remains necessary, keep it behind one module and record the
specific gap. Re-check that gap on the next Bun upgrade.

Tooling that replaces dev-dependencies too: `bun repl` for API poking,
`bun --cpu-prof-md` / `--heap-prof-md` for profiling (Markdown reports an agent
can read directly), `bun test --changed` while iterating, `test(..., {retry: N})`
for a flaky integration test, `bun run --parallel` instead of concurrently, and
`bun build --compile --asset <dir>` to embed data files in the shipped binary
(readable via `node:fs` under `/$bunfs/`).

## Scaffold first

```bash
bun run ~/.agents/skills/bun-cli/scripts/scaffold.ts <name> [--config] [--mcp] [--desc "one line"]
cd <name> && bun install && bun run check
```

Emits `package.json`, the house `tsconfig.json`, `src/core.ts`, `src/cli.ts`, a test file;
`src/config.ts` + an example config with `--config`; `src/mcp.ts` with `--mcp`. It runs and
passes before you edit anything — start from it rather than assembling a project by hand.
`bun link` puts the name on PATH; `bun run build:local` makes a standalone binary.

## The shape

- **`core.ts` holds the actions and never prints.** Frontends decide rendering. This is
  what lets a CLI and an MCP server exist over one implementation instead of two.
- **Push pure logic further down** (`render.ts`-style: data in, data out, no IO). It is the
  part worth testing hard, and it stays testable without mocks.
- **One file owns each external dependency** — the decoder, the SSH layer, the API client.
  Swapping it later is then a one-file change.
- **`cli.ts` is thin**: parse, call, render, exit.
- **Rendering is its own layer.** Once the output has shape — a table, progress,
  colour, anything live — it belongs in `render.ts`, pure and taking a resolved
  theme, not inlined into `cli.ts`. See the **`bun-tui`** skill; it scaffolds
  that layer into a project this one created.

## Inject dependencies; never patch globals

Every action that touches the network, the filesystem or a subprocess takes an optional
`deps` object with the real thing as the default:

```ts
export interface Deps {
  fetch?: typeof fetch;
  run?: (cmd: string[]) => Promise<{ ok: boolean; stdout: string; stderr: string }>;
}
export async function search(q: string, deps: Deps = {}) {
  const run = deps.run ?? defaultRun;
  …
}
```

Tests then pass a fake and assert on real values — no mocking library, no `afterEach`
restore, no ordering hazard. This is what `fleet` (`deps: { exec }`) and `qb`
(`deps: { fetch, cookie, run }`) do. **Do not assign `globalThis.fetch` in tests**: `bun test`
shares one process across files, so a patched global leaks into every other file and the
suite passes alone but fails together.

## Rules that keep the tool usable

- **stdout is data, stderr is diagnostics.** `tool x > out.txt` must stay clean. Timing,
  progress and warnings go to stderr; `-q` silences them.
- **`--json` on anything with structure**, and make it the *whole* result, not a summary.
- **Exit non-zero when the work failed**, so callers can branch on it.
- **Validate arguments eagerly; acquire resources lazily.** Bad flags must fail before any
  work starts — but do not resolve a password, open a connection or build a client until a
  code path actually needs it. Eager credential resolution makes unrelated subcommands die
  with a config error (a real `qb` bug: a search-only run demanded the qBittorrent password).
- **Reject stray dash-shaped args.** After pulling known flags, anything left starting with
  `-` is a typo; catching it beats passing it on as a positional.
- **Never accept a secret as a flag.** argv is world-readable via `ps` and is transcribed
  verbatim into agent session logs forever. Resolve `$TOOL_KEY` → `~/.config/<name>/` config
  (mode 0600), and say in the error message where to put one.
- **Long or bulk runs must be resumable**: flush after every item, skip completed work on
  re-run, retry with backoff, isolate one failure from the batch. Assume interruption.

## Agents are the primary users

Most of these tools are driven by agents in non-interactive shells, not humans.
Design for that caller first:

- **Never prompt interactively.** No readline, no y/N confirmation — an agent's
  shell has no tty, the prompt reads EOF, and the tool hangs or silently takes
  the default. Destructive verbs take `--yes` and fail loudly without it,
  printing exactly what re-running with `--yes` would do (the `push`/`pull`
  dry-run pattern).
- **Color is TTY-gated and honors `NO_COLOR`** (the scaffold does this). Escape
  codes in captured output corrupt greps and bloat session logs.
- **Error messages are instructions.** The agent acts on the string verbatim, so
  name the fix in it: the flag to add, the env var to set, the config path to
  create. `config: no config at ~/.config/x/config.json — copy x.config.example.json
  there` gets self-repaired in one turn; `Error: ENOENT` costs a debugging loop.
- **`--help` is complete and instant.** Agents run `--help` before guessing
  flags; it must list every flag and cost nothing (no config load, no network —
  the eager-validate/lazy-acquire rule again).
- **No pagers, no TUIs, no spinners on default paths.** Progress that repaints
  lines belongs behind a TTY check; when piped, print plain one-per-line events
  or nothing.
- **Verbs are idempotent and re-runnable.** Agents retry on failure; a re-run
  after a partial success must converge, not duplicate or error on
  already-done work.

## Working against someone else's API

- **Read the docs, then probe, then write the client.** Never code an external API from
  memory. Both halves matter: qBittorrent 5.x answers a good login with `204` and an *empty
  body* (the prose everyone had said `Ok.`), and DeepSeek's tool-calling guide omits
  `deepseek-v4-flash` even though it emits `tool_calls` fine — one was only findable by
  reading, the other only by probing.
- **Pin what you learn as a test.** Write the fixture from the real response and name the
  test after the fact (`"HTTP 204 with an empty body is success, not failure"`). Prose in a
  README cannot fail; a test can. This is the highest-value class of test in a tool that
  wraps someone else's service.

## Gotchas that have actually bitten

- **Optional heavy deps**: `await import(SPEC)` with the specifier in a *variable*, or tsc
  demands the package everyone else does not need.
- **`bun test` shares one process across files** — env a test sets (`XDG_CONFIG_HOME`,
  `process.env.*`) leaks into other files. Pass config explicitly; do not rely on ambient
  state, or tests pass alone and fail in the suite.
- **SSE streams split mid-JSON.** Buffer decoded bytes and only parse up to the last `\n`;
  parse the remainder after the loop. Streamed tool calls arrive keyed only by `index`, with
  the function *name* and the JSON *arguments* both split across frames — accumulate per
  index slot and reassemble at the end.
- **Generate fixtures in `beforeAll`** rather than committing binaries.
- **`noUncheckedIndexedAccess` is on**: index access is `T | undefined`. Use `arr[i]!` when
  a loop bound already guarantees it, rather than turning the flag off.
- **`--help` is the source of truth for flags.** READMEs and skills drift, so show workflows
  and pipelines there, not a flag table duplicating what `--help` already prints.

## Adding an MCP frontend

Register tools over the same `core.ts` calls. The description is all a calling model sees —
say when to reach for the tool and what comes back, not just what it does. Gate mutating
tools behind a read-only switch. Assert the exact tool list in a test: that is what catches
a capability existing in the CLI but missing from MCP.

## Shipping: a tool agents can't find doesn't exist

A finished tool gets three things beyond `bun link`, or future sessions
hand-roll the workflow it replaces:

1. **A companion skill** (`write-a-skill`) whose description says *when to
   reach for it*, in the words a task would use — this is how `fleet`, `qb`,
   `dbase` and `shipwatch` actually get picked up.
2. **A row in the Personal CLIs table** in `~/.claude/CLAUDE.md` (name, what
   it replaces, skill name), so it outranks curl/ssh muscle memory.
3. **Fleet builds when other boxes need it**: `build:linux` for x64,
   `build:linux-arm64` for ampere/oracle; install on ampere via the
   `ampere-add-cli` skill so OpenClaw's agents see it too.

## If the CLI drives a model

Same rules, plus: expose the *narrowest* tool set that does the job — a model that cannot
reach a destructive verb cannot misuse one. Let it choose a *kind*, not a path. Reject an
out-of-range or invented identifier with an error string it can recover from rather than
acting on it. Cap the loop with `maxSteps`. Each of those is cheap, and each is a test.
