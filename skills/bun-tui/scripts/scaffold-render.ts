#!/usr/bin/env bun
/**
 * Add the house render layer to a Bun/TS tool: a Theme resolved once from the
 * environment, pure renderers that take one, and tests that pass immediately.
 *
 *   bun run scaffold-render.ts [--dir path] [--force]
 *
 * Writes src/theme.ts, src/render.ts and test/render.test.ts. Refuses to
 * clobber an existing file unless --force — this is meant to drop into a
 * project that bun-cli already scaffolded.
 */
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const val = (n: string) => { const i = args.indexOf(n); if (i < 0) return undefined; return args.splice(i, 2)[1]; };
const force = flag("--force");
const dirFlag = val("--dir");
const stray = args.filter((a) => a.startsWith("-"));
if (stray.length) {
  console.error(`unknown flag: ${stray[0]}`);
  process.exit(1);
}
const dir = resolve(dirFlag ?? ".");

const theme = `/**
 * The environment resolves to a Theme exactly once, and every renderer takes
 * one. Without this, \`if (process.stdout.isTTY)\` metastasizes through the
 * render layer and nothing is testable without a PTY.
 */

export interface Theme {
  /** ANSI colour is safe to emit. */
  color: boolean;
  /** Non-ASCII glyphs are safe to emit. */
  unicode: boolean;
  /** Usable columns. */
  width: number;
}

/** Deterministic, colourless, 80 columns — what tests and pipes get. */
export const PLAIN: Theme = { color: false, unicode: false, width: 80 };

export interface ThemeEnv {
  NO_COLOR?: string | undefined;
  FORCE_COLOR?: string | undefined;
  TERM?: string | undefined;
  COLUMNS?: string | undefined;
  LANG?: string | undefined;
  LC_ALL?: string | undefined;
  LC_CTYPE?: string | undefined;
}

/** Both inputs are injected so a test can describe a terminal instead of being run in one.
 *  The cast is needed because Bun types \`process.env\` with named keys rather
 *  than an index signature, so it shares no declared property with ThemeEnv. */
export function resolveTheme(
  env: ThemeEnv = process.env as ThemeEnv,
  stream: { isTTY?: boolean | undefined; columns?: number | undefined } = process.stdout,
): Theme {
  // NO_COLOR is honoured for ANY value, including empty (no-color.org). Checking
  // truthiness instead is the classic bug: \`NO_COLOR= tool\` then stays coloured.
  const color =
    env.NO_COLOR !== undefined ? false
    : env.FORCE_COLOR !== undefined ? env.FORCE_COLOR !== "0"
    : Boolean(stream.isTTY) && env.TERM !== "dumb";
  const locale = env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? "";
  const cols = Number(env.COLUMNS) || stream.columns || 80;
  return {
    color,
    unicode: /UTF-?8/i.test(locale),
    // A 5-column terminal and a 3000-column one both produce unreadable tables.
    width: Math.max(20, Math.min(cols, 200)),
  };
}

const CODES = {
  red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36,
  dim: 90, bold: 1, italic: 3, underline: 4, reverse: 7,
} as const;

export type Ink = keyof typeof CODES;

/** Paint, or hand back the string untouched when colour is off.
 *
 *  Note the reset is \`0m\`, which clears EVERY attribute — so nesting one ink
 *  inside another silently ends the outer one at the inner one's close. Compose
 *  by building the plain string first and painting once, not by nesting. */
export function ink(theme: Theme, name: Ink, s: string): string {
  if (!theme.color || s === "") return s; // an empty cell needs no escape pair
  return \`\\x1b[\${CODES[name]}m\${s}\\x1b[0m\`;
}
`;

