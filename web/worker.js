// The playground worker: owns the WebAssembly module and answers check/run requests.
// Running in a worker is what makes a runaway program safe: the page terminates the worker
// instead of freezing the tab (the interpreter has no instruction budget).
'use strict';

importScripts('wasm_exec.js');

let booting = null;

function boot() {
  if (booting) return booting;
  booting = (async () => {
    const go = new Go();
    let instance;
    try {
      const result = await WebAssembly.instantiateStreaming(fetch('quark.wasm'), go.importObject);
      instance = result.instance;
    } catch (err) {
      // servers that do not send application/wasm (or file://) fall back to the buffer path
      const buf = await (await fetch('quark.wasm')).arrayBuffer();
      instance = (await WebAssembly.instantiate(buf, go.importObject)).instance;
    }
    go.run(instance);
    for (let i = 0; i < 600 && typeof self.quarkRun !== 'function'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (typeof self.quarkRun !== 'function') throw new Error('the wasm engine did not initialise');
    return true;
  })();
  return booting;
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  const id = msg.id;
  try {
    await boot();
    if (msg.lang) self.quarkSetLang(msg.lang);
    if (msg.type === 'check') {
      self.postMessage({ id: id, check: JSON.parse(self.quarkCheck(msg.src, 'main.qk')) });
      return;
    }
    if (msg.type === 'version') {
      self.postMessage({ id: id, version: self.quarkVersion(), lang: self.quarkLang() });
      return;
    }
    self.postMessage({ id: id, run: JSON.parse(self.quarkRun(msg.src, msg.stdin || '', 'main.qk')) });
  } catch (err) {
    self.postMessage({ id: id, error: String((err && err.stack) || err) });
  }
};
