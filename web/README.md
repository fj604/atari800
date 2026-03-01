# Atari800 web port

This directory adds a browser-targeted Atari800 build and a minimal web wrapper.

## Features

- Builds Atari800 with **latest Emscripten** (`emsdk install latest`)
- Single-file JavaScript/WASM output usable from `file://` URLs
- Minimal `index.html` wrapper that:
  - persists uploaded images in IndexedDB (`IDBFS`)
  - supports ROM/cartridge/disk/tape/executable/state images
  - launches selected media by restarting with the right CLI argument
  - toggles fullscreen mode

## Build

```bash
./web/build-web.sh
```

Output:

- `web/dist/atari800.js`

## Run

Open `web/index.html` directly in a browser.

> Note: some browsers restrict `file://` execution of generated scripts. If your browser blocks it, serve the repository root with any static file server and open `/web/index.html`.

## Media argument mapping

The wrapper maps selected files to Atari800 startup arguments:

- `.a8s`, `.state` -> `-state`
- `.cas` -> `-tape`
- `.a52` -> `-5200 -cart`
- `.car` -> `-cart` (CART header format, type self-described)
- `.rom`, `.bin` -> `-cart -cart-type N` where N is inferred from file size:
  - 2 KB → type 57 (STD\_2)
  - 4 KB → type 58 (STD\_4)
  - 8 KB → type 1  (STD\_8, e.g. River Raid, Atari BASIC)
  - 16 KB → type 2  (STD\_16)
  - 32 KB → type 12 (XEGS\_32)
  - other sizes → type 1 (STD\_8 fallback)
- `.xex`, `.com`, `.exe` -> `-run`
- everything else -> positional argument (handled by Atari800 file-type detection, e.g. ATR/XFD/ATX images)
