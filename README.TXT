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

WebAssembly / Emscripten port
-----------------------------
A browser build is provided in the `web/` directory. It uses SDL2 through
Emscripten and runs fully client-side in the browser.

Startup asset and legal note:
- Default startup uses the built-in Altirra replacement ROMs already present in
  this source tree (`src/roms/altirra*` compiled in).
- No copyrighted Atari ROM is bundled by this web packaging layer.

Build and run:
1. Install emsdk in this environment and activate it.
2. Run `npm install`.
3. Run `npm run build:web`.
4. Serve `web/dist` (for example: `python3 -m http.server 4173 -d web/dist`).
5. Open `http://127.0.0.1:4173/atari800.html`.

Browser UI features:
- Fullscreen toggle.
- Audio unlock button and first-gesture audio resume flow.
- Centered responsive layout with preserved canvas aspect ratio.
- IndexedDB-based media library (import/list/load/delete) for persistent
  browser-local storage.
- Touch joystick overlay (auto-enabled on touch-capable devices) with
  movement + fire, and settings toggle.
- Web build intentionally disables SDL OpenGL path to avoid browser EGL
  context failures; software SDL path is used instead.

Input mapping:
- Joystick 0: Arrow keys = direction, Left Ctrl = fire.
- OPTION/SELECT/START quick host mapping: 1/2/3.
- UI key remains F1.

Playwright test suite:
- `npm run test:web`
- Covers startup rendering, visibility, centered layout, fullscreen,
  media-import UI presence, keyboard path, audio initialization signal,
  responsive behavior at multiple viewport sizes, and touch controls.
