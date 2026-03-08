Atari800 emulator version 5.2.0
-------------------------------

This is a free and portable Atari 8-bit computer and 5200 console emulator,
originally written by David Firth and now developed by the Atari800
Development Team (please see DOC/CREDITS). This program is copyrighted and
released under the GPL (see COPYING).

Please read DOC/README, DOC/INSTALL and DOC/USAGE and eventual platform
specific versions of the above mentioned files.

For news in this release please read DOC/NEWS.

If you have a problem running this emulator please read DOC/FAQ first.
If the problem persists then please ask in newsgroup comp.sys.atari.8bit
or in the atari800-users mailing list (see below).

Look at DOC/BUGS before reporting something you consider a bug.

If you want to help developing Atari800 emulator you can subscribe to our
mailing list (http://lists.sourceforge.net/lists/listinfo/atari800-users).
DOC/TODO might point you in the right direction.

This version, and all previous versions back to v0.8.2 have been released Petr
Stehlik and are available at internet (current project URL is below). Thanks
go to original author David Firth and all the people that contributed since then.

EnJoy!

Petr Stehlik
Dec 29, 2023

E-mail: pstehlik@sophics.cz

Project homepage: http://atari800.github.io/

WebAssembly/Emscripten browser port
----------------------------------

This repository now includes a browser-targeted Atari800 build using Emscripten + SDL2.

Quick start:
1. Install emsdk (default path used by scripts: /workspace/emsdk).
2. Run: `scripts/build-web.sh`
3. Serve `web/dist` (for example: `python3 -m http.server 4173 -d web/dist`).
4. Open the page and click "Start Emulator".

Implemented browser-facing features:
- SDL2-based Atari800 compiled to WebAssembly (client-side only).
- Browser UI with centered display, fullscreen toggle, reset buttons, audio unlock button, drag-and-drop and file picker import.
- IndexedDB-backed local media library for cartridge/disk/tape/state files (add, mount, delete).
- Keyboard mapping documentation in UI.
- Web-default joystick mapping in Emscripten builds:
  - Joystick 0: Arrow keys + Right Ctrl
  - Joystick 1: Arrow keys + Left Ctrl
- Web-default Atari special key mapping in Emscripten builds:
  - Option=1, Select=2, Start=3, Reset=4, Help=5, Break=6, Monitor=7, Exit=8, Screenshot=9

Playwright E2E tests:
- Config: `playwright.config.ts`
- Tests: `tests/web.spec.ts`
- Run: `npm install && npx playwright install chromium && npm run test:e2e`
- Includes a boot smoke test that starts the emulator with built-in Altirra defaults and verifies runtime/display startup state.

Limitations and notes:
- No copyrighted Atari ROM images are bundled; users must import their own ROM/media assets.
- Browser automation can verify audio-unlock flow and UI observables, but cannot fully assert synthesized Atari audio wave fidelity.
- Browser port build disables host-specific NetSIO and R: serial/network device support for compatibility.
