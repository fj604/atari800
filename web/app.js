const DB_NAME = 'atari800-web';
const STORE = 'media';
const ROOT = '/userdata';
const LIB = `${ROOT}/library`;
const ROMS = `${ROOT}/roms`;
const SAVES = `${ROOT}/saves`;

const state = {
  db: null,
  mod: null,
  running: false,
  muted: false,
  console: { start: 0, select: 0, option: 0 },
  joystick: { nibble: 15, trigger: 0 },
  key: null
};

const statusEl = document.getElementById('status');
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const imageData = ctx.createImageData(384, 240);

function status(msg) { statusEl.textContent = msg; }

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbAll() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function extType(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.atr') || n.endsWith('.xfd') || n.endsWith('.atx') || n.endsWith('.dcm')) return 'disk';
  if (n.endsWith('.car') || n.endsWith('.rom') || n.endsWith('.bin')) return 'cartrom';
  if (n.endsWith('.cas') || n.endsWith('.wav')) return 'tape';
  if (n.endsWith('.a8s')) return 'state';
  if (n.includes('os') || n.includes('basic')) return 'rom';
  return 'other';
}

function syncToFs(record) {
  const path = record.type === 'rom' ? `${ROMS}/${record.name}` : `${LIB}/${record.name}`;
  state.mod.FS.writeFile(path, new Uint8Array(record.data));
}

async function refreshLibraryUI() {
  const list = await dbAll();
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  const mediaList = document.getElementById('mediaList');
  const diskSelect = document.getElementById('diskSelect');
  const bootSelect = document.getElementById('bootSelect');
  mediaList.innerHTML = '';
  diskSelect.innerHTML = '<option value="">-- select disk --</option>';
  bootSelect.innerHTML = '<option value="">-- select media --</option>';

  for (const r of list) {
    syncToFs(r);
    const row = document.createElement('div');
    row.className = 'media-row';
    row.innerHTML = `<span>${r.name} [${r.type}]</span>`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => { await dbDelete(r.id); refreshLibraryUI(); };
    row.appendChild(del);
    mediaList.appendChild(row);

    if (r.type === 'disk') diskSelect.add(new Option(r.name, r.name));
    if (r.type !== 'rom') bootSelect.add(new Option(r.name, r.name));
  }
}

async function importFiles(files) {
  for (const file of files) {
    const data = await file.arrayBuffer();
    const rec = { id: crypto.randomUUID(), name: file.name, type: extType(file.name), data, updatedAt: Date.now() };
    await dbPut(rec);
  }
  await refreshLibraryUI();
}

function keyToAtari(ev) {
  const m = {
    ArrowUp: ['code', 0x8e], ArrowDown: ['code', 0x8f], ArrowLeft: ['code', 0x86], ArrowRight: ['code', 0x87],
    Enter: ['char', 10], Backspace: ['char', 8], Escape: ['char', 27], Tab: ['char', 9],
    F2: ['special', 0x03], F3: ['special', 0x04], F4: ['special', 0x13], F5: ['special', 0x14]
  };
  if (m[ev.key]) return m[ev.key];
  if (ev.key.length === 1) return ['char', ev.key.charCodeAt(0)];
  return null;
}

function applyInput() {
  const c = state.mod.ccall;
  c('web_atari800_input_begin', null, [], []);
  c('web_atari800_set_shift', null, ['number'], [state.key?.shift ? 1 : 0]);
  c('web_atari800_set_control', null, ['number'], [state.key?.ctrl ? 1 : 0]);
  c('web_atari800_set_console_keys', null, ['number', 'number', 'number'], [state.console.start, state.console.select, state.console.option]);
  c('web_atari800_set_joystick', null, ['number', 'number', 'number'], [0, state.joystick.nibble, state.joystick.trigger]);
  if (state.key) c(`web_atari800_set_${state.key.kind}`, null, ['number'], [state.key.value]);
}

