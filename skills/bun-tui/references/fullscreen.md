# Rung 4: fullscreen apps

Read this before taking the alt-screen. This file is only about *whether* to,
and how to structure the app so the rest of the tool survives.

## Prerequisite: install the `opentui` skill

**Do this before writing a line of OpenTUI code.** Check whether the `opentui`
skill is available; if it is not:

```bash
npx skills add anomalyco/opentui --skill opentui -g
```

It installs to `~/.agents/skills/opentui` and symlinks into every harness. The
docs are generated from `packages/web/src/content` in the OpenTUI repo, so they
track the code rather than a snapshot — which matters because OpenTUI ships
fast and its surface is not stable enough to write from memory.

Everything about components, the React and Solid reconcilers, layout, animation,
keymap, testing, native images, audio, plugins, QR, Three.js and standalone
builds lives there. This file deliberately does not repeat any of it — if the
two ever disagree, upstream wins.

Sanity checks that the installed skill is the current one, not a stale community
fork: it shows `bun create tui --template react` (not `bunx create-tui`) and has
a `docs/keymap/` directory.

## Justify it first

A fullscreen app is worth it when there is **state to navigate**: a list too
long to read at once, panes that update independently, a selection that drives
what else is shown, or a session the user stays inside. `lazygit`, `k9s`, `btop`
all pass that test.

It is not worth it for: a long-running job (rung 2 progress on stderr), a status
summary (rung 1 table), or "it would look cooler". The cost is total — the
alt-screen means nothing pipes, nothing greps, nothing composes, and the tool
stops being usable by an agent or a script.

**The dual-frontend answer.** If both are wanted, do not fork the tool. `core.ts`
already returns data; the TUI is a *third* frontend beside `cli.ts` and `mcp.ts`,
in `src/tui/`. `qb --watch` opening a TUI over the same core is right; a separate
`qb-tui` binary duplicating the logic is not.

## Structure

```
src/
  core.ts        actions — untouched, still never prints
  render.ts      rung-1 renderers — still used, the TUI shows the same strings
  tui/
    app.tsx      composition only
    state.ts     one reducer: (State, Event) -> State, pure
    keys.ts      the keymap as data, not as scattered handlers
```

- **State transitions are a pure reducer.** Then the interesting half of the app
  is testable with no renderer at all — the same reason `core.ts` is pure.
  Snapshot the frame only for layout.
- **The keymap is a table**, `[key, when, command, description]`. Handlers
  scattered across components make the help screen drift from reality and make
  conflicts invisible. Generate the help screen *from* the table.
  `@opentui/keymap` exists for this.
- **The TUI calls `core.ts`; it does not reimplement it.** If a view needs data
  shaped differently, add the shape to core and let the CLI benefit too.
- **Async work does not block the frame.** Kick it off, render a pending state,
  reconcile on arrival. A TUI that freezes mid-keystroke feels broken in a way a
  CLI pausing does not.

## What actually breaks

- **Never `process.exit()`.** It skips the terminal restore and leaves the user
  in the alt-screen with a hidden cursor and no echo. Tear the renderer down,
  then exit. (This is rule 3 in the `opentui` skill for good reason.)
- **Restore on every path**, including uncaught throw, `SIGINT`, `SIGTERM`, and
  `SIGHUP`. Register the teardown once, make it idempotent.
- **stdout belongs to the renderer now.** A stray `console.log` — yours or a
  dependency's — corrupts the frame. Route logs to a file or an in-app pane, and
  check your libraries do too.
- **Resize is a real event**, not a startup measurement. Subscribe to it. A
  layout computed once at launch shears the first time the window changes.
- **Test the reducer, snapshot sparingly.** Frame snapshots break on every
  cosmetic change and get regenerated without being read, which is worse than no
  test. Assert state transitions and keymap dispatch; snapshot one or two
  representative frames.
- **To see it actually run, use the `tmux` skill.** There is no stdout to read
  once the app owns the terminal. Launch it in a pane, `send-keys` to drive it,
  `capture-pane -p` to assert on the rendered frame. It is also the only honest
  check of the teardown rules above: kill the pane mid-run and confirm the
  cursor and echo came back. Do this before shipping — the restore path is the
  one thing tests never cover and every user hits.
- **Measure in cells here too.** Same grapheme/wide-char maths as rung 1 — layout
  engines lay out what you tell them the width is.

## Ecosystem

Upstream: <https://github.com/anomalyco/opentui> — `@opentui/core` (imperative),
`@opentui/react`, `@opentui/solid`, plus `@opentui/keymap` (command + keybinding
engine), `@opentui/ssh` (serve a TUI over SSH — relevant for anything fleet-shaped),
`@opentui/three`, `@opentui/qrcode`.

Start a new app with `bun create tui --template react`. This replaced
`bunx create-tui -t react <name>`; older blog posts and community skills still
show the old form, which fails on flag order.

Curated list: <https://github.com/msmps/awesome-opentui> — worth reading a real
app before writing one. `opendocker`, `ghui`, `red` and `cftop` are all the
same shape as most tools here (list → detail → action). `opentui-ui` is a
component library; `opentui-spinner` covers rung 2 if you stay there.

**Verify the API against upstream before writing code.** OpenTUI moves fast, and
any bundled skill — the official one included — lags the repo.
