#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f web/dist/atari800.js || ! -f web/dist/index.html || ! -f web/dist/app.js || ! -f web/dist/styles.css ]]; then
  ./scripts/build-web.sh
fi

exec python3 -m http.server 4173 -d web/dist
