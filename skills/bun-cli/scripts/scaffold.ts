#!/usr/bin/env bun
/**
 * Scaffold a Bun/TS CLI in the house style: pure core, thin frontends, hand-rolled
 * flags, stdout-is-data. Produces a project whose `--help` runs and whose tests
 * pass before you have written a line of your own.
 *
 *   bun run scaffold.ts <name> [--dir path] [--config] [--mcp] [--desc "one line"]
 */
import { mkdirSync, existsSync, chmodSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const val = (n: string) => { const i = args.indexOf(n); if (i < 0) return undefined; return args.splice(i, 2)[1]; };
const withMcp = flag("--mcp");
const withConfig = flag("--config");
const dirFlag = val("--dir");
const desc = val("--desc") ?? "does one thing well";
const name = args[0];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("usage: bun run scaffold.ts <lowercase-name> [--dir path] [--config] [--mcp] [--desc \"one line\"]");
  process.exit(1);
}
const dir = resolve(dirFlag ?? name);
if (existsSync(dir) && (!statSync(dir).isDirectory() || readdirSync(dir).length > 0)) {
  console.error(`refusing to overwrite non-empty ${dir}`);
  process.exit(1);
}

const pkg = {
  name, version: "0.1.0", description: desc, type: "module",
  bin: withMcp ? { [name]: "./src/cli.ts", [`${name}-mcp`]: "./src/mcp.ts" } : { [name]: "./src/cli.ts" },
  scripts: {
    [name]: "bun run src/cli.ts",
    ...(withMcp ? { mcp: "bun run src/mcp.ts" } : {}),
    test: "bun test", typecheck: "tsc --noEmit", check: "bun run typecheck && bun test",
    "build:local": `bun build --compile src/cli.ts --outfile dist/${name}`,
    "build:linux": `bun build --compile --target=bun-linux-x64 src/cli.ts --outfile dist/${name}-linux-x64`,
    "build:linux-arm64": `bun build --compile --target=bun-linux-arm64 src/cli.ts --outfile dist/${name}-linux-arm64`,
  },
  devDependencies: { "@types/bun": "latest", typescript: "^5" },
  ...(withMcp ? { dependencies: { "@modelcontextprotocol/sdk": "^1.29.0", zod: "^4.4.3" } } : {}),
};

const tsconfig = {
  compilerOptions: {
    lib: ["ESNext"], module: "ESNext", target: "ESNext", moduleResolution: "bundler",
    types: ["bun"], allowImportingTsExtensions: true, verbatimModuleSyntax: true,
    noEmit: true, strict: true, noUncheckedIndexedAccess: true, skipLibCheck: true,
  },
  include: ["src", "test"],
};

const core = `/**
 * The action layer: pure where it can be, and the single place both frontends
 * call. Nothing here prints — callers decide how to render.
 */

export interface Result {
  input: string;
  text: string;
  ms: number;
}

export interface Options {
  /** Repeat count. Replace with whatever this tool actually takes. */
  count: number;
}

export const DEFAULTS: Options = { count: 1 };

/** Validate loudly, before doing any work. */
export async function run(input: string, opts: Partial<Options> = {}): Promise<Result> {
  const o = { ...DEFAULTS, ...opts };
  if (!input.trim()) throw new Error("input must not be empty");
  if (!Number.isInteger(o.count) || o.count < 1) throw new Error("count must be an integer >= 1");
  const t0 = Date.now();
  const text = Array.from({ length: o.count }, () => input).join(" ");
  return { input, text, ms: Date.now() - t0 };
}
`;

