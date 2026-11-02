// ---------------------------------------------------------------------------------------------
// Monuments (纪念物): small vertical landmarks for the middle of a square, a crossroads or a
// churchyard. All share a stepped base (0–3 rings of stairs rising to the centre); the body on top
// depends on the type. Front = north (-z). Materials reuse the fountain stone sets.
// ---------------------------------------------------------------------------------------------
const MONUMENT_TYPES = { cross: '市场十字碑', statue: '雕像', maypole: '五月柱', obelisk: '方尖碑', shrine: '路边神龛', column: '纪念柱' };
const MONUMENT_TOPS = {
  cross: { cross: '十字', lantern: '十字挂灯', canopy: '带顶棚的十字' },
  statue: { down: '双手垂下', raised: '一手高举', cloak: '披风' },
  maypole: { azalea: '杜鹃花冠', cherry: '樱花花冠', plain: '无花冠' },
  obelisk: { point: '尖顶', lantern: '顶灯' },
  shrine: { candle: '蜡烛', lantern: '灯笼', flowers: '花' },
  column: { lantern: '顶灯', finial: '石饰', bell: '钟' },
};
const RIBBONS = { festive: ['red', 'yellow', 'blue', 'white'], spring: ['pink', 'white', 'lime', 'yellow'], royal: ['purple', 'yellow', 'white', 'blue'], plain: ['white', 'white', 'white', 'white'] };
const MONUMENT_DEFAULT = { kind: 'cross', top: 'auto', steps: 2, height: 5, material: 'stone', flowers: true, ribbons: 'festive', wood: 'spruce', seed: 1 };

