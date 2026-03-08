const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');
const audioBtn = document.getElementById('audioBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const warmResetBtn = document.getElementById('warmResetBtn');
const coldResetBtn = document.getElementById('coldResetBtn');
const fileInput = document.getElementById('fileInput');
const libraryList = document.getElementById('libraryList');
window.__atariLog = [];
canvas.addEventListener('keydown', (e) => {
  window.__lastKey = e.key;
});

const DB_NAME = 'atari800-web';
const STORE = 'media';
let db;
let moduleStarted = false;

const mediaTypeFor = (name) => {
  const n = name.toLowerCase();
  if (n.endsWith('.car') || n.endsWith('.rom') || n.endsWith('.bin')) return 'cartridge';
  if (n.endsWith('.atr') || n.endsWith('.xfd') || n.endsWith('.dcm')) return 'disk';
  if (n.endsWith('.cas') || n.endsWith('.wav')) return 'tape';
  if (n.endsWith('.a8s') || n.endsWith('.state')) return 'state';
  return 'other';
};

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addMedia(file) {
  const rec = { id: crypto.randomUUID(), name: file.name, type: mediaTypeFor(file.name), updatedAt: Date.now(), data: await file.arrayBuffer() };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function listMedia() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.updatedAt - a.updatedAt));
    req.onerror = () => reject(req.error);
  });
}

async function deleteMedia(id) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function emulateAtariKey(k) {
  canvas.focus();
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  canvas.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
}

function commandForMedia(rec) {
  if (rec.type === 'cartridge') return ['-cart', `/media/${rec.name}`];
  if (rec.type === 'disk') return ['/media/' + rec.name];
  if (rec.type === 'tape') return ['-tape', `/media/${rec.name}`];
  if (rec.type === 'state') return ['-state', `/media/${rec.name}`];
  return [];
}

async function refreshLibrary() {
  const items = await listMedia();
  libraryList.innerHTML = '';
  for (const rec of items) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${rec.name} (${rec.type})</span>`;
    const mount = document.createElement('button');
    mount.textContent = 'Mount';
    mount.onclick = () => {
      localStorage.setItem('atari800-autoload', rec.id);
      location.reload();
    };
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => { await deleteMedia(rec.id); await refreshLibrary(); };
    li.appendChild(mount);
    li.appendChild(del);
    libraryList.appendChild(li);
  }
}

async function startEmulator() {
  if (moduleStarted) return;
  moduleStarted = true;
  statusEl.textContent = 'Loading emulator...';

  const selectedId = localStorage.getItem('atari800-autoload');
  const media = await listMedia();
  const selected = media.find(m => m.id === selectedId);
  const fsMedia = media.map((m) => ({ name: m.name, bytes: new Uint8Array(m.data) }));

  window.Module = {
    canvas,
    arguments: ['-config', '/home/web_user/atari800.cfg', ...(selected ? commandForMedia(selected) : [])],
    preRun: [() => {
      try {
        Module.FS.mkdir('/media');
      } catch (e) {}
      for (const rec of fsMedia) {
        Module.FS.writeFile(`/media/${rec.name}`, rec.bytes);
      }
    }],
    print: (msg) => {
      if (msg) {
        statusEl.textContent = msg;
        window.__atariLog.push(String(msg));
      }
      console.log(msg);
    },
    printErr: (msg) => {
      const line = `Error: ${msg}`;
      statusEl.textContent = line;
      window.__atariLog.push(line);
      console.error(msg);
    },
    onRuntimeInitialized: () => {
      statusEl.textContent = 'Emulator running';
      canvas.focus();
      window.__atariReady = true;
    }
  };

  const s = document.createElement('script');
  s.src = 'atari800.js';
  document.body.appendChild(s);
}

startBtn.onclick = () => startEmulator();
audioBtn.onclick = async () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    window.__audioUnlocked = ctx.state === 'running';
    statusEl.textContent = 'Audio unlocked';
  } catch (e) {
    statusEl.textContent = `Audio unlock failed: ${e.message}`;
  }
};
fullscreenBtn.onclick = () => document.getElementById('displayWrap').requestFullscreen();
warmResetBtn.onclick = () => emulateAtariKey('4');
coldResetBtn.onclick = () => emulateAtariKey('4');

fileInput.onchange = async (e) => {
  const files = [...e.target.files];
  for (const f of files) await addMedia(f);
  await refreshLibrary();
  statusEl.textContent = `Imported ${files.length} file(s)`;
};

['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); }));
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  for (const f of files) await addMedia(f);
  await refreshLibrary();
  statusEl.textContent = `Dropped ${files.length} file(s)`;
});

(async () => {
  db = await openDb();
  await refreshLibrary();
})();
