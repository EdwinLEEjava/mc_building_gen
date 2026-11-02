// ---------------------------------------------------------------------------------------------
// Material slots (配色与方块) shared by components. A component declares named slots; the user may
// leave a slot on the preset, give a colour (#rrggbb or a colour word: the nearest vanilla block of
// the right kind is used), or name blocks directly. spec.mats = { slot: value } where value is
//   ''                       → preset
//   '#8a7f70' / '米白'        → colour
//   'stone_bricks'           → one block      'a,b,c' → a mix (weights 6 / 2 / 1)   (block / mix slots)
// Slot kinds:
//   block  one full block                     mix    up to three full blocks mixed (walls)
//   stone  a stone set: block + stairs + slab + wall + chiselled accent
//   roof   roof set: full + stairs + slab     wood   door + wood stairs + planks
//   glass  one or more glass panes (stained colours mixed per window cell)
// ---------------------------------------------------------------------------------------------
const MAT_KINDS = { block: '方块', mix: '方块（可混合）', stone: '石材套件', roof: '屋顶套件', wood: '木材套件', glass: '玻璃' };
const GLASS_DYES = {
  white: '#f0f0f0', light_gray: '#9d9d97', gray: '#474f52', black: '#1d1d21', brown: '#835432', red: '#b02e26', orange: '#f9801d', yellow: '#fed83d',
  lime: '#80c71f', green: '#5e7c16', cyan: '#169c9c', light_blue: '#3ab3da', blue: '#3c44aa', purple: '#8932b8', magenta: '#c74ebd', pink: '#f38baa',
};
const GLASS_CN = { clear: '透明', white: '白', light_gray: '淡灰', gray: '灰', black: '黑', brown: '棕', red: '红', orange: '橙', yellow: '黄', lime: '黄绿', green: '绿', cyan: '青', light_blue: '淡蓝', blue: '蓝', purple: '紫', magenta: '品红', pink: '粉红' };
const _MAT_WALLS = ['cobblestone', 'mossy_cobblestone', 'stone_brick', 'mossy_stone_brick', 'granite', 'diorite', 'andesite', 'cobbled_deepslate', 'polished_deepslate', 'deepslate_brick', 'deepslate_tile',
  'brick', 'mud_brick', 'nether_brick', 'red_nether_brick', 'end_stone_brick', 'prismarine', 'sandstone', 'red_sandstone', 'blackstone', 'polished_blackstone', 'polished_blackstone_brick', 'tuff', 'polished_tuff', 'tuff_brick', 'resin_brick'];
const _MAT_CHISELED = { stone_bricks: 'chiseled_stone_bricks', mossy_stone_bricks: 'chiseled_stone_bricks', stone: 'chiseled_stone_bricks', sandstone: 'chiseled_sandstone', smooth_sandstone: 'chiseled_sandstone', cut_sandstone: 'chiseled_sandstone',
  red_sandstone: 'chiseled_red_sandstone', cut_red_sandstone: 'chiseled_red_sandstone', deepslate_bricks: 'chiseled_deepslate', deepslate_tiles: 'chiseled_deepslate', polished_deepslate: 'chiseled_deepslate', cobbled_deepslate: 'chiseled_deepslate',
  quartz_block: 'chiseled_quartz_block', smooth_quartz: 'chiseled_quartz_block', quartz_bricks: 'chiseled_quartz_block', tuff: 'chiseled_tuff', polished_tuff: 'chiseled_tuff', tuff_bricks: 'chiseled_tuff_bricks',
  polished_blackstone: 'chiseled_polished_blackstone', polished_blackstone_bricks: 'chiseled_polished_blackstone', blackstone: 'chiseled_polished_blackstone', nether_bricks: 'chiseled_nether_bricks', red_nether_bricks: 'chiseled_nether_bricks',
  resin_bricks: 'chiseled_resin_bricks', cut_copper: 'chiseled_copper', exposed_cut_copper: 'exposed_chiseled_copper', weathered_cut_copper: 'weathered_chiseled_copper', oxidized_cut_copper: 'oxidized_chiseled_copper' };