const cli = `#!/usr/bin/env bun
/**
 * __NAME__ — __DESC__
 *
 *   __NAME__ <input> [flags]
 *
 * stdout is data, stderr is diagnostics: \u0060__NAME__ x > out.txt\u0060 stays clean.
 */
import { run, DEFAULTS } from "./core.ts";

// Color only when a human is looking: gate on the destination stream's TTY and
// honor NO_COLOR, so piped/agent-captured output carries no escape codes.
const paint = (code: number, on: boolean) =>
  on ? (s: string) => \u0060\\x1b[\u0024{code}m\u0024{s}\\x1b[0m\u0060 : (s: string) => s;
const OUT_TTY = !process.env["NO_COLOR"] && !!process.stdout.isTTY;
const ERR_TTY = !process.env["NO_COLOR"] && !!process.stderr.isTTY;
const A = {
  g: paint(32, ERR_TTY), r: paint(31, ERR_TTY),
  d: paint(90, ERR_TTY), b: paint(1, OUT_TTY),
};
function die(m: string): never {
  console.error(A.r("\\u2717 " + m));
  process.exit(1);
}

const HELP = \u0060\u0024{A.b("__NAME__")} — __DESC__

  \u0024{A.b("__NAME__")} <input> [flags]

flags
  -n, --count N    repeat count (default \u0024{DEFAULTS.count})
  -q, --quiet      no stderr timing line
      --json       emit the result as JSON
  -h, --help       this text\u0060;

/** Pull a boolean flag out of argv in place. */
function pullFlag(args: string[], ...names: string[]): boolean {
  let found = false;
  for (const n of names) {
    const i = args.indexOf(n);
    if (i >= 0) { args.splice(i, 1); found = true; }
  }
  return found;
}

/** Pull \u0060--flag value\u0060 or \u0060--flag=value\u0060 out of argv in place. */
function pullVal(args: string[], names: string[]): string | undefined {
  for (const n of names) {
    const i = args.findIndex((a) => a === n || a.startsWith(n + "="));
    if (i < 0) continue;
    const arg = args[i]!;
    if (arg.includes("=")) { args.splice(i, 1); return arg.slice(arg.indexOf("=") + 1); }
    const next = args[i + 1];
    // A dash-shaped value means the flag is missing its argument \u2014 unless it
    // is a negative number, which is a real value (\u0060--offset -5\u0060).
    if (next === undefined || (next.startsWith("-") && !/^-\\d/.test(next))) {
      die(\u0060\u0024{n} needs a value\u0060);
    }
    args.splice(i, 2);
    return next;
  }
  return undefined;
}

function num(v: string | undefined, flag: string, def: number, min = 1): number {
  if (v === undefined) return def;
  const n = Number(v);
  // Reject 1.9 rather than silently flooring it to 1.
  if (!Number.isInteger(n) || n < min) die(\u0060\u0024{flag} needs an integer >= \u0024{min} (got '\u0024{v}')\u0060);
  return n;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || pullFlag(args, "-h", "--help")) { console.log(HELP); return; }

  const json = pullFlag(args, "--json");
  const quiet = pullFlag(args, "-q", "--quiet");
  const count = num(pullVal(args, ["-n", "--count"]), "--count", DEFAULTS.count);

  // Flags are consumed above, so anything dash-shaped left over is a typo —
  // catching it here beats shipping it onward as a positional argument.
  const stray = args.filter((a) => a.startsWith("-") && a !== "-");
  if (stray.length) die(\u0060unknown flag: \u0024{stray[0]}\u0060);
  const input = args[0] ?? die("need an input argument");

  const result = await run(input, { count });
  console.log(json ? JSON.stringify(result, null, 2) : result.text);
  if (!quiet && !json) console.error(A.d(\u0060\u0024{result.ms}ms\u0060));
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
`;

const mcp = `#!/usr/bin/env bun
/**
 * __NAME__-mcp — the same actions over MCP. One core, two transports.
 *
 * stdio rule: nothing but JSON-RPC may touch stdout; diagnostics go to stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { run } from "./core.ts";

const text = (t: string, isError = false) =>
  ({ content: [{ type: "text" as const, text: t || "(no output)" }], isError });

export function buildServer(): McpServer {
  const server = new McpServer({ name: "__NAME__", version: "0.1.0" });

  server.registerTool("__NAME___run", {
    title: "__DESC__",
    // Say when to reach for this and what it returns — the description is all
    // the calling model sees.
    description: "__DESC__. Returns the resulting text.",
    inputSchema: {
      input: z.string().describe("The input string."),
      count: z.number().int().min(1).optional().describe("Repeat count (default 1)."),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ input, count }) => {
    try {
      const r = await run(input, { count });
      return text(r.text);
    } catch (e) {
      return text(e instanceof Error ? e.message : String(e), true);
    }
  });

  return server;
}

if (import.meta.main) {
  await buildServer().connect(new StdioServerTransport());
  console.error("__NAME__-mcp (stdio) ready");
}
`;

const test = `import { expect, test, describe } from "bun:test";
import { run } from "../src/core.ts";

describe("run", () => {
  test("returns the input once by default", async () => {
    expect((await run("hi")).text).toBe("hi");
  });

  test("repeats count times", async () => {
    expect((await run("hi", { count: 3 })).text).toBe("hi hi hi");
  });

  test("rejects empty input rather than returning something empty", async () => {
    await expect(run("   ")).rejects.toThrow(/must not be empty/);
  });

  test("rejects a nonsense count instead of looping oddly", async () => {
    await expect(run("hi", { count: 0 })).rejects.toThrow(/integer >= 1/);
  });
});
`;

const readme = `# __NAME__

__DESC__

\u0060\u0060\u0060bash
bun install
bun link          # puts \u0060__NAME__\u0060 on your PATH
__NAME__ hello -n 3
\u0060\u0060\u0060

Data goes to stdout, diagnostics to stderr, so \u0060__NAME__ x > out.txt\u0060 stays clean.
\u0060--json\u0060 emits the structured result.

## Development

\u0060\u0060\u0060bash
bun run check     # typecheck + tests
\u0060\u0060\u0060

\u0060core.ts\u0060 holds the actions and never prints; \u0060cli.ts\u0060 is a thin frontend over it.
`;