function monument(o = {}) {
  const p = { ...MONUMENT_DEFAULT, ...o };
  const kind = MONUMENT_TYPES[p.kind] ? p.kind : 'cross';
  const tops = MONUMENT_TOPS[kind], top = tops[p.top] ? p.top : Object.keys(tops)[0];
  const M = FOUNTAIN_MATERIALS[p.material] || FOUNTAIN_MATERIALS.stone;
  const steps = Math.max(0, Math.min(3, p.steps | 0)), H = Math.max(2, Math.min(12, p.height | 0));
  const rng = new PyRandom(deriveSeed(p.seed || 1, 'monument:' + kind));
  const S = new Structure();
  const toC = (x, z) => Math.abs(z) >= Math.abs(x) ? (z < 0 ? 'south' : 'north') : (x < 0 ? 'east' : 'west');
  const stair = (f, half = 'bottom') => B(M.stairs, { facing: f, half, shape: 'straight', waterlogged: false });
  const wall = (c = {}) => B(M.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none', ...c });
  const fence = B(`${p.wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false });
  const slab = (t = 'bottom') => B(M.slab, { type: t, waterlogged: false });
  const lantern = (h = false) => B('lantern', { hanging: h, waterlogged: false });

  // ---- stepped base: ring k at y = k, half-size (core + steps - k); core plinth 1 (3x3) ----
  const core = kind === 'shrine' || kind === 'maypole' ? 0 : 1;
  for (let k = 0; k < steps; k++) {
    const h = core + steps - k;
    for (let x = -h; x <= h; x++) for (let z = -h; z <= h; z++)
      S.set(x, k, z, Math.max(Math.abs(x), Math.abs(z)) === h ? stair(toC(x, z)) : B(M.block));
  }
  const y0 = steps;                                  // first layer of the body
  if (core) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) S.set(x, y0, z, x || z ? B(M.block) : B(M.accent));
  let yb = y0 + core;                                // body starts here

  // flower pots round the base
  let pots = 0;
  if (p.flowers) {
    const r = core + steps + 1, plants = ['potted_poppy', 'potted_dandelion', 'potted_red_tulip', 'potted_cornflower', 'potted_azure_bluet'];
    for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { S.set(x, 0, z, B(plants[Math.floor(rng.random() * plants.length)])); pots++; }
  }

  if (kind === 'cross') {
    const shaft = Math.max(3, H);
    for (let y = yb; y < yb + shaft; y++) S.set(0, y, 0, wall());
    const ay = yb + shaft - 2;                       // the arms
    S.set(0, ay, 0, wall({ east: 'low', west: 'low' }));
    for (const d of [-1, 1]) {
      S.set(d, ay, 0, wall({ up: false, [d < 0 ? 'east' : 'west']: 'low' }));
      if (top !== 'cross') S.set(d, ay - 1, 0, lantern(true));
    }
    if (top === 'canopy') {                          // a little stone hood over the head of the cross
      const cy = yb + shaft;
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) S.set(x, cy, z, x || z ? stair(toC(x, z)) : B(M.block));
      S.set(0, cy + 1, 0, slab());
    }
  } else if (kind === 'statue') {
    // abstract figure, about 5 tall: legs (wall), two body blocks, shoulders, arms, head
    const fy = yb;
    S.set(0, fy, 0, wall()); S.set(0, fy + 1, 0, wall());
    S.set(0, fy + 2, 0, B(M.block)); S.set(0, fy + 3, 0, B(M.block));
    S.set(0, fy + 4, 0, B(M.accent));                // head
    for (const d of [-1, 1]) {
      S.set(d, fy + 3, 0, stair(d < 0 ? 'east' : 'west', 'top'));             // shoulders
      const raised = top === 'raised' && d > 0;
      if (raised) { S.set(d, fy + 4, 0, wall()); S.set(d, fy + 5, 0, wall()); }
      else S.set(d, fy + 2, 0, wall());
    }
    if (top === 'cloak') for (let y = fy; y <= fy + 3; y++) S.set(0, y, 1, y === fy + 3 ? stair('south', 'top') : stair('north'));
    // a plaque in front of the plinth
    if (steps) S.set(0, y0, -2, stair('south'));
  } else if (kind === 'maypole') {
    const h = Math.max(6, H + 3);
    for (let y = yb; y < yb + h; y++) S.set(0, y, 0, B(`stripped_${p.wood}_log`, { axis: 'y' }));
    const ty = yb + h;
    if (top !== 'plain') {
      const leaf = B(top === 'cherry' ? 'cherry_leaves' : 'flowering_azalea_leaves', { distance: 1, persistent: true, waterlogged: false });
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z) S.set(x, ty - 1, z, leaf);
      S.set(0, ty, 0, leaf);
    } else S.set(0, ty, 0, B(`${p.wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false }));
    // ribbons: four fence arms with a wool streamer hanging from each tip, colours by scheme
    const cols = RIBBONS[p.ribbons] || RIBBONS.festive, ay = ty - 2;
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([x, z], i) => {
      S.set(x, ay, z, fence); S.set(x * 2, ay, z * 2, fence);
      for (let k = 1; k <= 2; k++) S.set(x * 2, ay - k, z * 2, B(`${cols[i]}_wool`));
    });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.set(x, yb, z, B('potted_red_tulip'));
  } else if (kind === 'obelisk') {
    // 3x3 shaft for the lower third, then 1x1 to the tip
    const h = Math.max(5, H + 2), low = Math.floor(h / 3);
    for (let y = yb; y < yb + low; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) S.set(x, y, z, B(M.block));
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z) S.set(x, yb + low, z, stair(toC(x, z)));
    for (let y = yb + low; y < yb + h; y++) S.set(0, y, 0, B(y === yb + low ? M.accent : M.block));
    S.set(0, yb + h, 0, top === 'lantern' ? lantern() : slab());
  } else if (kind === 'shrine') {
    // wayside shrine: post, a little box with an open niche on the front, a gabled cap
    const ph = Math.max(1, Math.min(4, H - 3));
    for (let y = yb; y < yb + ph; y++) S.set(0, y, 0, wall());
    const ny = yb + ph;                              // niche level
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) S.set(x, ny - 0, z, B(M.block));
    for (let x = -1; x <= 1; x++) for (let z = 0; z <= 1; z++) if (x || z) S.set(x, ny + 1, z, B(M.block));
    S.set(-1, ny + 1, -1, B(M.block)); S.set(1, ny + 1, -1, B(M.block));
    const inside = top === 'candle' ? B('candle', { candles: 3, lit: true, waterlogged: false }) : top === 'lantern' ? lantern() : B('potted_lily_of_the_valley');
    S.set(0, ny + 1, 0, inside); S.set(0, ny + 1, -1, null);
    for (let x = -1; x <= 1; x++) { S.set(x, ny + 2, -1, B(`${p.wood}_stairs`, { facing: 'south', half: 'bottom', shape: 'straight', waterlogged: false })); S.set(x, ny + 2, 1, B(`${p.wood}_stairs`, { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: false })); S.set(x, ny + 2, 0, B(`${p.wood}_planks`)); S.set(x, ny + 3, 0, B(`${p.wood}_slab`, { type: 'bottom', waterlogged: false })); }
  } else if (kind === 'column') {
    const h = Math.max(4, H + 1);
    S.set(0, yb, 0, B(M.accent));
    for (let y = yb + 1; y < yb + h; y++) S.set(0, y, 0, B(M.block));
    const cy = yb + h;                               // capital: a ring of upside-down stairs
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) S.set(x, cy, z, x || z ? stair(toC(x, z), 'top') : B(M.accent));
    if (top === 'lantern') S.set(0, cy + 1, 0, lantern());
    else if (top === 'finial') { S.set(0, cy + 1, 0, wall()); S.set(0, cy + 2, 0, slab()); }
    else { S.set(0, cy + 2, 0, B(M.block)); S.set(0, cy + 1, 0, B('bell', { attachment: 'ceiling', facing: 'north', powered: false })); }
  }

  fixConnections(S); stairShapes(S);
  let mx = 0, my = 0; for (const k of S.blocks.keys()) { const [x, y, z] = unkey(k); mx = Math.max(mx, Math.abs(x), Math.abs(z)); my = Math.max(my, y); }
  const report = [`纪念物：${MONUMENT_TYPES[kind]}（${tops[top]}），${steps} 级台阶，总高 ${my + 1} 格，${M.label}${pots ? '，四角花盆' : ''}`];
  return { S, foot: [-mx, mx, -mx, mx], tags: ['landmark', 'monument'], report, spec: { ...p, kind, top, steps, height: H }, radius: core + steps };
}
