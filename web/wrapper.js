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

  function isSoundEnabled() {
    const params = new URLSearchParams(window.location.search);
    // Sound is ON by default; pass ?sound=0 to disable.
    return params.get('sound') !== '0';
  }

  function reloadWithMedia(path) {
    const url = new URL(window.location.href);
    if (path) {
      url.searchParams.set('media', path);
    } else {
      url.searchParams.delete('media');
    }
    // Preserve the current sound preference across reloads.
    if (!isSoundEnabled()) {
      url.searchParams.set('sound', '0');
    } else {
      url.searchParams.delete('sound');
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
    if (lower.endsWith('.cas')) return ['-tape', path];
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
    if (!isSoundEnabled()) {
      args.push('-nosound');
    }
    return [...args, ...classifyArgs(path)];
  }

  function toggleSound() {
    const url = new URL(window.location.href);
    if (isSoundEnabled()) {
      url.searchParams.set('sound', '0');
    } else {
      url.searchParams.delete('sound');
    }
    window.location.href = url.toString();
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

  const soundBtn = document.getElementById('toggle-sound');
  if (soundBtn) {
    soundBtn.textContent = isSoundEnabled() ? 'Sound: ON' : 'Sound: OFF';
    soundBtn.addEventListener('click', toggleSound);
  }

  document.getElementById('toggle-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen?.().catch(err => log(`Fullscreen failed: ${err}`));
    } else {
      document.exitFullscreen?.().catch(err => log(`Exit fullscreen failed: ${err}`));
    }
  });

  // Toggle fullscreen with F11 (prevent default browser handling)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        canvas.requestFullscreen?.().catch(err => log(`Fullscreen failed: ${err}`));
      } else {
        document.exitFullscreen?.().catch(err => log(`Exit fullscreen failed: ${err}`));
      }
    }
  });

  const script = document.createElement('script');
  script.src = 'dist/atari800.js';
  script.onerror = () => log('Failed to load dist/atari800.js. Build the web port first.');
  document.body.appendChild(script);
})();
