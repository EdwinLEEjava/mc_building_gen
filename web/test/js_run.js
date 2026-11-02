const M = require('../mcgen.js'); M.initData(require('../mcgen_data.json'));
const specs = require('./specs.json'), py = require('./py.json');
let ok = 0, bad = 0; const t0 = Date.now(); const fails = [];
specs.forEach((sp, i) => {
  let r;
  try { r = M.generate(JSON.parse(JSON.stringify(sp))); } catch (e) { fails.push([i, 'JS error ' + e.stack.split('\n').slice(0, 3).join(' | ')]); bad++; return; }
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
