// ---------------------------------------------------------------------------------------------
// Structure, palettes, colors (port of structure.py / palettes.py / colors.py)
// ---------------------------------------------------------------------------------------------
const key3 = (x, y, z) => x + ',' + y + ',' + z;
const unkey = k => k.split(',').map(Number);

// B('spruce_stairs', {facing: 'north'}) -> "minecraft:spruce_stairs[facing=north]"
function B(name, props) {
  if (!name.includes(':')) name = 'minecraft:' + name;
  if (!props) return name;
  const ks = Object.keys(props).sort();
  if (!ks.length) return name;
  return name + '[' + ks.map(k => k + '=' + String(props[k]).toLowerCase()).join(',') + ']';
}

class Structure {
  constructor() { this.blocks = new Map(); }
  set(x, y, z, st) { const k = key3(x, y, z); if (st == null || st === 'minecraft:air') this.blocks.delete(k); else this.blocks.set(k, st); }
  setIfEmpty(x, y, z, st) { if (!this.blocks.has(key3(x, y, z))) this.set(x, y, z, st); }
  get(x, y, z) { return this.blocks.get(key3(x, y, z)); }
  has(x, y, z) { return this.blocks.has(key3(x, y, z)); }
  del(x, y, z) { this.blocks.delete(key3(x, y, z)); }
  bounds() {
    if (this.box) return this.box;
    let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
    for (const k of this.blocks.keys()) { const p = unkey(k); for (let i = 0; i < 3; i++) { if (p[i] < a[i]) a[i] = p[i]; if (p[i] > b[i]) b[i] = p[i]; } }
    return [a, b];
  }
  // -> {W, H, L, palette: [state...], data: Uint32Array (index x + z*W + y*W*L)} ; palette order as in save_schem
  toModel() {
    const [[x0, y0, z0], [x1, y1, z1]] = this.bounds();
    const W = x1 - x0 + 1, H = y1 - y0 + 1, L = z1 - z0 + 1;
    const pal = new Map([['minecraft:air', 0]]), data = new Uint32Array(W * H * L);
    let i = 0;
    for (let y = 0; y < H; y++) for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
      const st = this.blocks.get(key3(x + x0, y + y0, z + z0)) || 'minecraft:air';
      let id = pal.get(st); if (id === undefined) { id = pal.size; pal.set(st, id); }
      data[i++] = id;
    }
    return { W, H, L, palette: [...pal.keys()], data, origin: [x0, y0, z0] };
  }
}

// weighted entries are [[name, weight], ...]
const isStr = v => typeof v === 'string';
function pickU(u, entry) {
  let total = 0; for (const [, w] of entry) total += w;
  let r = u * total;
  for (const [name, w] of entry) { r -= w; if (r < 0) return name; }
  return entry[entry.length - 1][0];
}

