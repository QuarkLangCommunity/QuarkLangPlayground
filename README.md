# QuarkLang Playground

**English** · [简体中文](README.zh-CN.md)

Run QuarkLang in the browser: **the interpreter compiled to WebAssembly**, the same front end as the `quark` CLI and the `qkc` LLVM compiler.

**Live**: https://quarklangcommunity.github.io/QuarkLangPlayground/

## What the page gives you

| | |
|---|---|
| Live diagnostics | `quarkCheck` runs the real front end (lex → macros → parse → type check) on every pause while typing |
| Safe execution | the program runs in a **Web Worker**; `Stop` terminates it, so a runaway loop never freezes the tab |
| stdin | the stdin box is fed to `io.readln()` line by line |
| Examples | six runnable programs (recursion, struct/impl/generics, implementation-strict interfaces, List/HashTable, stdin) |
| Share | the whole program is encoded into the URL fragment |
| Diagnostics language | English or 中文 (`quarkSetLang`) |

The engine is not a re-implementation: `web/` talks to `cmd/quarkwasm` from the language repository, built with `GOOS=js GOARCH=wasm`.
Current size: **12.9 MB** raw, **3.4 MB gzipped** (Go 1.26, `-trimpath -ldflags "-s -w"`).

## JavaScript surface

The module installs five functions on the worker's global object:

| Function | Returns |
|---|---|
| `quarkVersion()` | the engine version (injected with `-ldflags -X main.version`) |
| `quarkLang()` / `quarkSetLang('en' \| 'zh')` | the diagnostics language in effect / switch it |
| `quarkCheck(source, filename)` | `{ok, error}` — front end only, fast enough for every keystroke |
| `quarkRun(source, stdin, filename)` | `{ok, output, error, ms}` — compile and run, stdout captured, runtime errors formatted by `ReportError` |

## Build locally

```sh
git clone https://github.com/QuarkLangCommunity/QuarkLangQkc   # the language repo
git clone https://github.com/QuarkLangCommunity/QuarkLangPlayground
cd QuarkLangPlayground
./build.sh --quark ../QuarkLang --version dev   # → dist/
python3 -m http.server -d dist 8080             # open http://localhost:8080
```

`build.sh` compiles `cmd/quarkwasm` from the checkout, copies `wasm_exec.js` from the Go distribution and assembles `web/` into `dist/`.
`QUARK_DIR` (or `--quark`) points at the language checkout — the engine is **built, never vendored**, so the playground cannot drift from the toolchain.

## Tests

```sh
(cd ../QuarkLang && go build -o ../quark-ref .)
node test/run.js dist --interpreter ./quark-ref   # engine checks + every example against the interpreter
node test/dom.js                                  # web wiring: ids, assets, manifest
```

`test/run.js` asserts that each example prints **byte for byte** what the real interpreter prints (and exits the same way); it also covers live diagnostics, stdin, division-by-zero reporting and the measured startup latency.

## Layout

- `web/` — the app: `index.html`, `style.css`, `app.js` (editor/UI), `worker.js` (owns the wasm module), `examples/`
- `test/` — `run.js` (engine, compares against the interpreter), `dom.js` (static wiring)
- `build.sh` — engine + assets → `dist/`
- `.github/workflows/` — `ci.yml` (build + tests on every push) and `pages.yml` (deploys `dist/` to GitHub Pages)

## License

[MIT](LICENSE).
