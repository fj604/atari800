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
  key: null,
  audio: {
    ctx: null,
    node: null,
    queue: [],
    offset: 0,
    channels: 2,
    started: false
  }
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
    if (r.type !== 'rom') bootSelect.add(new Option(r.name, `${r.type}:${r.name}`));
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

function initAudioIfNeeded() {
  if (state.audio.started || !state.mod) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const c = state.mod.ccall;
  const channels = Math.max(1, c('web_atari800_get_sound_channels', 'number', [], []));
  state.audio.channels = channels;
  state.audio.ctx = new AudioContextClass({ sampleRate: c('web_atari800_get_sound_freq', 'number', [], []) || 44100 });
  state.audio.node = state.audio.ctx.createScriptProcessor(2048, 0, 2);
  state.audio.node.onaudioprocess = (event) => {
    const outL = event.outputBuffer.getChannelData(0);
    const outR = event.outputBuffer.getChannelData(1);
    outL.fill(0); outR.fill(0);
    if (state.muted) return;

    for (let i = 0; i < outL.length; i += 1) {
      while (state.audio.queue.length && state.audio.offset >= state.audio.queue[0].length) {
        state.audio.queue.shift();
        state.audio.offset = 0;
      }
      if (!state.audio.queue.length) break;
      const frame = state.audio.queue[0];
      if (state.audio.channels === 1) {
        const s = frame[state.audio.offset++];
        outL[i] = s;
        outR[i] = s;
      }
      else {
        outL[i] = frame[state.audio.offset++] || 0;
        outR[i] = frame[state.audio.offset++] || 0;
      }
    }
  };
  state.audio.node.connect(state.audio.ctx.destination);
  state.audio.ctx.resume();
  state.audio.started = true;
}

function pushAudioFrame() {
  if (!state.audio.started || !state.audio.ctx || state.muted) return;
  const c = state.mod.ccall;
  const ptr = c('web_atari800_get_sound_ptr', 'number', [], []);
  const len = c('web_atari800_get_sound_len', 'number', [], []);
  const sampleSize = c('web_atari800_get_sound_sample_size', 'number', [], []);
  const channels = Math.max(1, c('web_atari800_get_sound_channels', 'number', [], []));
  const heap = state.mod.HEAPU8 || (state.mod.wasmMemory ? new Uint8Array(state.mod.wasmMemory.buffer) : null);
  if (!heap || ptr <= 0 || len <= 0) return;

  let pcm;
  if (sampleSize === 2) {
    const view = new Int16Array(heap.buffer, ptr, len / 2);
    pcm = new Float32Array(view.length);
    for (let i = 0; i < view.length; i += 1) pcm[i] = view[i] / 32768;
  }
  else {
    const view = heap.subarray(ptr, ptr + len);
    pcm = new Float32Array(view.length);
    for (let i = 0; i < view.length; i += 1) pcm[i] = (view[i] - 128) / 128;
  }

  state.audio.channels = channels;
  state.audio.queue.push(pcm);
  if (state.audio.queue.length > 12) state.audio.queue.shift();
}

function startLoop() {
  state.running = true;
  const width = state.mod.ccall('web_atari800_get_width', 'number', [], []);
  const height = state.mod.ccall('web_atari800_get_height', 'number', [], []);
  canvas.width = width;
  canvas.height = height;

  const tick = () => {
    if (!state.running) return;
    applyInput();
    const ok = state.mod.ccall('web_atari800_frame', 'number', [], []);
    if (!ok) {
      status(`Emulator error: ${state.mod.UTF8ToString(state.mod.ccall('web_atari800_last_error', 'number', [], []))}`);
    }
    const ptr = state.mod.ccall('web_atari800_get_rgba_ptr', 'number', [], []);
    const heap = state.mod.HEAPU8 || (state.mod.wasmMemory ? new Uint8Array(state.mod.wasmMemory.buffer) : null);
    if (!heap) {
      status('Renderer error: WASM heap view unavailable');
      state.running = false;
      return;
    }
    imageData.data.set(heap.subarray(ptr, ptr + (384 * 240 * 4)));
    ctx.putImageData(imageData, 0, 0);
    pushAudioFrame();
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

document.getElementById('ejectDiskBtn').onclick = () => {
  state.mod.ccall('web_atari800_unmount_disk', null, ['number'], [1]);
  status('Ejected disk from D1');
};

document.getElementById('runBtn').onclick = () => {
  const selected = document.getElementById('bootSelect').value;
  if (!selected) return;
  const [type, name] = selected.split(':', 2);
  const path = `${LIB}/${name}`;
  let ok = 0;
  if (type === 'cartrom') {
    ok = state.mod.ccall('web_atari800_mount_cartridge', 'number', ['string'], [path]);
    status(ok === 0 ? `Mounted cartridge ${name}` : `Cartridge mount returned ${ok}`);
  }
  else {
    ok = state.mod.ccall('web_atari800_reboot_with_file', 'number', ['string'], [path]);
    status(ok ? `Booted ${name}` : `Failed to boot ${name}`);
  }
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
  document.getElementById('muteBtn').textContent = state.muted ? 'Unmute' : 'Mute';
};

setTempConsole('startBtn', 'start');
setTempConsole('selectBtn', 'select');
setTempConsole('optionBtn', 'option');

const tryStartAudio = () => initAudioIfNeeded();
window.addEventListener('pointerdown', tryStartAudio, { passive: true });
window.addEventListener('keydown', tryStartAudio, { passive: true });

window.addEventListener('keydown', (ev) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Control', 'ControlLeft', 'ControlRight'].includes(ev.key) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft', 'ControlRight'].includes(ev.code)) {
    ev.preventDefault();
  }

  if (ev.code === 'ArrowUp') state.joystick.nibble &= ~0x1;
  if (ev.code === 'ArrowDown') state.joystick.nibble &= ~0x2;
  if (ev.code === 'ArrowLeft') state.joystick.nibble &= ~0x4;
  if (ev.code === 'ArrowRight') state.joystick.nibble &= ~0x8;
  if (ev.code === 'ControlLeft' || ev.code === 'ControlRight') state.joystick.trigger = 1;

  const k = keyToAtari(ev);
  if (k) state.key = { kind: k[0], value: k[1], shift: ev.shiftKey, ctrl: ev.ctrlKey };
});

window.addEventListener('keyup', (ev) => {
  state.key = null;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) state.joystick.nibble = 15;
  if (ev.code === 'ControlLeft' || ev.code === 'ControlRight') state.joystick.trigger = 0;
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