// ---- colors ----
let DATA = null, OPTIONS = null, WORDS = null, PALETTES = null, DEFAULT_SPEC = null, CN = null;
function initData(d) {
  DATA = d; OPTIONS = d.options; WORDS = d.words; PALETTES = d.palettes; DEFAULT_SPEC = d.default_spec; CN = d.cn;
}
function _lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function oklab(hexs) {
  const h = hexs.replace(/^#+/, '');
  const [r, g, b] = [0, 2, 4].map(i => _lin(parseInt(h.slice(i, i + 2), 16)));
  const l = Math.pow(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 1 / 3);
  const m = Math.pow(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, 1 / 3);
  const s = Math.pow(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b, 1 / 3);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const de = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
function parseColor(v) {
  v = String(v).trim();
  if (v.startsWith('#') && v.length === 7) return v.toLowerCase();
  if (v in WORDS) return WORDS[v];
  for (const k of Object.keys(WORDS).sort((a, b) => b.length - a.length)) if (v.includes(k)) return WORDS[k];
  throw new Error(`无法识别的颜色：${v}（用 #rrggbb 或这些词：${Object.keys(WORDS).join('、')}）`);
}
const _PRE = ['polished_', 'cracked_', 'mossy_', 'smooth_', 'cut_', 'chiseled_', 'cobbled_', 'exposed_', 'weathered_', 'oxidized_'];
const _SUF = ['_bricks', '_brick', '_tiles', '_block', '_planks'];
function core(bid) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of _PRE) if (bid.startsWith(t)) { bid = bid.slice(t.length); changed = true; }
    for (const t of _SUF) if (bid.endsWith(t)) { bid = bid.slice(0, -t.length); changed = true; }
  }
  return { cobblestone: 'stone', bricks: 'brick', brick: 'brick' }[bid] || bid;
}
const _DYES = ['light_blue', 'light_gray', 'white', 'orange', 'magenta', 'yellow', 'lime', 'pink', 'gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const _DYED = ['_concrete_powder', '_concrete', '_wool', '_terracotta'];
function family(o) {
  const k = o.key;
  for (const d of _DYES) if (k.startsWith(d + '_') && _DYED.includes(k.slice(d.length))) return 'dye:' + d;
  return o.cls + ':' + core(k);
}
function minBy(arr, f) { let best, bv; for (const o of arr) { const v = f(o); if (best === undefined || v < bv) { best = o; bv = v; } } return best; }
function sortBy(arr, f) { return arr.map((o, i) => [f(o), i, o]).sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]).map(x => x[2]); }
function cmp(a, b) {
  if (Array.isArray(a)) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmp(a[i], b[i]); if (c) return c; } return a.length - b.length; }
  if (typeof a === 'boolean') { a = +a; b = +b; }
  return a < b ? -1 : a > b ? 1 : 0;
}
function pickColor(slot, hexs, companions = 2, radius = 6.0) {
  const target = oklab(hexs);
  const opts = sortBy(OPTIONS[slot], o => de(o.lab, target));
  const main = opts[0];
  const comp = opts.slice(1).filter(o => o.cls === main.cls && core(o.key) === core(main.key) && de(o.lab, main.lab) < radius
    && o.key !== main.key && slot !== 'frame').slice(0, companions);
  return [[main, ...comp], de(main.lab, target)];
}
const STYLES = { cluster: '成片随机', speckle: '细碎随机', bottom_dark: '上浅下深', top_dark: '上深下浅', horizontal: '左右渐变', weathered: '风化', eave_dark: '檐口深', ridge_dark: '屋脊深' };
const CURVES = ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'step'];
const MIX_DEFAULT = { range: 14, count: 4, style: 'cluster', jitter: 0.35, scale: 2, cross: false, curve: 'linear', skip: 0.0 };
const _L = o => o.lab[0] * 100;
const degrees = r => r * 180 / Math.PI;
function chromaDist(a, b, hue = 40) {
  const ca = Math.hypot(a[1], a[2]) * 100, cb = Math.hypot(b[1], b[2]) * 100;
  if (cb > 4) {
    if (ca < 2.5) return 99;
    const dh = pmod(Math.abs(degrees(Math.atan2(a[2], a[1]) - Math.atan2(b[2], b[1]))), 360);
    if (Math.min(dh, 360 - dh) > hue) return 99;
  }
  return Math.hypot(a[1] - b[1], a[2] - b[2]) * 100;
}
function buildRamp(slot, hexs, rngL, count, cross) {
  const target = oklab(hexs), opts = OPTIONS[slot];
  const main = minBy(opts, o => de(o.lab, target));
  const tL = target[0] * 100, lo = tL - rngL / 2, hi = tL + rngL / 2;
  const inside = o => lo - 1 <= _L(o) && _L(o) <= hi + 1;
  let pool;
  if (cross) {
    for (const [tol, hue] of [[4, 30], [5.5, 35], [7, 40], [8.5, 45], [10, 55], [12, 65]]) {
      pool = opts.filter(o => chromaDist(o.lab, target, hue) < tol && inside(o));
      if (pool.length >= count) break;
    }
  } else pool = opts.filter(o => family(o) === family(main) && inside(o));
  if (!pool.includes(main)) pool.push(main);
  pool = sortBy(pool, _L);
  const chosen = [main];
  if (pool.length > 1 && count > 1) {
    const a = _L(pool[0]), b = _L(pool[pool.length - 1]);
    for (let i = 0; i < count; i++) {
      const want = a + (b - a) * i / (count - 1);
      const free = pool.filter(o => !chosen.includes(o) && chosen.every(c => de(o.lab, c.lab) >= 1.2));
      const cand = free.length ? minBy(free, o => Math.abs(_L(o) - want)) : undefined;
      if (cand === undefined || chosen.length >= count) break;
      chosen.push(cand);
    }
  }
  const ramp = sortBy(chosen, _L);
  const steps = []; for (let i = 0; i + 1 < ramp.length; i++) steps.push(de(ramp[i].lab, ramp[i + 1].lab));
  return [ramp, main, de(main.lab, target), steps];
}
function mixConfig(v) {
  if (isStr(v)) return null;
  const cfg = { ...MIX_DEFAULT, ...v };
  if (!(cfg.style in STYLES)) throw new Error(`未知的混色样式 ${cfg.style}，可选：${JSON.stringify(Object.keys(STYLES))}`);
  return cfg;
}
function rampWeights(ramp, main) { const m = _L(main); return ramp.map(o => Math.max(1, pyRound(8 * Math.exp(-Math.pow((_L(o) - m) / 6, 2))))); }
const truthy = v => !(v === null || v === undefined || v === false || v === 0 || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));