function startLoop() {
  state.running = true;
  const width = state.mod.ccall('web_atari800_get_width', 'number', [], []);
  const height = state.mod.ccall('web_atari800_get_height', 'number', [], []);
  canvas.width = width; canvas.height = height;

  const tick = () => {
    if (!state.running) return;
    applyInput();
    const ok = state.mod.ccall('web_atari800_frame', 'number', [], []);
    if (!ok) status(`Emulator error: ${state.mod.UTF8ToString(state.mod.ccall('web_atari800_last_error', 'number', [], []))}`);
    const ptr = state.mod.ccall('web_atari800_get_rgba_ptr', 'number', [], []);
    const heap = state.mod.HEAPU8 || (state.mod.wasmMemory ? new Uint8Array(state.mod.wasmMemory.buffer) : null);
    if (!heap) {
      status('Renderer error: WASM heap view unavailable');
      state.running = false;
      return;
    }
    imageData.data.set(heap.subarray(ptr, ptr + (384 * 240 * 4)));
    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setTempConsole(buttonId, key) {
  const btn = document.getElementById(buttonId);
  btn.onmousedown = () => state.console[key] = 1;
  btn.onmouseup = btn.onmouseleave = () => state.console[key] = 0;
}

async function init() {
  state.db = await openDb();
  const moduleFactory = globalThis.Atari800Module || globalThis.Module;
  if (typeof moduleFactory !== 'function') {
    throw new Error('WASM loader not found. Build first and open web/dist/index.html so atari800-web.js is loaded.');
  }
  state.mod = await moduleFactory();

  for (const path of [ROOT, LIB, ROMS, SAVES]) state.mod.ccall('web_fs_ensure_dir', 'number', ['string'], [path]);

  const defaultCfg = `ATARI_FILES_DIR=${ROMS}\nSAVED_FILES_DIR=${SAVES}\nDISK_DIR=${LIB}\n`;
  try { state.mod.FS.writeFile(`${ROOT}/atari800.cfg`, defaultCfg); } catch (_) {}

  const ok = state.mod.ccall('web_atari800_init', 'number', [], []);
  if (!ok) status('Failed to initialize emulator. Import required ROMs and reload.');
  else status('Ready');

  await refreshLibraryUI();
  if (ok) startLoop();
}

document.getElementById('importFiles').addEventListener('change', (e) => importFiles(e.target.files));

document.getElementById('mountDiskBtn').onclick = () => {
  const name = document.getElementById('diskSelect').value;
  if (!name) return;
  const ok = state.mod.ccall('web_atari800_mount_disk', 'number', ['number', 'string', 'number'], [1, `${LIB}/${name}`, 0]);
  status(ok ? `Mounted ${name} in D1` : `Failed to mount ${name}`);
};

document.getElementById('runBtn').onclick = () => {
  const name = document.getElementById('bootSelect').value;
  if (!name) return;
  const ok = state.mod.ccall('web_atari800_reboot_with_file', 'number', ['string'], [`${LIB}/${name}`]);
  status(ok ? `Booted ${name}` : `Failed to boot ${name}`);
};

document.getElementById('warmResetBtn').onclick = () => state.mod.ccall('web_atari800_warm_reset', null, [], []);
document.getElementById('coldResetBtn').onclick = () => state.mod.ccall('web_atari800_cold_reset', null, [], []);
document.getElementById('saveStateBtn').onclick = () => state.mod.ccall('web_atari800_save_state', 'number', ['string'], [`${SAVES}/quick.a8s`]);
document.getElementById('loadStateBtn').onclick = () => state.mod.ccall('web_atari800_load_state', 'number', ['string'], [`${SAVES}/quick.a8s`]);

document.getElementById('fullscreenBtn').onclick = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await canvas.requestFullscreen();
};

document.getElementById('muteBtn').onclick = () => {
  state.muted = !state.muted;
  state.mod._SDL_PauseAudioDevice?.(0, state.muted ? 1 : 0);
};

setTempConsole('startBtn', 'start');
setTempConsole('selectBtn', 'select');
setTempConsole('optionBtn', 'option');

window.addEventListener('keydown', (ev) => {
  const k = keyToAtari(ev);
  if (k) {
    ev.preventDefault();
    state.key = { kind: k[0], value: k[1], shift: ev.shiftKey, ctrl: ev.ctrlKey };
  }
  if (ev.code === 'KeyW') state.joystick.nibble &= ~0x1;
  if (ev.code === 'KeyS') state.joystick.nibble &= ~0x2;
  if (ev.code === 'KeyA') state.joystick.nibble &= ~0x4;
  if (ev.code === 'KeyD') state.joystick.nibble &= ~0x8;
  if (ev.code === 'Space') state.joystick.trigger = 1;
});

window.addEventListener('keyup', (ev) => {
  state.key = null;
  if (['KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(ev.code)) state.joystick.nibble = 15;
  if (ev.code === 'Space') state.joystick.trigger = 0;
});

window.addEventListener('gamepadconnected', () => status('Gamepad connected'));

function pollGamepad() {
  const gp = navigator.getGamepads?.()[0];
  if (gp) {
    let n = 15;
    if (gp.axes[1] < -0.5) n &= ~0x1;
    if (gp.axes[1] > 0.5) n &= ~0x2;
    if (gp.axes[0] < -0.5) n &= ~0x4;
    if (gp.axes[0] > 0.5) n &= ~0x8;
    state.joystick.nibble = n;
    state.joystick.trigger = gp.buttons[0]?.pressed ? 1 : 0;
  }
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drag-over'); });
window.addEventListener('dragleave', () => document.body.classList.remove('drag-over'));
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('drag-over');
  if (e.dataTransfer?.files?.length) await importFiles(e.dataTransfer.files);
});

init().catch((e) => status(`Init failed: ${e.message}`));
