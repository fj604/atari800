(() => {
  const USERDATA_DIR = '/userdata';
  const MEDIA_META_KEY = 'atari800.web.mediaMeta.v1';
  const statusEl = document.getElementById('status');
  const currentMediaEl = document.getElementById('current-media');
  const selectEl = document.getElementById('images');
  const canvas = document.getElementById('canvas');

  function log(msg) {
    statusEl.textContent = `${msg}\n${statusEl.textContent}`.slice(0, 4000);
  }

  function getSelectedPath() {
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? opt.value : null;
  }

  function getStartupPath() {
    const params = new URLSearchParams(window.location.search);
    return params.get('media') || '';
  }


  function reloadWithMedia(path) {
    const url = new URL(window.location.href);
    if (path) {
      url.searchParams.set('media', path);
    } else {
      url.searchParams.delete('media');
    }
    window.location.href = url.toString();
  }

  function readMediaMeta() {
    try {
      const raw = window.localStorage.getItem(MEDIA_META_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeMediaMeta(meta) {
    try {
      window.localStorage.setItem(MEDIA_META_KEY, JSON.stringify(meta));
    } catch {
      // ignore storage write failures
    }
  }

  function setMediaMeta(path, fileInfo) {
    const meta = readMediaMeta();
    meta[path] = fileInfo;
    writeMediaMeta(meta);
  }

  function getMediaMeta(path) {
    const meta = readMediaMeta();
    return meta[path] || null;
  }

  // Maps raw ROM size in bytes to Atari 8-bit standard cartridge type numbers.
  // See src/cartridge_info.h for the full list.
  const STD_CART_TYPE_BY_SIZE = {
    2048:  57,  // CARTRIDGE_STD_2
    4096:  58,  // CARTRIDGE_STD_4
    8192:  1,   // CARTRIDGE_STD_8  (River Raid, BASIC, most 8KB titles)
    16384: 2,   // CARTRIDGE_STD_16
    32768: 12,  // CARTRIDGE_XEGS_32 (most common 32KB bank-switched type)
  };

  function classifyArgs(path) {
    if (!path) return [];
    const lower = path.toLowerCase();
    if (lower.endsWith('.state') || lower.endsWith('.a8s')) return ['-state', path];
    if (lower.endsWith('.cas')) return ['-boottape', path];
    if (lower.endsWith('.a52')) return ['-5200', '-cart', path];
    if (lower.endsWith('.car')) return ['-cart', path];
    if (lower.endsWith('.rom') || lower.endsWith('.bin')) {
      // Always supply -cart-type so the emulator never enters its interactive
      // cart-type selection menu, which blocks the browser tab indefinitely.
      const meta = getMediaMeta(path);
      const size = meta && typeof meta.size === 'number' ? meta.size : 0;
      const cartType = STD_CART_TYPE_BY_SIZE[size] !== undefined
        ? STD_CART_TYPE_BY_SIZE[size]
        : 1; // fall back to STD_8 for unrecognised sizes
      return ['-cart', path, '-cart-type', String(cartType)];
    }
    if (lower.endsWith('.xex') || lower.endsWith('.com') || lower.endsWith('.exe')) return ['-run', path];
    return [path];
  }

  function getStartupArgs(path) {
    const args = ['-no-video-accel'];
    return [...args, ...classifyArgs(path)];
  }


  const startupMediaPath = getStartupPath();
  const startupArgs = getStartupArgs(startupMediaPath);
  currentMediaEl.textContent = startupMediaPath || '(none)';
  if (startupMediaPath) {
    log(`Classifying ${startupMediaPath} as ${classifyArgs(startupMediaPath).join(' ')}`);
  }

  window.Module = {
    canvas,
    print: text => log(text),
    printErr: text => log(`ERR: ${text}`),
    arguments: startupArgs,
    preRun: [() => {
      FS.mkdirTree(USERDATA_DIR);
      FS.mount(IDBFS, {}, USERDATA_DIR);
      addRunDependency('idbfs');
      FS.syncfs(true, (err) => {
        if (err) {
          log(`Failed to load browser storage: ${err}`);
        } else {
          log('Browser storage mounted.');
        }
        removeRunDependency('idbfs');
      });
    }],
    onRuntimeInitialized: () => {
      log('Atari800 runtime initialized.');
      log(`Startup arguments: ${startupArgs.length ? startupArgs.join(' ') : '(none)'}`);
      if (startupMediaPath) {
        try {
          const stat = FS.stat(startupMediaPath);
          log(`Media file exists: ${startupMediaPath}, size: ${stat.size}`);
          const content = FS.readFile(startupMediaPath, {encoding: 'binary'});
          log(`Media file first 16 bytes: ${Array.from(content.slice(0,16)).map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
        } catch (err) {
          log(`Media file not accessible: ${startupMediaPath}, error: ${err}`);
        }
      }
      refreshList();
    }
  };

  function saveToStorage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const target = `${USERDATA_DIR}/${safeName}`;
          FS.writeFile(target, data);
          setMediaMeta(target, { size: data.byteLength, mtime: Date.now(), originalName: file.name });
          FS.syncfs(false, (err) => {
            if (err) reject(err);
            else resolve(target);
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function refreshList() {
    if (typeof FS === 'undefined') {
      return;
    }
    selectEl.innerHTML = '';
    try {
      const entries = FS.readdir(USERDATA_DIR)
        .filter(name => name !== '.' && name !== '..')
        .sort((a, b) => a.localeCompare(b));
      const meta = readMediaMeta();
      for (const name of entries) {
        const path = `${USERDATA_DIR}/${name}`;
        try {
          const stat = FS.stat(path);
          meta[path] = { size: stat.size, mtime: Date.now() };
        } catch {
          // ignore per-file stat failures
        }
        const opt = document.createElement('option');
        const fileMeta = getMediaMeta(path);
        opt.textContent = fileMeta && fileMeta.originalName ? fileMeta.originalName : name;
        opt.value = path;
        selectEl.appendChild(opt);
      }
      writeMediaMeta(meta);
      log(`Found ${entries.length} stored image(s).`);
    } catch (err) {
      log(`Unable to list images: ${err}`);
    }
  }

  async function addFiles(files) {
    if (!files.length || typeof FS === 'undefined') return;
    for (const file of files) {
      try {
        const path = await saveToStorage(file);
        log(`Saved ${file.name} -> ${path}`);
      } catch (err) {
        log(`Failed to save ${file.name}: ${err}`);
      }
    }
    refreshList();
  }

  document.getElementById('add-files').addEventListener('change', async (e) => {
    await addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  });

  document.getElementById('refresh-list').addEventListener('click', refreshList);

  document.getElementById('delete-selected').addEventListener('click', () => {
    const path = getSelectedPath();
    if (!path || typeof FS === 'undefined') return;
    try {
      FS.unlink(path);
      FS.syncfs(false, (err) => {
        if (err) log(`Delete failed: ${err}`);
        else log(`Deleted ${path}`);
        refreshList();
      });
    } catch (err) {
      log(`Delete failed: ${err}`);
    }
  });

  document.getElementById('launch').addEventListener('click', () => {
    const path = getSelectedPath();
    if (!path) {
      log('Select an image first.');
      return;
    }
    reloadWithMedia(path);
  });

  document.getElementById('clear-arg').addEventListener('click', () => reloadWithMedia(''));


  document.getElementById('toggle-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen?.().catch(err => log(`Fullscreen failed: ${err}`));
    } else {
      document.exitFullscreen?.().catch(err => log(`Exit fullscreen failed: ${err}`));
    }
  });

  // Intercept problematic function keys in the capture phase so they never
  // reach Emscripten's SDL event queue.
  //   F1  -> AKEY_UI   : blocking menu loop (hangs the browser)
  //   F8  -> monitor   : blocking interactive monitor (hangs the browser)
  //   F9  -> AKEY_EXIT : calls exit(0), kills the WASM module
  //   F11 -> toggle fullscreen (handled here, not passed to emulator)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      e.stopImmediatePropagation();
      log('F1 (UI menu) is not available in the browser version.');
      return;
    }
    if (e.key === 'F8') {
      e.preventDefault();
      e.stopImmediatePropagation();
      log('F8 (monitor) is not available in the browser version.');
      return;
    }
    if (e.key === 'F9') {
      e.preventDefault();
      e.stopImmediatePropagation();
      log('F9 (exit): reload the page to restart the emulator.');
      return;
    }
    if (e.key === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        canvas.requestFullscreen?.().catch(err => log(`Fullscreen failed: ${err}`));
      } else {
        document.exitFullscreen?.().catch(err => log(`Exit fullscreen failed: ${err}`));
      }
    }
  }, /* capture */ true);

  const script = document.createElement('script');
  script.src = 'dist/atari800.js';
  script.onerror = () => log('Failed to load dist/atari800.js. Build the web port first.');
  document.body.appendChild(script);

  // ---------------------------------------------------------------------------
  // Gamepad / controller support
  // ---------------------------------------------------------------------------
  // Browsers only expose gamepads after the user presses a button on them
  // (security requirement).  We listen for the 'gamepadconnected' event and
  // also poll periodically so the status indicator stays up-to-date.
  // Emscripten's SDL2 backend connects to the Gamepad API automatically once
  // SDL_INIT_JOYSTICK is called, so we don't need to forward any data – we just
  // update the UI.

  const gamepadStatusEl = document.getElementById('gamepad-status');

  function updateGamepadStatus() {
    if (!navigator.getGamepads) {
      if (gamepadStatusEl) gamepadStatusEl.textContent = 'Gamepad API not supported in this browser.';
      return;
    }
    const pads = Array.from(navigator.getGamepads()).filter(Boolean);
    if (!gamepadStatusEl) return;
    if (pads.length === 0) {
      gamepadStatusEl.textContent = 'no gamepad detected';
    } else {
      gamepadStatusEl.textContent = pads.map((p, i) => `#${i}: ${p.id.slice(0, 40)}`).join('; ');
    }
  }

  window.addEventListener('gamepadconnected', (e) => {
    log(`Gamepad connected: ${e.gamepad.id} (index ${e.gamepad.index})`);
    updateGamepadStatus();
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    log(`Gamepad disconnected: ${e.gamepad.id} (index ${e.gamepad.index})`);
    updateGamepadStatus();
  });

  // Poll every 2 s so the status widget refreshes even if gamepads were already
  // connected before the page loaded.
  setInterval(updateGamepadStatus, 2000);
  updateGamepadStatus();
})();