function applyColors(palette, colors) {
  if (!truthy(colors)) return [palette, []];
  const p = { ...palette };
  p._mix = { ...(palette._mix || {}) };
  p._ramps = { ...(palette._ramps || {}) };
  const rep = [];
  const label = { roof: '屋顶', wall: '墙面', wall_ground: '一层墙面', frame: '木构', base: '基座' };
  const kind = { roof: 'roof', wall: 'wall', wall_ground: 'wall', frame: 'frame', base: 'base' };
  const targets = { roof: ['roof_full', 'roof_stairs', 'roof_slab'], wall: ['infill_upper', 'infill_ground'], wall_ground: ['infill_ground'], base: ['base'] };
  const roles = { roof_full: 'roof_full', roof_stairs: 'roof_stairs', roof_slab: 'roof_slab', infill_upper: 'block', infill_ground: 'block', base: 'block' };
  for (const slot of ['roof', 'frame', 'wall', 'wall_ground', 'base']) {
    if (!(slot in colors) || colors[slot] === null || colors[slot] === '') continue;
    const v = colors[slot], cfg = mixConfig(v);
    const raw = isStr(v) ? v : v.color;
    let hexs = truthy(raw) ? parseColor(raw) : null;
    if (slot === 'frame') {
      const [ch, d] = pickColor('frame', hexs || '#6a4a2a');
      const r = ch[0].roles;
      Object.assign(p, { post: r.post, beam: r.beam, wood_stairs: r.wood_stairs, trapdoor: r.trapdoor, door: r.door, floor: r.floor });
      rep.push(`配色·${label[slot]} ${hexs === null ? 'None' : hexs} → ${CN[ch[0].key]}（色差 ΔE ${fmt(d)}）`);
      continue;
    }
    let ramp, weights, main, steps, d;
    if (cfg === null) {
      const [ch, dd] = pickColor(kind[slot], hexs);
      ramp = ch; weights = [6, 2, 1].slice(0, ch.length); main = ch[0]; steps = []; d = dd;
    } else {
      if (hexs === null) hexs = paletteHex(palette, targets[slot][0], kind[slot]);
      [ramp, main, d, steps] = buildRamp(kind[slot], hexs, cfg.range, Math.trunc(cfg.count), !!cfg.cross);
      weights = rampWeights(ramp, main);
    }
    for (const t of targets[slot]) {
      const n = Math.min(ramp.length, weights.length);
      p[t] = ramp.slice(0, n).map((o, i) => [o.roles[roles[t]], weights[i]]);
      if (cfg !== null) p._mix[t] = { ...cfg, group: slot }; else delete p._mix[t];
    }
    if (slot === 'base') { p.base_stairs = main.roles.base_stairs; p.chimney = p.base.slice(); }
    p._ramps[slot] = ramp.map(o => ({ id: o.key, cn: CN[o.key], hex: o.hex, L: pyRound(_L(o), 1) }));
    const names = ramp.map(o => CN[o.key]).join(' → ');
    const warn = d > 8 ? '；原版没有更接近这个颜色的方块' : '';
    if (cfg === null) rep.push(`配色·${label[slot]} ${hexs} → ${names}（主色差 ΔE ${fmt(d)}${warn}）`);
    else {
      const st = steps.map(x => fmt(x)).join('、') || '—';
      const span = _L(ramp[ramp.length - 1]) - _L(ramp[0]);
      rep.push(`配色·${label[slot]} ${hexs}｜${STYLES[cfg.style]}｜色阶（暗→亮）：${names}；明暗跨度 ${fmt(span)}，相邻色差 ${st}${cfg.cross ? '；已允许跨材质' : ''}${warn}`);
      if (ramp.length < Math.trunc(cfg.count))
        rep.push(`　提示：${label[slot]}在这个明暗范围内只找到 ${ramp.length} 种` + (cfg.cross ? '色相相近的方块，可以加大明暗范围' : '同家族方块，可以加大明暗范围或打开跨材质'));
    }
  }
  return [p, rep];
}
function paletteHex(palette, slot, kind) {
  const e = palette[slot], items = isStr(e) ? [[e, 1]] : e;
  let tot = 0; for (const [, w] of items) tot += w;
  const acc = [0, 0, 0];
  for (const [name, w] of items) {
    const o = OPTIONS[kind].find(o => Object.values(o.roles).some(r => r === name));
    const h = o ? o.hex : '#808080';
    for (let i = 0; i < 3; i++) acc[i] += parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16) * w / tot;
  }
  return '#' + acc.map(c => pyRound(c).toString(16).padStart(2, '0')).join('');
}
const _ids = v => isStr(v) ? [v] : v.map(([n]) => n);
function currentRoles(hb) {
  const p = hb.p, ws = hb.woodStairs(), wood = ws.slice(0, -7);
  return {
    roof: { roof_full: _ids(p.roof_full), roof_stairs: _ids(p.roof_stairs), roof_slab: _ids(p.roof_slab) },
    wall: { block: _ids(p.infill_upper) },
    wall_ground: { block: _ids(p.infill_ground) },
    frame: { post: _ids(p.post), beam: _ids(p.beam), wood_stairs: [ws], trapdoor: _ids(p.trapdoor), door: _ids(p.door), floor: _ids(p.floor), fence: [wood + '_fence'], fence_gate: [wood + '_fence_gate'] },
    base: { block: _ids(p.base), base_stairs: [hb.baseStairs()] },
  };
}

