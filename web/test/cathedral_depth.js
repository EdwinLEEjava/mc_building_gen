// 立面深度分布：从某一面正对着看，每个格子第一块实心方块离这一面最外层有多远。
// 指标（技术研究第三节第 7 层）：最大的一层占比 ≤ 50%，且至少 4 层各占 ≥ 5%。
// 用法：node web/test/cathedral_depth.js [风格...]（默认四种都量）
const M = require('../mcgen.js'); M.initData(require('../mcgen_data.json'));
const SOLID = b => b && b !== 'minecraft:air' && !/_pane|glass\b|end_rod|lightning_rod|bell|chain|lantern/.test(b);
function depthStats(S, face) {   // face: 'west' (look along +x) or 'south' (look along -z)
  const [[x0, y0, z0], [x1, y1, z1]] = S.bounds(), first = new Map();
  for (const [k, b] of S.blocks) {
    if (!SOLID(b)) continue;
    const [x, y, z] = k.split(',').map(Number);
    const key = face === 'west' ? y + ',' + z : y + ',' + x, d = face === 'west' ? x - x0 : z1 - z;
    if (!first.has(key) || d < first.get(key)) first.set(key, d);
  }
  const lim = face === 'west' ? 30 : 12;   // ignore what is seen far behind the front (the nave seen past the towers)
  const hist = new Map(); let n = 0;
  for (const d of first.values()) if (d <= lim) { hist.set(d, (hist.get(d) || 0) + 1); n++; }
  const share = [...hist].map(([d, c]) => [d, c / n]).sort((a, b) => b[1] - a[1]);
  return { max: share[0][1], layers5: share.filter(s => s[1] >= 0.05).length, top: share.slice(0, 6).map(([d, s]) => `${d}:${(s * 100).toFixed(0)}%`).join(' ') };
}
const styles = process.argv.slice(2).length ? process.argv.slice(2) : ['french', 'german', 'italian', 'spanish'];
let bad = 0;
for (const style of styles) for (const face of ['west', 'south']) {
  const r = depthStats(M.cathedral({ style }).S, face), ok = r.max <= 0.5 && r.layers5 >= 4;
  if (!ok) bad++;
  console.log(`${style.padEnd(10)} ${face.padEnd(5)} 最大层 ${(r.max * 100).toFixed(0).padStart(3)}%  ≥5% 的层 ${r.layers5}  ${ok ? '达标' : '未达标'}  [${r.top}]`);
}
console.log(bad ? `${bad} 项未达标` : '全部达标');
