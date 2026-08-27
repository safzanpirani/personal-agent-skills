---
name: bun-cli
description: Build a single-purpose CLI tool in Bun + TypeScript, in the house style used by `fleet`, `qb` and `see` — pure core, thin frontends, injected dependencies, hand-rolled flags, stdout-is-data, an optional MCP server sharing the same core. Includes a scaffold script that emits a project whose --help runs and whose tests pass immediately. Use when the user asks for a new CLI, script, or command-line tool, says "make a tool that…", wants a one-shot utility, wants an existing script turned into a proper CLI, wants a tool usable by both a human and an agent (CLI + MCP), or asks how their Bun/TS tools are structured.
---

# Bun/TS one-shot CLIs

## Prefer Bun's native APIs

Target current stable Bun and check the official API before adding a package for
runtime work. For Bun 1.4 projects, pin both `packageManager` and `@types/bun` to
the runtime version. Prefer these built-ins when they cover the required behavior:

- `Bun.Image` for image metadata, decode, resize, conversion and encoding. Do not
  add Sharp for those operations. `Bun.Image` does not currently expose raw pixel
  buffers or crop, so name that missing capability before choosing a fallback.
- `Bun.WebView` for screenshots and browser automation instead of Puppeteer when
  its platform backend and experimental status fit the deployment target.
- `Bun.markdown`, `Bun.JSON5`, `Bun.color`, `Bun.cron` and `Bun.Terminal` instead
  of parser, color, scheduler and PTY packages for features their APIs support.
- `Bun.spawn` and `Bun.$` instead of child-process wrappers. Keep subprocess calls
  shell-free unless shell syntax is the feature being requested.

Do not contort the program around a native API that lacks a required operation.
When a dependency remains necessary, keep it behind one module and record the
specific gap. Re-check that gap on the next Bun upgrade.

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

## If the CLI drives a model

Same rules, plus: expose the *narrowest* tool set that does the job — a model that cannot
reach a destructive verb cannot misuse one. Let it choose a *kind*, not a path. Reject an
out-of-range or invented identifier with an error string it can recover from rather than
acting on it. Cap the loop with `maxSteps`. Each of those is cheap, and each is a test.
