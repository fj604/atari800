(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const DB_NAME = 'atari800-web';
  const STORE = 'media';
  const mapKeys = { Digit1: 'F2', Digit2: 'F3', Digit3: 'F4' };

  const setStatus = (m) => { statusEl.textContent = m; window.__a8Status = m; };
  window.__a8LastKey = '';
  window.__a8StartupReady = false;
  window.__a8AudioUnlocked = false;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveMedia(file) {
    const db = await openDb();
    const rec = { id: crypto.randomUUID(), name: file.name, type: detectType(file.name), updatedAt: Date.now(), blob: file };
    await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return rec;
  }

  async function listMedia() {
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result.sort((a,b)=>b.updatedAt-a.updatedAt));
      req.onerror = () => rej(req.error);
    });
  }

  async function deleteMedia(id) {
    const db = await openDb();
    await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });
  }

  function detectType(name) {
    const ext = name.toLowerCase().split('.').pop();
    if (['atr','xfd','atx','pro','dcm'].includes(ext)) return 'disk';
    if (['car','rom','bin'].includes(ext)) return 'cart';
    if (['cas'].includes(ext)) return 'tape';
    if (['a8s','state'].includes(ext)) return 'state';
    return 'run';
  }

  async function refreshMediaList() {
    const list = $('media-list'); list.innerHTML = '';
    for (const rec of await listMedia()) {
      const li = document.createElement('li'); li.textContent = `${rec.name} (${rec.type})`;
      const load = document.createElement('button'); load.textContent = 'Load';
      load.onclick = () => { const p = new URLSearchParams(location.search); p.set('autoload', rec.id); location.search = p.toString(); };
      const del = document.createElement('button'); del.textContent = 'Delete'; del.onclick = async () => { await deleteMedia(rec.id); refreshMediaList(); };
      li.append(load, del); list.append(li);
    }
  }

  window.__a8FetchAutoload = async function() {
    const id = new URLSearchParams(location.search).get('autoload');
    if (!id) return null;
    const db = await openDb();
    return new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (mapKeys[e.code] && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const ev = new KeyboardEvent(e.type, { key: mapKeys[e.code], code: mapKeys[e.code], bubbles: true });
      $('canvas').dispatchEvent(ev);
    }
    window.__a8LastKey = e.code;
    setStatus(`Last key: ${e.code}`);
  }, { capture: true });

  async function unlockAudio() {
    try {
      if (window.Module?.SDL2?.audioContext) await window.Module.SDL2.audioContext.resume();
      window.__a8AudioUnlocked = true;
      if (!window.__a8LastKey) setStatus('Audio initialized');
    } catch {
      setStatus('Audio unlock failed');
    }
  }

  function bindTouchControls() {
    const touchCapable = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const wrap = $('touch-controls');
    wrap.hidden = !(touchCapable && $('touch-enabled').checked);
    $('touch-enabled').onchange = () => wrap.hidden = !($('touch-enabled').checked && touchCapable);
    const active = new Map();
    wrap.querySelectorAll('button').forEach((btn) => {
      const key = btn.dataset.key;
      btn.onpointerdown = (e) => { active.set(e.pointerId, key); btn.setPointerCapture(e.pointerId); simulateKey(key, true); };
      btn.onpointerup = btn.onpointercancel = (e) => { const k = active.get(e.pointerId); if (k) simulateKey(k, false); active.delete(e.pointerId); };
    });
  }

  function simulateKey(key, down) {
    const code = key === 'ControlLeft' ? 'ControlLeft' : key;
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code, bubbles: true }));
  }

  $('fullscreen-btn').onclick = async () => {
    const c = $('emulator-container');
    if (!document.fullscreenElement) await c.requestFullscreen(); else await document.exitFullscreen();
  };
  $('audio-unlock').onclick = unlockAudio;
  ['click','keydown','touchstart'].forEach(evt => window.addEventListener(evt, () => unlockAudio(), { once: true }));

  $('media-import').addEventListener('change', async (e) => {
    for (const f of e.target.files) await saveMedia(f);
    setStatus(`Imported ${e.target.files.length} file(s)`); refreshMediaList();
  });
  $('refresh-library').onclick = refreshMediaList;

  window.addEventListener('load', () => {
    setStatus('Page loaded');
    refreshMediaList();
    bindTouchControls();
  });
})();
