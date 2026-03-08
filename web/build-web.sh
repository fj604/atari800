#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build-web"
OUT_DIR="${ROOT_DIR}/web/dist"

mkdir -p "${BUILD_DIR}" "${OUT_DIR}"

cd "${ROOT_DIR}"
if [[ ! -f configure ]]; then
  autoreconf -fi
fi

cd "${BUILD_DIR}"
emconfigure "${ROOT_DIR}/configure" --target=libatari800 --disable-shared \
  --disable-riodevice \
  --disable-netsio
emmake make -j"$(nproc)"

emcc "${ROOT_DIR}/web/atari800_emscripten.c" \
  "${BUILD_DIR}/src/libatari800.a" \
  -I"${ROOT_DIR}/src" -I"${ROOT_DIR}/src/libatari800" \
  -O2 \
  -sWASM=1 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=0 \
  -sEXPORTED_RUNTIME_METHODS=ccall,FS,UTF8ToString \
  -sEXPORTED_FUNCTIONS=_malloc,_free \
  -sINITIAL_MEMORY=134217728 \
  -o "${OUT_DIR}/atari800-web.js"

cp "${ROOT_DIR}/web/index.html" "${ROOT_DIR}/web/app.js" "${ROOT_DIR}/web/style.css" "${OUT_DIR}/"

echo "Built web port into ${OUT_DIR}"
