// Static wiring check for the web app: every id app.js reaches for exists in index.html, every
// local asset referenced by the page exists, and the worker only asks for files we ship.
// (The engine itself is covered by test/run.js; this catches the boring breakage.)
'use strict';
const fs = require('fs');
const path = require('path');

const web = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(web, 'app.js'), 'utf8');
const worker = fs.readFileSync(path.join(web, 'worker.js'), 'utf8');

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log('ok   ' + name); return; }
  failures++;
  console.log('FAIL ' + name + (detail ? '  ' + detail : ''));
}

const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (m) => m[1]));
const refs = Array.from(app.matchAll(/\$\('([^']+)'\)/g), (m) => m[1]);
const missing = refs.filter((id) => !ids.has(id));
check('every id used by app.js exists in index.html', missing.length === 0, missing.join(', '));

const assets = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (m) => m[1]).filter((a) => !/^(https?:|#)/.test(a));
const missingAssets = assets.filter((a) => !fs.existsSync(path.join(web, a)) && !fs.existsSync(path.join(__dirname, '..', 'dist', a)));
check('every local asset referenced by index.html exists in web/', missingAssets.length === 0, missingAssets.join(', '));

const fetched = Array.from(worker.matchAll(/fetch\('([^']+)'\)/g), (m) => m[1]);
check('the worker fetches quark.wasm', fetched.includes('quark.wasm'), fetched.join(', '));
check('the worker loads wasm_exec.js', /importScripts\('wasm_exec.js'\)/.test(worker));
check('the examples manifest is valid JSON', (() => {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(web, 'examples', 'manifest.json'), 'utf8'));
    return list.length > 0 && list.every((e) => fs.existsSync(path.join(web, 'examples', e.file)));
  } catch (err) { return false; }
})());

console.log(failures === 0 ? 'web assets: all checks passed' : failures + ' check(s) failed');
process.exit(failures === 0 ? 0 : 1);
