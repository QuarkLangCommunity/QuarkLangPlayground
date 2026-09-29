#!/usr/bin/env bash
# Build the playground: compile the canonical interpreter to WebAssembly and assemble dist/.
#
#   ./build.sh [--quark <checkout>] [--out dist] [--version vX.Y.Z]
#
# The engine is not vendored: it is built from the QuarkLangQkc checkout next to this repo by
# default (QUARK_DIR overrides), so the playground can never drift from the real front end.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
QUARK="${QUARK_DIR:-$ROOT/../QuarkLang}"
OUT="$ROOT/dist"
VERSION="${VERSION:-dev}"

while [ $# -gt 0 ]; do
  case "$1" in
    --quark) QUARK="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -d "$QUARK/cmd/quarkwasm" ] || { echo "error: $QUARK has no cmd/quarkwasm (set --quark or QUARK_DIR)" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"

echo '-> compiling the interpreter to WebAssembly (GOOS=js GOARCH=wasm)' >&2
(cd "$QUARK" && GOOS=js GOARCH=wasm go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o "$OUT/quark.wasm" ./cmd/quarkwasm)
cp "$(cd "$QUARK" && go env GOROOT)/lib/wasm/wasm_exec.js" "$OUT/"

echo '-> assembling the web app' >&2
cp -r "$ROOT/web/." "$OUT/"

wasm_size="$(du -h "$OUT/quark.wasm" | cut -f1)"
gz_size="$(gzip -c "$OUT/quark.wasm" | wc -c)"
echo "dist ready: wasm $wasm_size, gzipped $gz_size bytes" >&2
