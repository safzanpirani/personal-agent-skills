---
name: bun-native
description: Bun 1.4+ native API reference so agents stop adding dependencies Bun already replaces. Use BEFORE adding any dependency to a Bun project, and when a task involves image processing (sharp/jimp), browser automation (puppeteer/playwright), markdown (marked/remark), cron (node-cron), PTY (node-pty), JSON5/JSONC/TOML/XML parsing, tarballs, ANSI string width/wrap, string slicing, compression, CPU/heap profiling, a REPL, parallel scripts/tests, or fetch proxying/compression in a Bun runtime. Also use when auditing a Bun project's package.json for removable deps.
---

# Bun 1.4 Native APIs — don't add a dependency Bun already ships

Rule: in a project that runs on Bun (bun in scripts, bun.lock, bunfig.toml, or the user says so), check this table **before** `bun add`. Verify the runtime is ≥1.4 (`bun --version`); on older Bun, upgrade or fall back to the package.

## Dependency → native replacement

| You were about to add | Use instead |
|---|---|
| sharp, jimp, @squoosh | `Bun.Image` (since 1.3.14) — `await Bun.file("p.jpg").image().resize(1024,1024,{fit:"inside"}).rotate(90).webp({quality:85}).write("out.webp")`. API is shaped after sharp; runs off the JS thread; a pipeline is a valid `Response` body with auto Content-Type. Encoders: jpeg/png/webp everywhere, heic/avif macOS+Windows only. GIF/BMP/TIFF are DECODE-ONLY (no `.gif()` encoder; TIFF decode fails on Linux). Catch `e.code === "ERR_IMAGE_FORMAT_UNSUPPORTED"` and fall back to `.webp()`. Transforms: resize (fit/filter/withoutEnlargement), rotate(90|180|270), flip, flop, modulate. Terminals: `.bytes()/.buffer()/.blob()/.toBase64()/.dataurl()/.write(path|BunFile|S3File|fd)`. |
| puppeteer, playwright (for scripting, not test suites) | `Bun.WebView` (EXPERIMENTAL) — `await using view = new Bun.WebView({width:800,height:600}); await view.navigate(url); await view.click(sel); await view.evaluate("document.title"); await view.screenshot()`. Zero-dep only on macOS (system WKWebView); Linux/Windows need an installed Chrome/Chromium/Edge/Brave driven over CDP (`backend:"chrome"`, `BUN_CHROME_PATH` override). Headless only. Input is native (`isTrusted:true`). One browser per Bun process. `.cdp(method, params)` escape hatch. |
| marked, remark, markdown-it | `Bun.markdown` — `.html(src)` (GFM: tables, strikethrough, task lists, autolinks; output UNSANITIZED — sanitize before serving), `.ansi(src)` for terminals, `.react(src, components?, {reactVersion:18}?)` for JSX, `.render(src, {heading: ...})` for custom callbacks. `bun ./README.md` renders to terminal. |
| node-cron, cron, croner | `Bun.cron` — in-process: `using job = Bun.cron("*/5 * * * *", fn)`. OS-level (survives restarts, launchd/crontab/Task Scheduler): `await Bun.cron("./worker.ts", "30 2 * * MON", "title")`; worker must `export default { async scheduled(controller) {...} }` (Cloudflare Workers shape); remove with `Bun.cron.remove(title)`; preview with `Bun.cron.parse(expr)`. Windows OS-level has a 48-trigger cap (`*/7` minutes throws). |
| node-pty | `Bun.spawn(["bash"], {terminal: {cols, rows, data(term, d){...}}})`; write via `proc.terminal.write(...)`; stdin/stdout/stderr become `null` when a terminal is attached. Reusable across spawns via `new Bun.Terminal({...})`. **POSIX only (Linux/macOS)** — the blog says Windows, the docs say no. |
| json5 | `Bun.JSON5.parse/stringify` |
| jsonc-parser, strip-json-comments | `Bun.JSONC.parse` |
| ndjson, jsonlines | `Bun.JSONL` (streaming `parseChunk()`) |
| @iarna/toml, smol-toml | `Bun.TOML` (parse + stringify, TOML 1.1) |
| fast-xml-parser, xml2js | `Bun.XML` (SIMD parse + serialize) |
| tar, tar-stream, node-tar | `Bun.Archive` (create/extract off main thread) |
| string-width | `Bun.stringWidth()` (grapheme+ANSI aware) |
| slice-ansi | `Bun.sliceAnsi()` |
| wrap-ansi | `Bun.wrapAnsi()` |
| urlpattern-polyfill, path-to-regexp (route matching) | `URLPattern` (native) |
| pako, zlib wrappers, brotli/zstd libs | `CompressionStream`/`DecompressionStream` — gzip, deflate, deflate-raw, brotli, zstd |
| concurrently, npm-run-all | `bun run --parallel build test`, `bun run --parallel "build:*"`, `--filter '*'`, `--no-exit-on-error` |
| serve-static/express.static (Bun.serve apps) | `Bun.serve({routes: {"/static/*": {dir: "./public"}}})` — Content-Type, ETag/304, Range/206, index.html, sendfile, symlink-safe |
| jest-retries wrappers, flaky-test helpers | `test("x", fn, {retry: 5})`, `{repeats: 20}`, `bun test --retry N` |
| 0x, clinic, v8-profiler | `bun --cpu-prof` / `--cpu-prof-md` / `--heap-prof` / `--heap-prof-md` (Markdown reports are agent-readable — prefer `-md`) |

