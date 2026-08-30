---
name: bun-tui
description: Make a Bun/TS command-line tool's output look designed — the render layer, in the house style used by `qb` and `see`. An escalation ladder from plain styled lines to live redraw to a fullscreen OpenTUI app, a Theme resolved once from the environment, pure snapshot-testable renderers, and the width/ANSI/degradation rules that keep it correct when piped. Includes a scaffold that drops a working `render.ts` + `theme.ts` + tests into an existing project. Use when the user wants nicer or prettier terminal output, a table, progress bar, spinner, status line, live/watch view, colours, a dashboard or monitor in the terminal, an interactive TUI, or says output looks ugly or unreadable. Covers rungs 1-3 completely; for OpenTUI component and reconciler APIs it defers to the `opentui` skill, installed if missing with `npx skills add anomalyco/opentui --skill opentui -g`. This skill decides whether you need a TUI at all and how the result should look.
---

# Terminal render layers

`bun-cli` says stdout is data and stops there. This is the other half: when the
data has shape, something has to give it one. That something is `render.ts` —
already the third file in `qb` and `see`, and the file this skill is about.

## Climb the ladder only as far as you must

Each rung buys interactivity and costs something real. Pick the lowest that does
the job; most tools live and die on rung 1.

| Rung | What it is | Costs you |
|---|---|---|
| **1. Styled lines** | Print and move on. Tables, key/value blocks, glyphs, colour. | Nothing. Pipeable, greppable, testable as strings. |
| **2. In-place redraw** | `\r` or cursor save/restore over a few lines. Spinners, progress, counters. | Output stops being a clean log. Needs a TTY guard and signal cleanup. |
| **3. Live region** | A pinned status block above scrolling output. | Resize handling, cursor bookkeeping, interleaving bugs. |
| **4. Fullscreen** | Alt-screen app: panes, focus, keymap. OpenTUI. | A native dep, a real event loop, and stdout is now the app — nothing can be piped. |

Two questions decide it. **Does the user steer it while it runs?** No → you are
on rung 1 or 2, whatever it looks like. **Would they ever pipe it?** Yes → rung 1,
and put the fancy version behind a flag.

The failure mode is skipping to rung 4 because a TUI sounds better. A tool that
prints a good table composes with everything; one that grabs the alt-screen
composes with nothing. Reach for rung 4 when there is genuinely *state to
navigate* — panes, selection, a list too long to read at once. See
`references/fullscreen.md` before you do.

> **Rung 4 needs the `opentui` skill installed. Check first — do not write
> OpenTUI code from memory.** This skill covers rungs 1–3 completely and stops
> at the boundary of OpenTUI's API on purpose; it does not duplicate it.
>
> ```bash
> npx skills add anomalyco/opentui --skill opentui -g
> ```
>
> That is the official upstream skill, generated from the OpenTUI repo itself,
> so it tracks the code. OpenTUI moves fast and its API is not stable enough to
> recall — a model writing rung-4 code without it will invent components that do
> not exist and reach for `bunx create-tui`, which no longer exists.

## `render.ts` is pure: data in, string out

Same rule as `core.ts` never printing, one level down. Renderers take a value
and **return** text; the frontend writes it.

```ts
export function summary(r: Result, theme: Theme): string   // yes
export function printSummary(r: Result): void              // no
```

This is the whole reason output is testable. A pure renderer is asserted against
an exact string in `bun test` with no PTY, no pseudo-terminal library, no
snapshot harness. `qb`'s `StreamPrinter` takes an injected `out` for exactly
this. Once a renderer prints, the only way to test it is to capture stdout, and
in practice nobody does — so nobody ever notices the day it starts emitting a
stray reset.

## One Theme, resolved once

Every renderer takes a `Theme { color, unicode, width }`. One function turns the
environment into one; nothing downstream looks at `process.stdout` again.

Skip this and `if (isTTY)` metastasizes — twelve call sites, each with its own
idea of the fallback, and the piped output is half-styled.

- **`NO_COLOR` is a presence check, not a truthiness check.** Any value counts,
  including empty. `NO_COLOR= tool` must come out plain.
- **`FORCE_COLOR` beats a pipe** — that is how CI keeps colour.
- **Unicode is locale, colour is TTY.** Different questions. `LANG=C` on a real
  terminal wants colour and ASCII glyphs.
- **`--json` bypasses the render layer entirely.** It is not a theme.

## Taste

- **Alignment over boxes.** Columns two spaces apart read better than
  box-drawing and survive a narrow terminal. Box-draw only what is genuinely a
  region, never a table.
- **One accent, plus a status scale.** Dim for chrome and labels, default for
  content, one accent for the thing that matters. Green/yellow/red *only* for
  status. Six colours means none of them signals.
- **Never colour as the only signal.** Every status carries a glyph that stays
  distinguishable in a pipe, in CI, and to a red-green colourblind reader
  (~8% of men). Colour reinforces the glyph; it does not replace it.
- **Label-light.** A column header says what a column is. Do not repeat it in
  every row.
- **Numbers right-aligned, scaled, fixed-width.** `1.2k` beats `1247` in a
  column that also holds `43`. Jitter reads as noise.