const render = `/**
 * Pure renderers: data in, string out, no IO. This is what makes output
 * snapshot-testable without a PTY, and it is why nothing here calls console.log.
 * The frontend decides where the returned string goes.
 */
import { type Theme, type Ink, ink, PLAIN, resolveTheme } from "./theme.ts";

const ANSI = /\\x1b\\[[0-9;]*m/g;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function strip(s: string): string {
  return s.replace(ANSI, "");
}

/** Terminal cells occupied, not \`.length\`.
 *
 *  \`.length\` counts UTF-16 units, so an emoji reads as 2 and a CJK glyph as 1 —
 *  both wrong, and every column in the table drifts. Graphemes are segmented
 *  first so a family emoji or a combining accent counts once. */
export function cells(s: string): number {
  let n = 0;
  for (const { segment } of GRAPHEMES.segment(strip(s))) {
    const cp = segment.codePointAt(0)!;
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue; // control characters occupy nothing
    n += isWide(cp) ? 2 : 1;
  }
  return n;
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

/** Cut to \`max\` cells, marking the cut. Measure and cut BEFORE painting:
 *  slicing a styled string can drop the reset and bleed colour down the page. */
export function truncate(s: string, max: number, theme: Theme = PLAIN): string {
  if (max <= 0) return "";
  if (cells(s) <= max) return s;
  const mark = theme.unicode ? "\\u2026" : "..";
  const budget = max - cells(mark);
  let out = "";
  let n = 0;
  for (const { segment } of GRAPHEMES.segment(strip(s))) {
    const w = cells(segment);
    if (n + w > budget) break;
    out += segment;
    n += w;
  }
  return out + mark;
}

export function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  const gap = " ".repeat(Math.max(0, width - cells(s)));
  return align === "right" ? gap + s : s + gap;
}

export interface Column<T> {
  header: string;
  get: (row: T) => string;
  align?: "left" | "right";
  /** Per-row ink. Colour is decoration — never the only carrier of meaning. */
  ink?: (row: T) => Ink | undefined;
}

/** Aligned columns, two spaces apart, no box drawing.
 *
 *  Two rules are baked in. Padding happens OUTSIDE the paint — pad a string that
 *  already ends in \`\\x1b[0m\` and the spaces sit inside the reset, where the
 *  line's trimEnd can never reach them. It is safe only because cells() ignores
 *  ANSI. And every column is padded, including the last: skipping it is the
 *  usual trailing-whitespace fix, but it silently breaks \`align: "right"\` on
 *  the final column. Trim the assembled line instead. */
export function table<T>(rows: T[], cols: Column<T>[], theme: Theme = PLAIN): string {
  if (!rows.length) return "";
  const raw = rows.map((r) => cols.map((c) => c.get(r)));
  const widths = cols.map((c, i) =>
    Math.max(cells(c.header), ...raw.map((row) => cells(row[i]!)))
  );
  const line = (values: string[], paint: (v: string, i: number) => string) =>
    values
      .map((v, i) => pad(paint(v, i), widths[i]!, cols[i]!.align))
      .join("  ")
      .trimEnd();

  const head = line(cols.map((c) => c.header), (v) => ink(theme, "dim", v));
  const body = raw.map((values, r) =>
    line(values, (v, i) => {
      const name = cols[i]!.ink?.(rows[r]!);
      return name ? ink(theme, name, v) : v;
    })
  );
  return [head, ...body].join("\\n");
}

/** A progress bar. Degrades to ASCII when the locale is not UTF-8. */
export function bar(fraction: number, width: number, theme: Theme = PLAIN): string {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const on = Math.round(f * width);
  const [full, empty] = theme.unicode ? ["\\u2588", "\\u2591"] : ["#", "-"];
  return full!.repeat(on) + empty!.repeat(Math.max(0, width - on));
}

export type Status = "ok" | "warn" | "err" | "info";

const GLYPHS: Record<Status, { uni: string; ascii: string; ink: Ink }> = {
  ok: { uni: "\\u2713", ascii: "+", ink: "green" },
  warn: { uni: "!", ascii: "!", ink: "yellow" },
  err: { uni: "\\u2717", ascii: "x", ink: "red" },
  info: { uni: "\\u00b7", ascii: "-", ink: "dim" },
};

/** Status as a glyph, coloured only as reinforcement.
 *
 *  The four glyphs stay distinguishable with colour off — for a pipe, a CI log,
 *  and for the ~4% of users who cannot tell the red one from the green one. */
export function glyph(status: Status, theme: Theme = PLAIN): string {
  const g = GLYPHS[status];
  return ink(theme, g.ink, theme.unicode ? g.uni : g.ascii);
}

/** Aligned key/value block — the smallest thing that reads as designed. */
export function kv(pairs: [string, string][], theme: Theme = PLAIN): string {
  const w = Math.max(0, ...pairs.map(([k]) => cells(k)));
  return pairs
    .map(([k, v]) => \`\${ink(theme, "dim", pad(k, w))}  \${v}\`.trimEnd())
    .join("\\n");
}

if (import.meta.main) {
  // A demo, so \`bun run src/render.ts\` shows what the layer produces. Delete it.
  const t = resolveTheme();
  const rows = [
    { name: "alpha", status: "ok" as Status, pct: 1 },
    { name: "beta", status: "warn" as Status, pct: 0.62 },
    { name: "gamma-with-a-very-long-name", status: "err" as Status, pct: 0.08 },
  ];
  console.log(table(rows, [
    { header: "", get: (r) => glyph(r.status, t) },
    { header: "NAME", get: (r) => truncate(r.name, 20, t) },
    { header: "PROGRESS", get: (r) => bar(r.pct, 16, t) },
    { header: "%", get: (r) => \`\${Math.round(r.pct * 100)}%\`, align: "right" },
  ], t));
  console.log();
  console.log(kv([["theme", JSON.stringify(t)], ["width", String(t.width)]], t));
}
`;

