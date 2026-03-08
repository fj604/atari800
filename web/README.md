# Atari800 WebAssembly Port

This directory contains an Emscripten/WebAssembly port of Atari800 built on top of the existing `libatari800` target.

## What is implemented

- Core Atari800 emulation via upstream `libatari800` API with minimal shim layer.
- Browser UI with canvas display, media controls, reset controls, status line.
- Drag-and-drop import and file picker import.
- IndexedDB-backed media library (disk/cart/tape/ROM/state assets).
- Mount disk (`D1`) and reboot/run from selected media.
- Save/load quick state to `/userdata/saves/quick.a8s`.
- Fullscreen toggle.
- Keyboard + WASD/space joystick emulation.
- Basic browser Gamepad API polling mapped to joystick 0.

## Build

Prerequisites:

- Emscripten SDK activated (`emcc`, `emconfigure`, `emmake` on PATH)
- Autotools (`autoreconf`)

Build command:

```bash
./web/build-web.sh
```

Artifacts are placed in `web/dist/`:

- `atari800-web.wasm`
- `atari800-web.js`
- `index.html`
- `app.js`
- `style.css`

## Run locally

Serve `web/dist` with any static HTTP server:

```bash
cd web/dist
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## ROMs and media import

No copyrighted Atari ROMs are bundled. Import user-provided ROM files via the file picker or drag-and-drop.

- ROM-like files (detected by filename) are placed in `/userdata/roms`
- Other media goes to `/userdata/library`
- Save states are written to `/userdata/saves`

`app.js` stores imported binaries in IndexedDB and mirrors them into the Emscripten FS at runtime.

## Browser mapping notes

- Native file dialogs/map menus are replaced by browser UI controls.
- Desktop fullscreen is replaced by the browser Fullscreen API.
- SDL joystick enumeration is replaced by browser keyboard/gamepad mapping.
- Filesystem persistence uses IndexedDB + Emscripten FS rather than host filesystem paths.

## Known limitations

- Audio output path is not fully wired in this frontend yet (mute button is placeholder behavior).
- UI currently mounts only drive D1 directly; multi-drive UI can be added.
- Key mapping is intentionally minimal and should be expanded for full Atari keyboard parity.
- Save-state slots are currently limited to one quick-state path.
- No cloud sync; storage is local to the browser profile.

## Future enhancements

- Expand settings panel to expose more Atari800 runtime options.
- Improve key/gamepad remapping UI and persist per-user mappings.
- Add multi-drive mount/eject and tape transport UI.
- Add optional integer scaling toggle and scanline/CRT filter controls.