## fetch/server extras (skip axios/got/proxy agents)

- Request body compression: `fetch(url, {method:"POST", body, compress:"gzip"})` (or `br`/`zstd`/`{encoding,level}`).
- Proxy with auth headers: `fetch(url, {proxy: {url: "http://proxy:8080", headers: {"Proxy-Authorization": "..."}}})`.
- HTTP/2 / HTTP/3 client: `fetch(url, {protocol:"http2"})` (h3 experimental, `--experimental-http3-fetch`).
- Server HTTP/3: `Bun.serve({http3: true, tls: {...}})` (experimental; no `server.upgrade()`).
- `Response.textStream()` gives `ReadableStream<string>` directly.
- Low-memory hook: `process.on("memoryPressure", lvl => ...)` (`"warning"`/`"critical"`).
- Post-quantum crypto (ML-DSA/ML-KEM) in `crypto.subtle` and `node:crypto`.

## Test running (skip vitest-shard scripts, hand-rolled CI splits)

- `bun test --parallel[=N]` (workers, merged coverage/JUnit), `--isolate` (fresh globals per file), `--shard=1/3` for CI runners, `--timings=timings.json --update-timings` for time-balanced shards, `--changed[=main]` to run only affected tests, `jest.useFakeTimers()` supported.

## Package manager (skip npm-check-updates, depcheck, npm audit)

`bun audit fix`, `bun dedupe`, `bun prune [--production]`, `bun pm diff react@18 19`, `bun pm licenses`, `bun update '@types/*' --latest` (transitive-aware), `bun add zod --filter api`, nested `overrides` (npm/yarn/pnpm syntaxes all work), `bun install --linker=isolated` (pnpm-style global store).

## Build (skip babel-plugin-react-compiler wiring, esbuild metafile scripts)

`bun build --react-compiler`; `optimizeImports: ["antd"]` for barrel files; `feature("FLAG")` from `bun:bundle` + `--feature=FLAG` for compile-time flags; `files: {...}` for in-memory modules; `--metafile-md` for bundle analysis; `--compile --asset ./dir` embeds files readable via `node:fs`; `--bytecode --format=esm`; standard TC39 decorators work natively.

## Misc

- `bun repl` (native, with `-e`/`-p`).
- `--no-orphans` kills descendants when parent dies; `--no-env-file` skips .env in CI.
- Upgrade gotcha: 1.4's YAML parser is strict YAML 1.2 — `on:` now parses as the string `"on"` (not `true`), which changes behavior for code parsing GitHub Actions workflows with `Bun.YAML`.
- Bun 1.4 is the Rust rewrite; perf claims (URL parse 4.6×, regex-heavy libs up to 100×+, 40%+ lower server memory) mean "Bun is slow at X" priors from 1.2 are stale.

## Audit mode

When asked to slim a Bun project's dependencies: read package.json, flag every dep in the table above, confirm each call site is replaceable (API shape differs — e.g. sharp's chained API maps closely to `Bun.Image`, but check options), replace, then `bun prune && bun dedupe`.