const test = `import { describe, expect, test } from "bun:test";
import { PLAIN, resolveTheme, ink } from "../src/theme.ts";
import { cells, truncate, pad, table, bar, glyph, kv, strip } from "../src/render.ts";

describe("resolveTheme", () => {
  test("a pipe gets no colour", () => {
    expect(resolveTheme({}, { isTTY: false }).color).toBe(false);
  });

  test("a tty gets colour", () => {
    expect(resolveTheme({}, { isTTY: true }).color).toBe(true);
  });

  // The classic bug: NO_COLOR is a presence check, not a truthiness check.
  test("NO_COLOR with an EMPTY value still disables colour", () => {
    expect(resolveTheme({ NO_COLOR: "" }, { isTTY: true }).color).toBe(false);
  });

  test("FORCE_COLOR beats a pipe, so CI can keep colour", () => {
    expect(resolveTheme({ FORCE_COLOR: "1" }, { isTTY: false }).color).toBe(true);
  });

  test("TERM=dumb gets no colour even on a tty", () => {
    expect(resolveTheme({ TERM: "dumb" }, { isTTY: true }).color).toBe(false);
  });

  test("a non-UTF-8 locale gets no fancy glyphs", () => {
    expect(resolveTheme({ LANG: "C" }, {}).unicode).toBe(false);
    expect(resolveTheme({ LANG: "en_US.UTF-8" }, {}).unicode).toBe(true);
  });

  test("an absurd terminal width is clamped, not trusted", () => {
    expect(resolveTheme({}, { columns: 3 }).width).toBe(20);
    expect(resolveTheme({}, { columns: 9999 }).width).toBe(200);
  });
});

describe("cells", () => {
  test("counts terminal cells, not UTF-16 units", () => {
    expect(cells("abc")).toBe(3);
    expect("\\u4e16\\u754c".length).toBe(2);
    expect(cells("\\u4e16\\u754c")).toBe(4); // CJK is double-width
    expect("\\ud83d\\ude80".length).toBe(2);
    expect(cells("\\ud83d\\ude80")).toBe(2); // emoji is 2 cells but 2 UTF-16 units too
  });

  test("ignores ANSI, so a painted string measures as its text", () => {
    expect(cells(ink({ ...PLAIN, color: true }, "red", "abc"))).toBe(3);
  });
});

describe("table", () => {
  const rows = [{ n: "a", v: "1" }, { n: "bbbb", v: "22" }];
  const cols = [
    { header: "NAME", get: (r: typeof rows[0]) => r.n },
    { header: "V", get: (r: typeof rows[0]) => r.v, align: "right" as const },
  ];

  test("columns align and no line has trailing whitespace", () => {
    expect(table(rows, cols, PLAIN)).toBe("NAME   V\\na      1\\nbbbb  22");
  });

  test("the last column still honours align: right", () => {
    // Every line ends at the same column: 1 and 22 are flush right under V.
    for (const l of table(rows, cols, PLAIN).split("\\n")) expect(cells(l)).toBe(8);
  });

  test("colour never changes the layout", () => {
    const coloured = table(rows, cols, { ...PLAIN, color: true });
    expect(strip(coloured)).toBe(table(rows, cols, PLAIN));
  });

  test("no rows renders nothing, not a lone header", () => {
    expect(table([], cols, PLAIN)).toBe("");
  });
});

describe("degradation", () => {
  test("glyphs stay distinguishable with colour and unicode off", () => {
    const plain = (["ok", "warn", "err", "info"] as const).map((s) => glyph(s, PLAIN));
    expect(new Set(plain).size).toBe(4);
    expect(plain.join("")).not.toContain("\\x1b");
  });

  test("the bar falls back to ASCII", () => {
    expect(bar(0.5, 4, PLAIN)).toBe("##--");
    expect(bar(0.5, 4, { ...PLAIN, unicode: true })).toBe("\\u2588\\u2588\\u2591\\u2591");
  });

  test("a nonsense fraction clamps instead of repeating -1 times", () => {
    expect(bar(-1, 4, PLAIN)).toBe("----");
    expect(bar(NaN, 4, PLAIN)).toBe("----");
    expect(bar(9, 4, PLAIN)).toBe("####");
  });
});

describe("truncate", () => {
  test("leaves a short string alone", () => {
    expect(truncate("abc", 10, PLAIN)).toBe("abc");
  });

  test("cuts to the budget including the marker", () => {
    expect(truncate("abcdefgh", 5, PLAIN)).toBe("abc..");
    expect(cells(truncate("abcdefgh", 5, PLAIN))).toBe(5);
  });

  test("never splits a double-width glyph in half", () => {
    // Budget 4 minus a 1-cell marker leaves 3 cells: one CJK glyph fits, not one and a half.
    expect(truncate("\\u4e16\\u754c\\u4e16", 4, { ...PLAIN, unicode: true })).toBe("\\u4e16\\u2026");
  });
});

describe("kv", () => {
  test("keys align and lines do not trail", () => {
    expect(kv([["a", "1"], ["long", "2"]], PLAIN)).toBe("a     1\\nlong  2");
  });
});

describe("pad", () => {
  test("pads by cells, so a CJK column still lines up", () => {
    expect(pad("\\u4e16", 4)).toBe("\\u4e16  ");
    expect(pad("ab", 4, "right")).toBe("  ab");
  });
});
`;

if (!existsSync(join(dir, "src"))) mkdirSync(join(dir, "src"), { recursive: true });
if (!existsSync(join(dir, "test"))) mkdirSync(join(dir, "test"), { recursive: true });

const files: [string, string][] = [
  ["src/theme.ts", theme],
  ["src/render.ts", render],
  ["test/render.test.ts", test],
];

const clashes = files.map(([rel]) => rel).filter((rel) => existsSync(join(dir, rel)));
if (clashes.length && !force) {
  console.error(`refusing to overwrite: ${clashes.join(", ")} (pass --force)`);
  process.exit(1);
}
for (const [rel, body] of files) await Bun.write(join(dir, rel), body);

console.log(`wrote ${files.map(([r]) => r).join(", ")} in ${dir}`);
console.log("  bun test test/render.test.ts && bun run src/render.ts");
