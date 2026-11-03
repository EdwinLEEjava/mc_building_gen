const M = require('../mcgen.js'); M.initData(require('../mcgen_data.json'));
const specs = require('./specs.json'), py = require('./py.json');
// Invalid floor inputs must fail instead of producing a roof-only "zero-storey" house.
const assert = require('node:assert/strict');
for (const floors of [0, -1, 1.5, null, false, '2']) {
  assert.throws(() => M.generate({ floors }), /层数必须为大于 0 的整数/);
}

let ok = 0, bad = 0; const t0 = Date.now(); const fails = [];
specs.forEach((sp, i) => {
  let r;
  try { r = M.generate(JSON.parse(JSON.stringify(sp))); } catch (e) { fails.push([i, 'JS error ' + e.stack.split('\n').slice(0, 3).join(' | ')]); bad++; return; }
  if (sp.floors !== undefined && r.spec.floors !== sp.floors) { fails.push([i, 'requested floor count changed']); bad++; return; }
  const P = py[i];
  if (!P.ok) { fails.push([i, 'py error ' + P.error]); bad++; return; }
  const jb = r.structure.blocks, pk = Object.keys(P.blocks);
  let diff = [];
  for (const k of pk) if (jb.get(k) !== P.blocks[k]) diff.push(k + ' py=' + P.blocks[k] + ' js=' + jb.get(k));
  for (const k of jb.keys()) if (!(k in P.blocks)) diff.push(k + ' py=undefined js=' + jb.get(k));
  const rep = JSON.stringify(r.report) === JSON.stringify(P.report);
  if (diff.length || !rep) { bad++; fails.push([i, diff.length + ' block diffs; report ' + (rep ? 'ok' : 'DIFF'), diff.slice(0, 4), rep ? '' : JSON.stringify([P.report, r.report])]); }
  else ok++;
});
console.log('ok', ok, 'bad', bad, 'ms', Date.now() - t0);
for (const f of fails.slice(0, 12)) console.log(JSON.stringify(f).slice(0, 900));

if (bad) process.exitCode = 1;
