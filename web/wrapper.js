(() => {
  const USERDATA_DIR = '/userdata';
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

  function classifyArgs(path) {
    if (!path) return [];
    const lower = path.toLowerCase();
    if (lower.endsWith('.state') || lower.endsWith('.a8s')) return ['-state', path];
    if (lower.endsWith('.cas')) return ['-tape', path];
    if (lower.endsWith('.car') || lower.endsWith('.rom') || lower.endsWith('.bin')) return ['-cart', path];
    if (lower.endsWith('.xex') || lower.endsWith('.com') || lower.endsWith('.exe')) return ['-run', path];
    return [path];
  }

  const startupMediaPath = getStartupPath();
  currentMediaEl.textContent = startupMediaPath || '(none)';

  window.Module = {
    canvas,
    print: text => log(text),
    printErr: text => log(`ERR: ${text}`),
    arguments: classifyArgs(startupMediaPath),
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
      refreshList();
    }
  };

  function saveToStorage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const target = `${USERDATA_DIR}/${file.name}`;
          FS.writeFile(target, data);
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
      for (const name of entries) {
        const opt = document.createElement('option');
        opt.textContent = name;
        opt.value = `${USERDATA_DIR}/${name}`;
        selectEl.appendChild(opt);
      }
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
      const target = canvas.parentElement;
      target.requestFullscreen?.().catch(err => log(`Fullscreen failed: ${err}`));
    } else {
      document.exitFullscreen?.().catch(err => log(`Exit fullscreen failed: ${err}`));
    }
  });

  const script = document.createElement('script');
  script.src = 'dist/atari800.js';
  script.onerror = () => log('Failed to load dist/atari800.js. Build the web port first.');
  document.body.appendChild(script);
})();