const configSrc = `/**
 * Config for __NAME__.
 *
 * Resolution order: $__ENV___CONFIG, ~/.config/__NAME__/config.json, then
 * __NAME__.config.json next to the package root. Secrets resolve from the
 * environment FIRST so they never have to sit in argv or in git.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";

export interface Config {
  endpoint: string;
  /** Fallback when $__ENV___KEY is unset. Keep the config file gitignored. */
  apiKey?: string;
}

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env["__ENV___CONFIG"];
  if (explicit) return explicit;
  const user = join(homedir(), ".config", "__NAME__", "config.json");
  if (existsSync(user)) return user;
  return join(ROOT, "__NAME__.config.json");
}

function fail(msg: string): never {
  throw new Error("config: " + msg);
}

/** Validate a raw object. Exported so tests never touch the filesystem. */
export function parseConfig(raw: unknown, source = "<inline>"): Config {
  if (typeof raw !== "object" || raw === null) fail(source + " is not an object");
  const o = raw as Record<string, unknown>;
  const endpoint = o["endpoint"];
  if (typeof endpoint !== "string" || endpoint === "") {
    fail("endpoint must be a non-empty string");
  }
  if (!/^https?:\\/\\//.test(endpoint)) {
    fail("endpoint must start with http:// or https:// (got '" + endpoint + "')");
  }
  const cfg: Config = { endpoint };
  if (typeof o["apiKey"] === "string") cfg.apiKey = o["apiKey"];
  return cfg;
}

export function loadConfig(path = configPath()): Config {
  if (!existsSync(path)) {
    fail("no config at " + path + " \\u2014 copy __NAME__.config.example.json there and fill it in");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(path + " is not valid JSON (" + (err as Error).message + ")");
  }
  return parseConfig(raw, path);
}

/** $__ENV___KEY wins over the config file. Never accept a secret as a flag:
 *  argv is world-readable via ps and is logged verbatim by agent runtimes. */
export function resolveKey(cfg: Config, env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env["__ENV___KEY"];
  if (fromEnv) return fromEnv;
  if (cfg.apiKey) return cfg.apiKey;
  return fail("no API key \\u2014 set $__ENV___KEY or add apiKey to " + configPath(env));
}
`;

const configExample = JSON.stringify(
  { endpoint: "https://api.example.com", apiKey: "set-me-or-use-$__ENV___KEY" },
  null,
  2,
) + "\n";

const configTest = `import { describe, expect, test } from "bun:test";
import { parseConfig, resolveKey } from "../src/config.ts";

const cfg = parseConfig({ endpoint: "https://api.example.com", apiKey: "from-file" });

describe("parseConfig", () => {
  test("keeps a valid endpoint", () => {
    expect(cfg.endpoint).toBe("https://api.example.com");
  });

  test("rejects a missing endpoint instead of defaulting to one", () => {
    expect(() => parseConfig({})).toThrow(/endpoint must be a non-empty string/);
  });

  test("rejects an endpoint with no scheme", () => {
    expect(() => parseConfig({ endpoint: "api.example.com" })).toThrow(/must start with http/);
  });
});

describe("resolveKey", () => {
  test("the environment wins over the config file", () => {
    expect(resolveKey(cfg, { __ENV___KEY: "from-env" })).toBe("from-env");
  });

  test("falls back to the config file", () => {
    expect(resolveKey(cfg, {})).toBe("from-file");
  });

  test("no key anywhere fails with an actionable message", () => {
    expect(() => resolveKey({ endpoint: cfg.endpoint }, {})).toThrow(/__ENV___KEY/);
  });
});
`;

const ENV = name.toUpperCase().replaceAll("-", "_");
const sub = (s: string) =>
  s.replaceAll("__NAME__", name).replaceAll("__DESC__", desc).replaceAll("__ENV__", ENV);
mkdirSync(join(dir, "src"), { recursive: true });
mkdirSync(join(dir, "test"), { recursive: true });
const write = async (rel: string, body: string) => Bun.write(join(dir, rel), body);
await write("package.json", JSON.stringify(pkg, null, 2) + "\n");
await write("tsconfig.json", JSON.stringify(tsconfig, null, 2) + "\n");
await write(".gitignore",
  "node_modules/\ndist/\n*.log\n" + (withConfig ? sub("__NAME__.config.json\n") : ""));
await write("src/core.ts", core);
await write("src/cli.ts", sub(cli));
await write("test/core.test.ts", test);
await write("README.md", sub(readme));
if (withMcp) await write("src/mcp.ts", sub(mcp));
if (withConfig) {
  await write("src/config.ts", sub(configSrc));
  await write(sub("__NAME__.config.example.json"), sub(configExample));
  await write("test/config.test.ts", sub(configTest));
}
chmodSync(join(dir, "src/cli.ts"), 0o755);
if (withMcp) chmodSync(join(dir, "src/mcp.ts"), 0o755);

console.log(`scaffolded ${name} in ${dir}`);
if (withConfig) console.log(`  cp ${name}.config.example.json ~/.config/${name}/config.json`);
console.log(`  cd ${dir} && bun install && bun run check && bun run src/cli.ts hello -n 3`);
