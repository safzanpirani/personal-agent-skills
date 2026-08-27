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

## State lives longer than a frame

A polling TUI is a reconciliation problem. A fresh payload must not behave like
a fresh application.

- Give every selectable object and logical row a stable ID. Array position is
  not identity.
- Preserve selection, expanded rows, focus, search, follow mode, and scroll
  position when the selected object still exists after refresh.
- Replace renderer children only when their content signature changes. Blindly
  rebuilding a pane on every poll causes flicker and usually resets internal
  scroll state.
- Treat a change emitted by the selection widget as a real selection change
  only when its stable ID differs. Some widgets emit while options reconcile.
- Exercise interactions across at least two refresh intervals. A selection that
  works for 400ms in a 500ms polling app does not work.

Put reconciliation rules in the reducer or another pure state function. Test
them without a terminal. Keep mutable renderer objects as a projection of that
state, never as its only source of truth.

## Live feeds need structure

One giant text renderable is fine for passive reading. It is a dead end once the
user needs row selection, click targets, search navigation, copy, or expansion.

- Use one renderable per selectable logical row and keep its stable ID.
- Store plain text beside styled content. Search and clipboard operations should
  not reverse-engineer ANSI or styled spans.
- Keep a compact summary visible when a row expands. Put command, status,
  duration, working directory, and captured output beneath it.
- Wrap human-facing reasoning and messages. Do not replace them with an ellipsis
  unless an obvious expand action reveals the whole text.
- Separate a concise activity feed from complete output when the two have
  different jobs. Hide mechanically repetitive events such as usage ticks.
- Bound retained rows, file tails, and expanded output. Long-lived monitors must
  have stable memory and render costs.

## Follow mode is explicit state

Do not infer live following from a scroll widget on every refresh. Model it:

```ts
type FollowState =
  | { mode: "following" }
  | { mode: "paused"; unseen: number };
```

Scrolling upward pauses. New rows increment `unseen` without moving the
viewport. End or a visible follow control returns to the bottom and clears the
count. Switching objects or panes may reset to following, but an ordinary data
refresh must not.

Show the state in the interface. `FOLLOWING` and `PAUSED · 4 new` explain why
content is or is not moving.

## Route input by context

Dispatch input from most specific to least specific:

```text
modal input
search input
focused pane
global shortcuts
```

- A global shortcut must not consume text intended for an input.
- Normalize aliases such as `enter` and `return`. Treat uppercase bindings as a
  shifted key unless the library documents another representation.
- Make commands conditional on state. A finished session should not advertise
  Stop, and an active session should not advertise Continue.
- Generate the footer or help overlay from the active keymap. Static help text
  drifts as soon as actions become contextual.
- Escape closes the topmost overlay. Enter submits only that overlay. Test both
  paths instead of trusting a callback option.

## Mouse is a separate input path

Keyboard support does not imply mouse support. Check each behavior directly:

- Clicking a pane focuses it.
- Clicking a row selects the same state that keyboard navigation selects.
- The wheel scrolls the pane beneath the pointer, not whichever pane used to
  have focus.
- Tabs, follow controls, and expandable rows have real hit targets.
- Mouse scrolling updates follow mode.
- Repeated refreshes do not undo a mouse selection or scroll position.

Use one logical command for each action, then bind keyboard and mouse handlers
to it. Two separate implementations will drift.

## Actions must advertise risk

- Require a second press or a confirmation for stop, delete, and other actions
  that terminate work or discard state.
- Keep destructive bindings out of input and search modes.
- A Continue action should create a fresh private run and preserve the source
  context that matters, such as working directory, model, effort, and sandbox.
- During PTY verification, do not stop, resume, steer, or delete real user work.
  Use fixtures or test sessions. Opening and cancelling a confirmation is enough
  to verify its layout and key routing.

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
  once the app owns the terminal. Use the PTY checklist below rather than
  approving the first clean screenshot.
- **Measure in cells here too.** Same grapheme/wide-char maths as rung 1 — layout
  engines lay out what you tell them the width is.

## Ship the installed app

A compiled launcher does not make a Bun TUI a single binary. If runtime
TypeScript, native packages, or other assets remain, install and locate them
deliberately.

- Define where the launcher searches for the TUI entrypoint and dependencies.
- Install assets independently of the caller's working directory.
- Replace the executable atomically when practical, then verify the installed
  binary matches the build.
- Run the installed command from a directory outside the checkout. A source
  invocation proves nothing about asset discovery.
- Keep prompts, transcripts, and captured tool output in private files. Do not
  move content into a broadly readable registry merely to make discovery easy.

## PTY acceptance checklist

Use the `tmux` skill to launch the real program, drive it with `send-keys`, and
inspect frames with `capture-pane`. Cover the behaviors the reducer cannot:

- launch, clean quit, and signal teardown;
- keyboard navigation before and after multiple refreshes;
- mouse click, wheel scroll, tab switching, and follow-mode changes;
- every modal's submit and cancel paths;
- search entry, match navigation, clearing, and copy feedback;
- narrow and wide terminal sizes plus a live resize;
- an installed launch from an unrelated working directory.

For teardown testing, kill only the disposable TUI or fixture process. Confirm
that cursor visibility, echo, and the normal screen return.

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
any bundled skill — the official one included — lags the repo. When a property
or callback is uncertain, inspect the installed package's `.d.ts` file. Do not
guess a component option from another terminal framework or an older example.
