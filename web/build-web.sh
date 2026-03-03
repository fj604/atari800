#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build-web"
DIST_DIR="${ROOT_DIR}/web/dist"

if ! command -v emcc >/dev/null 2>&1; then
  cat >&2 <<'MSG'
emcc not found.
Install the latest emscripten SDK first, for example:
  git clone https://github.com/emscripten-core/emsdk.git
  cd emsdk
  ./emsdk install latest
  ./emsdk activate latest
  source ./emsdk_env.sh
MSG
  exit 1
fi

mkdir -p "${BUILD_DIR}" "${DIST_DIR}"

cd "${ROOT_DIR}"
if [[ ! -x ./configure ]]; then
  autoreconf -fi
fi

cd "${BUILD_DIR}"
emconfigure "${ROOT_DIR}/configure" \
  --target=default \
  --disable-shared \
  --enable-cursesbasic=no \
  --enable-netsio=no \
  --enable-riodevice=no \
  --with-readline=no \
  --with-video=sdl2 \
  --with-sound=sdl2 \
  --disable-monitorbreak \
  CFLAGS="-O3" \
  LDFLAGS="-sUSE_SDL=2 -sALLOW_MEMORY_GROWTH=1 -sWASM=1 -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=['FS','IDBFS'] -lidbfs.js"

emmake make -j"$(nproc)"

OUTPUT=""
for candidate in "${BUILD_DIR}/src/atari800.js" "${BUILD_DIR}/src/atari800"; do
  if [[ -f "${candidate}" ]]; then
    OUTPUT="${candidate}"
    break
  fi
done

if [[ -z "${OUTPUT}" ]]; then
  echo "Build succeeded but output file not found in ${BUILD_DIR}/src" >&2
  exit 1
fi

cp "${OUTPUT}" "${DIST_DIR}/atari800.js"

if [[ -f "${BUILD_DIR}/src/atari800.wasm" ]]; then
  cp "${BUILD_DIR}/src/atari800.wasm" "${DIST_DIR}/atari800.wasm"
fi

echo "Built ${DIST_DIR}/atari800.js"