// Sponge Schematic v2 (uncompressed NBT bytes; gzip them before saving), same layout as save_schem()
function schemNBT(S, dataVersion = 3953) {
  const m = S.toModel(), out = [], enc = new TextEncoder();
  const u8 = v => out.push(v & 255), u16 = v => { u8(v >> 8); u8(v); }, i32 = v => { u8(v >>> 24); u8(v >>> 16); u8(v >>> 8); u8(v); };
  const str = t => { const b = enc.encode(t); u16(b.length); for (const x of b) out.push(x); };
  const tag = (type, name) => { u8(type); str(name); };
  const data = [];
  for (let k of m.data) { while (k > 0x7f) { data.push((k & 0x7f) | 0x80); k >>>= 7; } data.push(k); }
  tag(10, 'Schematic');
  tag(3, 'Version'); i32(2);
  tag(3, 'DataVersion'); i32(dataVersion);
  tag(2, 'Width'); u16(m.W); tag(2, 'Height'); u16(m.H); tag(2, 'Length'); u16(m.L);
  tag(11, 'Offset'); i32(3); i32(0); i32(0); i32(0);
  tag(3, 'PaletteMax'); i32(m.palette.length);
  tag(10, 'Palette'); m.palette.forEach((st, i) => { tag(3, st); i32(i); }); u8(0);
  tag(7, 'BlockData'); i32(data.length); for (const b of data) out.push(b);
  tag(10, 'Metadata'); tag(8, 'Generator'); str('mcgen-prototype'); u8(0);
  u8(0);
  return { bytes: new Uint8Array(out), W: m.W, H: m.H, L: m.L, kinds: m.palette.length };
}
