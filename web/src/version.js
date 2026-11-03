// ---- target game version: blocks newer than the chosen version are swapped for the closest older ones ----
// Generation always uses the newest block names; the swap happens only when the model is shown or exported,
// so a project keeps its original blocks and switching back to the newest version loses nothing.
// dv = the DataVersion written into .schem: the lowest release of the range, so every game in it can read the file
// (newer games upgrade older files themselves).
const GAME_VERSIONS = [
  { id: '1.21.5', label: '1.21.5 及以上', dv: 4325, rank: 4 },
  { id: '1.21.4', label: '1.21.4', dv: 4189, rank: 3 },
  { id: '1.21', label: '1.21 – 1.21.3', dv: 3953, rank: 2 },
  { id: '1.20.3', label: '1.20.3 – 1.20.6', dv: 3698, rank: 1 },
];
const GAME_VERSION_DEFAULT = '1.21.5';
const verRank = id => (GAME_VERSIONS.find(v => v.id === id) || GAME_VERSIONS[0]).rank;
const verDV = id => (GAME_VERSIONS.find(v => v.id === id) || GAME_VERSIONS[0]).dv;

// [rank the block appeared in, name regex, replacement]; replacement = name string ('' = remove, '$1' groups allowed)
// or a function (match, props) -> [name, props] | ''. Props are kept when the replacement takes the same ones.
const _OX = '((?:waxed_)?(?:exposed_|weathered_|oxidized_)?)';
const VER_SWAPS = [
  // 1.21.5 Spring to Life
  [4, /^bush$/, 'short_grass'],
  [4, /^firefly_bush$/, 'short_grass'],
  [4, /^(short|tall)_dry_grass$/, 'dead_bush'],
  [4, /^leaf_litter$/, ''],
  [4, /^cactus_flower$/, ''],
  [4, /^wildflowers$/, () => ['dandelion', {}]],
  [4, /^test_(block|instance_block)$/, ''],
  // 1.21.4 The Garden Awakens
  [3, /^(stripped_)?pale_oak_(.+)$/, (m, p) => [(m[1] || '') + 'dark_oak_' + m[2], p]],
  [3, /^pale_moss_block$/, 'moss_block'],
  [3, /^pale_moss_carpet$/, () => ['moss_carpet', {}]],
  [3, /^pale_hanging_moss$/, ''],
  [3, /^creaking_heart$/, () => ['dark_oak_log', { axis: 'y' }]],
  [3, /^resin_brick_(stairs|slab|wall)$/, (m, p) => ['brick_' + m[1], p]],
  [3, /^resin_bricks$/, 'bricks'],
  [3, /^chiseled_resin_bricks$/, 'bricks'],
  [3, /^resin_block$/, 'orange_terracotta'],
  [3, /^resin_clump$/, ''],
  [3, /^open_eyeblossom$/, 'oxeye_daisy'],
  [3, /^closed_eyeblossom$/, 'allium'],
  [3, /^potted_(open|closed)_eyeblossom$/, 'potted_oxeye_daisy'],
  // 1.21 Tricky Trials
  [2, /^tuff_(stairs|slab|wall)$/, (m, p) => ['andesite_' + m[1], p]],
  [2, /^polished_tuff_(stairs|slab)$/, (m, p) => ['polished_andesite_' + m[1], p]],
  [2, /^polished_tuff_wall$/, (m, p) => ['andesite_wall', p]],
  [2, /^polished_tuff$/, 'polished_andesite'],
  [2, /^tuff_brick_(stairs|slab|wall)$/, (m, p) => ['stone_brick_' + m[1], p]],
  [2, /^tuff_bricks$/, 'stone_bricks'],
  [2, /^chiseled_tuff(_bricks)?$/, 'chiseled_stone_bricks'],
  [2, new RegExp('^' + _OX + 'chiseled_copper$'), (m) => [m[1] + 'cut_copper', {}]],
  [2, new RegExp('^' + _OX + 'copper_grate$'), (m) => [m[1] + 'cut_copper', {}]],
  [2, new RegExp('^' + _OX + 'copper_bulb$'), () => ['glowstone', {}]],
  [2, new RegExp('^' + _OX + 'copper_door$'), (m, p) => ['iron_door', p]],
  [2, new RegExp('^' + _OX + 'copper_trapdoor$'), (m, p) => ['iron_trapdoor', p]],
  [2, /^(crafter|vault|trial_spawner|heavy_core)$/, ''],
];

function _parseSt(st) {
  const s = st.startsWith('minecraft:') ? st.slice(10) : st, i = s.indexOf('[');
  const name = i < 0 ? s : s.slice(0, i), props = {};
  if (i >= 0) for (const kv of s.slice(i + 1, -1).split(',')) { const j = kv.indexOf('='); if (j > 0) props[kv.slice(0, j)] = kv.slice(j + 1); }
  return [name, props];
}
const _fmtSt = (name, props) => { const ks = Object.keys(props); return 'minecraft:' + name + (ks.length ? '[' + ks.map(k => k + '=' + props[k]).join(',') + ']' : ''); };

const _verCache = new Map();
// state string -> state string for the target version ('minecraft:air' when the block is dropped)
function verState(st, ver) {
  const rank = verRank(ver || GAME_VERSION_DEFAULT);
  if (rank >= 4 || !st) return st;
  const ck = rank + '|' + st; if (_verCache.has(ck)) return _verCache.get(ck);
  let [name, props] = _parseSt(st), out = st;
  for (let guard = 0; guard < 4; guard++) {           // a swap may land on a block that is itself too new
    let hit = false;
    for (const [r, re, to] of VER_SWAPS) {
      if (r <= rank) continue;
      const m = name.match(re); if (!m) continue;
      hit = true;
      if (to === '') { name = 'air'; props = {}; break; }
      if (typeof to === 'function') [name, props] = to(m, props);
      else name = name.replace(re, to);
      break;
    }
    if (!hit || name === 'air') break;
  }
  if (name === 'air') out = 'minecraft:air';
  else out = _fmtSt(name, props);
  if (out === _fmtSt(..._parseSt(st))) out = st;     // unchanged: keep the exact original string
  if (_verCache.size > 20000) _verCache.clear();
  _verCache.set(ck, out);
  return out;
}

// which block types of a palette change for this version: [[from, to, count]] (to '' = removed)
function verReport(palette, data, ver) {
  if (verRank(ver) >= 4) return [];
  const per = new Map();
  if (data) { const cnt = new Uint32Array(palette.length); for (const id of data) cnt[id]++; palette.forEach((s, i) => { if (cnt[i]) per.set(s, (per.get(s) || 0) + cnt[i]); }); }
  else for (const s of palette) per.set(s, (per.get(s) || 0) + 1);
  const agg = new Map();
  for (const [s, n] of per) {
    const to = verState(s, ver); if (to === s) continue;
    const a = _parseSt(s)[0], b = to === 'minecraft:air' ? '' : _parseSt(to)[0];
    const k = a + '>' + b; agg.set(k, (agg.get(k) || 0) + n);
  }
  return [...agg].map(([k, n]) => { const [a, b] = k.split('>'); return [a, b, n]; }).sort((x, y) => y[2] - x[2]);
}