const _bare = k => String(k).replace(/^minecraft:/, '').trim();
// the shape name stem MC uses: stone_bricks -> stone_brick, deepslate_tiles -> deepslate_tile, quartz_block -> quartz, oak_planks -> oak
const _stem = k => k.replace(/_bricks$/, '_brick').replace(/^bricks$/, 'brick').replace(/_tiles$/, '_tile').replace(/_planks$/, '').replace(/_block$/, '');
const matWallOf = k => { const s = _stem(_bare(k)); return _MAT_WALLS.includes(s) ? s + '_wall' : null; };
const matAccentOf = k => _MAT_CHISELED[_bare(k)] || _bare(k);
function matRoofOpt(k) { k = _bare(k); return OPTIONS && OPTIONS.roof.find(o => o.key === k || o.roles.roof_full === k); }
// every full block a slot may offer, with a Chinese name where we have one
function matBlocks(kind) {
  if (!OPTIONS) return [];
  const pick = kind === 'roof' || kind === 'stone' ? ['roof'] : kind === 'wood' ? ['frame'] : ['wall', 'base', 'roof'];
  const seen = new Set(), out = [];
  for (const g of pick) for (const o of OPTIONS[g]) if (!seen.has(o.key)) { seen.add(o.key); out.push({ id: o.key, cn: (CN && CN[o.key]) || o.key, hex: o.hex }); }
  return out;
}
function matGlassList() { return [{ id: 'clear', cn: '透明玻璃', hex: '#dfeef0' }, ...Object.entries(GLASS_DYES).map(([k, h]) => ({ id: k, cn: GLASS_CN[k] + '色玻璃', hex: h }))]; }
const _isColour = v => /^#[0-9a-f]{6}$/i.test(v) || (WORDS && !/^[a-z_:,\s]+$/i.test(v));
// resolve one slot value; returns null for 'preset' (the component keeps its own choice)
function resolveMat(kind, value, rep, label) {
  const v = value === undefined || value === null ? '' : String(value).trim();
  if (!v) return null;
  const kindOpt = { block: 'wall', mix: 'wall', stone: 'roof', roof: 'roof', wood: 'frame' }[kind];
  if (kind === 'glass') {
    let ids;
    if (_isColour(v) && !/^(clear|[a-z_]+)(,|$)/.test(v)) { const t = oklab(parseColor(v)); ids = [minBy(Object.keys(GLASS_DYES), k => de(oklab(GLASS_DYES[k]), t))]; }
    else ids = v.split(',').map(_bare).filter(k => k === 'clear' || k in GLASS_DYES);
    if (!ids.length) return null;
    rep && rep.push(`配色·${label}：${ids.map(k => GLASS_CN[k]).join('、')}玻璃`);
    return { colors: ids.map(k => k === 'clear' ? null : k) };
  }
  let ids, d = null;
  if (_isColour(v)) {
    if (!OPTIONS) return null;
    const [ch, dd] = pickColor(kindOpt, parseColor(v)); d = dd;
    ids = (kind === 'mix' ? ch : ch.slice(0, 1)).map(o => o.key);
  } else ids = v.split(',').map(_bare).filter(Boolean).slice(0, kind === 'mix' ? 3 : 1);
  if (!ids.length) return null;
  const main = ids[0], cn = k => (CN && CN[k]) || k;
  const out = { block: main, mix: ids.map((k, i) => [k, [6, 2, 1][i]]) };
  if (kind === 'stone' || kind === 'roof') {
    const o = matRoofOpt(main);
    out.stairs = o ? o.roles.roof_stairs : _stem(main) + '_stairs';
    out.slab = o ? o.roles.roof_slab : _stem(main) + '_slab';
    out.wall = matWallOf(main); out.accent = matAccentOf(main);
  }
  if (kind === 'wood') {
    const o = OPTIONS && OPTIONS.frame.find(o => o.key === main);
    if (o) Object.assign(out, { door: o.roles.door, stairs: o.roles.wood_stairs, planks: o.roles.floor });
  }
  rep && rep.push(`配色·${label}：${ids.map(cn).join('、')}` + (d !== null ? `（按颜色 ${v} 选的，色差 ΔE ${fmt(d)}${d > 8 ? '，原版没有更接近的方块' : ''}）` : '') +
    ((kind === 'stone') && !out.wall ? '；这种方块没有对应的墙，墙柱沿用预设' : ''));
  return out;
}
// all slots of a component at once: { slot: resolved | null }
function resolveMats(slots, mats, rep) {
  const out = {};
  for (const [k, s] of Object.entries(slots)) {
    try { out[k] = resolveMat(s.kind, mats && mats[k], rep, s.label); }
    catch (e) { out[k] = null; rep && rep.push(`配色·${s.label}：${e.message}，沿用预设`); }
  }
  return out;
}
