// Playground front end: an editor, a worker that owns the wasm engine, and the plumbing in between.
'use strict';

const $ = (id) => document.getElementById(id);
const codeEl = $('code');
const stdinEl = $('stdin');
const outEl = $('out');
const statusEl = $('status');
const timingEl = $('timing');
const versionEl = $('version');
const examplesEl = $('examples');
const langEl = $('lang');
const runBtn = $('run');
const stopBtn = $('stop');
const shareBtn = $('share');

const DEFAULT_SOURCE = [
'fn main(IOStream io) void {',
'    io.println("hello from the browser");',
'}'].join(String.fromCharCode(10));

let worker = null;
let seq = 0;
let pending = new Map();
let checkTimer = null;
let running = false;
let lang = localStorage.getItem('quark.lang') || 'en';
langEl.value = lang;

// ---------- worker plumbing ----------

function spawn() {
  if (worker) return worker;
  worker = new Worker('worker.js');
  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    const resolve = pending.get(msg.id);
    if (resolve) { pending.delete(msg.id); resolve(msg); }
  };
  worker.onerror = (ev) => {
    for (const resolve of pending.values()) resolve({ error: ev.message || 'worker error' });
    pending.clear();
    setRunning(false);
  };
  return worker;
}

function request(type, payload) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    spawn().postMessage(Object.assign({ id: id, type: type, lang: lang }, payload || {}));
  });
}

function stopWorker(reason) {
  if (!worker) return;
  worker.terminate();
  worker = null;
  for (const resolve of pending.values()) resolve({ error: reason || 'stopped' });
  pending.clear();
  setRunning(false);
}

// ---------- UI helpers ----------

function setRunning(on) {
  running = on;
  runBtn.disabled = on;
  stopBtn.disabled = !on;
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

function showOutput(text, isError) {
  outEl.textContent = text;
  outEl.className = 'out' + (isError ? ' error' : '');
}

function firstLine(s) { return String(s).split(String.fromCharCode(10))[0]; }

// ---------- actions ----------

async function check() {
  const src = codeEl.value;
  if (!src.trim()) { setStatus('', ''); return; }
  const res = await request('check', { src: src });
  if (res.error) { setStatus('engine error', 'bad'); return; }
  if (res.check && res.check.ok) { setStatus('ready', 'ok'); return; }
  const message = (res.check && res.check.error) || 'error';
  setStatus(firstLine(message), 'bad');
  statusEl.title = message;
}

async function run() {
  if (running) return;
  setRunning(true);
  showOutput('', false);
  timingEl.textContent = '';
  const res = await request('run', { src: codeEl.value, stdin: stdinEl.value });
  setRunning(false);
  if (!res || res.error) {
    showOutput(String((res && res.error) || 'no response'), true);
    stopWorker();
    return;
  }
  const r = res.run;
  if (r.ok) {
    showOutput(r.output, false);
    setStatus('ready', 'ok');
  } else {
    showOutput(r.error + (r.output ? String.fromCharCode(10) + r.output : ''), true);
    setStatus('runtime error', 'bad');
  }
  timingEl.textContent = r.ms.toFixed(1) + ' ms';
}

// ---------- examples / sharing ----------

async function loadExamples() {
  try {
    const list = await (await fetch('examples/manifest.json')).json();
    for (const item of list) {
      const opt = document.createElement('option');
      opt.value = item.file;
      opt.textContent = item.title;
      examplesEl.appendChild(opt);
    }
  } catch (err) {
    examplesEl.disabled = true;
  }
}

async function loadExample(file) {
  try {
    const text = await (await fetch('examples/' + file)).text();
    codeEl.value = text;
    localStorage.setItem('quark.source', text);
    check();
  } catch (err) {
    showOutput('could not load ' + file + ': ' + err, true);
  }
}

function encodeSource(src) {
  const bytes = new TextEncoder().encode(src);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSource(token) {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function share() {
  const token = encodeSource(codeEl.value);
  const url = location.origin + location.pathname + '#' + token;
  history.replaceState(null, '', '#' + token);
  try {
    await navigator.clipboard.writeText(url);
    shareBtn.textContent = 'Copied';
  } catch (err) {
    window.prompt('Link to this program:', url);
  }
  setTimeout(() => { shareBtn.textContent = 'Share'; }, 1500);
}

// ---------- wiring ----------

codeEl.addEventListener('input', () => {
  localStorage.setItem('quark.source', codeEl.value);
  clearTimeout(checkTimer);
  checkTimer = setTimeout(check, 450);
});
codeEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Tab') {
    ev.preventDefault();
    const start = codeEl.selectionStart;
    codeEl.setRangeText('    ', start, codeEl.selectionEnd, 'end');
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); run(); }
});
runBtn.addEventListener('click', run);
stopBtn.addEventListener('click', () => stopWorker('stopped by the user'));
shareBtn.addEventListener('click', share);
langEl.addEventListener('change', () => { lang = langEl.value; localStorage.setItem('quark.lang', lang); check(); });
examplesEl.addEventListener('change', () => { if (examplesEl.value) loadExample(examplesEl.value); });

(async function start() {
  await loadExamples();
  const token = location.hash.replace(/^#/, '');
  const saved = localStorage.getItem('quark.source');
  if (token) {
    try { codeEl.value = decodeSource(token); } catch (err) { codeEl.value = saved || DEFAULT_SOURCE; }
  } else {
    codeEl.value = saved || DEFAULT_SOURCE;
  }
  const info = await request('version', {});
  if (info && info.version) versionEl.textContent = 'engine ' + info.version;
  check();
})();