- **Earn every line.** A blank line separating two regions is design; a banner
  above a three-line answer is not.

## Width and ANSI, where it actually breaks

**On Bun 1.4+, the primitives are built in — do not add string-width, slice-ansi
or wrap-ansi, and do not hand-roll them:** `Bun.stringWidth()` (grapheme- and
ANSI-aware cell count), `Bun.sliceAnsi()` (column-aware slicing that keeps paint
balanced), `Bun.wrapAnsi()` (ANSI-aware wrapping). Build `cells`/`truncate`/`pad`
on top of these; the rules below still explain *why* each exists and remain the
spec for older runtimes. `Bun.markdown.ansi(src)` renders markdown straight to
styled terminal output (headings, tables, syntax-highlighted code) — reach for it
before writing a bespoke markdown renderer for help text or LLM output. See the
`bun-native` skill for the full 1.4 surface.

- **Measure in cells, never `.length`.** `.length` counts UTF-16 units, so CJK
  reads as 1 (renders as 2) and emoji as 2 (renders as 2, but a ZWJ family is
  one grapheme of many units). Segment graphemes, then count wide ranges as 2.
  Every table misalignment is this bug.
- **Strip ANSI before measuring.** `"\x1b[31mok\x1b[0m".length` is 13.
- **Pad *outside* the paint, truncate *before* it.** Pad a string already ending
  in `\x1b[0m` and the spaces land inside the reset where `trimEnd` cannot reach
  them; slice a painted string and you can cut the reset off and bleed colour
  down the rest of the page. (Both bit the scaffold in this skill.)
- **Trim assembled lines, don't skip padding the last column** — the usual
  trailing-whitespace fix, and it silently breaks `align: "right"` on that
  column.
- **Clamp the width.** A 3-column terminal and a 3000-column one are both real.

## Rung 2 without leaving a mess

- **Guard on the theme, not on hope.** No TTY → print plain lines instead. A
  spinner in a CI log is thousands of `\r` frames in the artifact.
- **Restore on every exit path.** Hide the cursor and you own showing it again —
  on success, on throw, and on `SIGINT`/`SIGTERM`. A killed tool that leaves the
  cursor hidden breaks the user's shell until they `reset`.
- **Redraw whole lines with a clear-to-EOL**, never partial overwrites. Shorter
  new content otherwise leaves the tail of the old frame on screen.
- **Progress goes to stderr.** It is diagnostics. `tool x > out.txt` stays clean
  and the spinner still shows.
- **Buffer streamed text to a word boundary before wrapping.** Deltas arrive
  mid-word, so measuring as they land makes the wrap column depend on how the
  network chunked the response — the same output wraps differently every run.
  This is what `qb`'s `StreamPrinter` exists to solve.

## Scaffold

```bash
bun run ~/.agents/skills/bun-tui/scripts/scaffold-render.ts [--dir path] [--force]
```

Writes `src/theme.ts`, `src/render.ts` and `test/render.test.ts` into an
existing project (defaults to `.`, refuses to clobber). Gives you `resolveTheme`,
`ink`, `cells`, `truncate`, `pad`, `table`, `bar`, `glyph`, `kv`, and 21 tests
that pass immediately — including the degradation and cell-width cases above.
`bun run src/render.ts` prints a demo; delete the `import.meta.main` block.

Pairs with `bun-cli`'s scaffold: that one emits `core.ts` + `cli.ts`, this one
adds the layer between them.

## Neighbours

- **`terminal-ui-aesthetic` is the mirror of this skill** — the same btop/k9s
  look, rendered in a *browser*. If the target is a web page, stop here and use
  that one. Its design vocabulary is deliberately the same as the taste section
  above (status-as-glyphs, dense and label-light, green→yellow→red as the only
  semantic scale), so a CLI and its web dashboard read as one system.
- **`tmux` is how you actually verify rungs 2–4.** A redraw, a spinner or an
  alt-screen app cannot be checked by reading stdout — there is no stdout to
  read. Run it in a pane, `send-keys` to drive it, `capture-pane` to assert on
  the frame. That is also the only honest way to test the teardown rules below:
  kill the pane mid-run and check the cursor came back. On Bun 1.4+ there is an
  in-`bun test` alternative for scripted cases: `Bun.spawn(cmd, { terminal:
  { cols, rows, data } })` gives the tool a real PTY (`isTTY = true`), so a test
  can drive it with `proc.terminal.write()` and assert on the captured frames —
  no tmux orchestration, POSIX only. Use tmux when you need a human-visible
  session or resize/kill interplay; use the PTY spawn for repeatable assertions.
- **`bun-cli`** owns the layer above (`core.ts`, flags, exit codes) and the
  layer below (`--json`, stdout-is-data). This skill is the middle.

## Going fullscreen

`references/fullscreen.md` — when rung 4 is justified, how to structure the app
so `core.ts` stays reusable, how refresh-safe selection and follow mode work,
how to route keyboard and mouse input, how to package the installed app, what
breaks (signals, resize, logging, exit), and the `opentui` skill install it
depends on.
