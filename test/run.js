// Engine smoke test: runs snippets (and optionally every example) through the built wasm module.
//
//   node test/run.js [dist] [--interpreter /path/to/quark]
//
// With --interpreter the output of every web/examples/*.qk is compared against the real
// interpreter (an example may ship a <name>.stdin file with the lines it reads): the playground
// must behave exactly like the toolchain it embeds.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dist = args.find((a) => !a.startsWith('--')) || 'dist';
const interpIdx = args.indexOf('--interpreter');
const interpreter = interpIdx >= 0 ? args[interpIdx + 1] : '';
const NL = String.fromCharCode(10);

require(path.resolve(dist, 'wasm_exec.js'));
const go = new globalThis.Go();
const bytes = fs.readFileSync(path.join(dist, 'quark.wasm'));

let failures = 0;
function check(name, got, want) {
  if (got === want) { console.log('ok   ' + name); return; }
  failures++;
  console.log('FAIL ' + name + '  got: ' + JSON.stringify(got) + '  want: ' + JSON.stringify(want));
}

WebAssembly.instantiate(bytes, go.importObject).then((res) => {
  go.run(res.instance);
  return new Promise((done) => setTimeout(done, 100));
}).then(() => {
  const run = (src, stdin) => JSON.parse(globalThis.quarkRun(src, stdin || '', 'main.qk'));
  const FIB = 'fn fib(int n) int { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }';

  check('version is reported', typeof globalThis.quarkVersion() === 'string', true);
  check('front end accepts a valid program', JSON.parse(globalThis.quarkCheck(FIB, 'main.qk')).ok, true);
  check('front end rejects a broken program', JSON.parse(globalThis.quarkCheck('fn main(IOStream io) { int x = ; }', 'main.qk')).ok, false);

  const fib = run(FIB + NL + 'fn main(IOStream io) { io.println(fib(20)); }');
  check('fib(20) runs', fib.ok && fib.output, '6765' + NL);

  const io = run('fn main(IOStream io) { io.println(io.readln()); io.println(io.readln()); }', 'first' + NL + 'second' + NL);
  check('io.readln reads the fed stdin', io.output, 'first' + NL + 'second' + NL);

  const div = run('fn main(IOStream io) { io.println(1 / 0); }');
  check('runtime errors are reported, not thrown', div.ok === false && /DivisionByZero/.test(div.error), true);

  const hello = run('fn main(IOStream io) { io.println("hello"); }');
  check('startup latency is measured', typeof hello.ms === 'number' && hello.ms >= 0, true);

  if (interpreter) {
    const dir = 'web/examples';
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.qk')).sort()) {
      const file = path.join(dir, f);
      const src = fs.readFileSync(file, 'utf8');
      const stdinFile = file + '.stdin';
      const stdin = fs.existsSync(stdinFile) ? fs.readFileSync(stdinFile, 'utf8') : '';
      const ref = spawnSync(interpreter, [file], { input: stdin, encoding: 'utf8' });
      const got = run(src, stdin);
      check('example ' + f + ' matches the interpreter', got.output, ref.stdout || '');
      check('example ' + f + ' exits like the interpreter (' + ref.status + ')', got.ok, ref.status === 0);
    }
  }

  console.log(failures === 0 ? 'wasm engine: all checks passed' : failures + ' check(s) failed');
  process.exit(failures === 0 ? 0 : 1);
});
