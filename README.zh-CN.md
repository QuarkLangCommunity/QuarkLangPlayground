# QuarkLang 在线演练场

**简体中文** · [English](README.md)

在浏览器里跑 QuarkLang：**解释器编译成 WebAssembly**，与 `quark` 命令行和 `qkc`（LLVM 编译器）共用同一前端。

**在线地址**：https://quarklangcommunity.github.io/QuarkLangPlayground/

## 这个页面能做什么

| | |
|---|---|
| 实时诊断 | 每次敲字停顿就用真正的前端（lex → 宏 → parse → 类型检查）跑一遍 `quarkCheck` |
| 安全执行 | 程序跑在 **Web Worker** 里，`Stop` 直接终止——死循环不会卡住页面 |
| stdin | 右侧输入框按行喂给 `io.readln()` |
| 示例 | 六个可运行示例（递归、struct/impl/泛型、实现严格的接口、List/HashTable、stdin） |
| 分享 | 整份代码编码进 URL 片段 |
| 诊断语言 | 英文 / 中文（`quarkSetLang`） |

引擎不是重写的：`web/` 调用语言仓库里的 `cmd/quarkwasm`，用 `GOOS=js GOARCH=wasm` 构建。
当前体积：**12.9 MB**（gzip 后 **3.4 MB**，Go 1.26，`-trimpath -ldflags "-s -w"`）。

## JavaScript 接口

模块在 worker 全局对象上装五个函数：

| 函数 | 返回 |
|---|---|
| `quarkVersion()` | 引擎版本（`-ldflags -X main.version` 注入） |
| `quarkLang()` / `quarkSetLang('en' \| 'zh')` | 当前诊断语言 / 切换 |
| `quarkCheck(source, filename)` | `{ok, error}`——只跑前端，快到可以每次敲键都跑 |
| `quarkRun(source, stdin, filename)` | `{ok, output, error, ms}`——编译并执行，捕获 stdout，运行期错误按 `ReportError` 格式化 |

## 本地构建

```sh
git clone https://github.com/QuarkLangCommunity/QuarkLangQkc   # 语言仓库
git clone https://github.com/QuarkLangCommunity/QuarkLangPlayground
cd QuarkLangPlayground
./build.sh --quark ../QuarkLang --version dev   # → dist/
python3 -m http.server -d dist 8080             # 打开 http://localhost:8080
```

`build.sh` 从 checkout 编译 `cmd/quarkwasm`，从 Go 发行版复制 `wasm_exec.js`，把 `web/` 组装进 `dist/`。
`QUARK_DIR`（或 `--quark`）指向语言仓库——引擎是**构建出来的，从不 vendor**，所以演练场不会与工具链脱节。

## 测试

```sh
(cd ../QuarkLang && go build -o ../quark-ref .)
node test/run.js dist --interpreter ./quark-ref   # 引擎自检 + 每个示例与解释器逐字节对比
node test/dom.js                                  # 页面接线：id、资源、manifest
```

`test/run.js` 断言每个示例的输出与真解释器**逐字节一致**（退出码也一致），另外覆盖实时诊断、stdin、除零报错与启动耗时。

## 目录

- `web/` —— 应用本体：`index.html`、`style.css`、`app.js`（编辑器/界面）、`worker.js`（持有 wasm 模块）、`examples/`
- `test/` —— `run.js`（引擎，与解释器对比）、`dom.js`（静态接线检查）
- `build.sh` —— 引擎 + 资源 → `dist/`
- `.github/workflows/` —— `ci.yml`（每次推送构建 + 测试）、`pages.yml`（把 `dist/` 发布到 GitHub Pages）

## 许可

[MIT](LICENSE)。
