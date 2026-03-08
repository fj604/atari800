#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EMSDK_DIR="${EMSDK_DIR:-/workspace/emsdk}"
BUILD_DIR="$ROOT_DIR"
DIST_DIR="$ROOT_DIR/web/dist"

source "$EMSDK_DIR/emsdk_env.sh" >/dev/null

cd "$BUILD_DIR"

./autogen.sh

emconfigure ./configure \
  --with-video=sdl2 \
  --with-sound=sdl2 \
  --disable-sdltest \
  --without-opengl \
  --disable-eventrecording \
  --disable-netsio \
  --disable-riodevice \
  --disable-rserial \
  --disable-rnetwork \
  CFLAGS='-O2 -sUSE_SDL=2 -sSINGLE_FILE=1' \
  LDFLAGS='-sUSE_SDL=2 -sSINGLE_FILE=1'

emmake make -j"$(nproc)" V=1

mkdir -p "$DIST_DIR"
cp src/atari800 "$DIST_DIR/atari800.js"
if [[ -f src/atari800.wasm ]]; then
  cp src/atari800.wasm "$DIST_DIR/atari800.wasm"
elif [[ -f a.wasm ]]; then
  cp a.wasm "$DIST_DIR/atari800.wasm"
fi
cp web/index.html web/styles.css web/app.js "$DIST_DIR/"

echo "Built web bundle in $DIST_DIR"
