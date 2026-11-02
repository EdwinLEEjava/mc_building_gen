// ---------------------------------------------------------------------------------------------
// Landmarks (地标): larger parametric builds that anchor a square or a street — plaza, church,
// town hall, bell tower, library... Same contract as the props: { S, foot, tags, report } in local
// coordinates, y = 0 the first layer above the ground, y = -1 the ground layer itself (a landmark
// may repave it), front = north (-z). Customised with a JSON spec like the houses.
// ---------------------------------------------------------------------------------------------

// ---- plaza (城镇广场 / 市场广场) -------------------------------------------------------------
const PLAZA_SHAPES = { rect: '方形', octagon: '八角形', round: '圆形', irregular: '不规则（漏斗形）' };
const PLAZA_PATTERNS = { rings: '同心环', grid: '网格', radial: '放射', checker: '棋盘', plain: '随机铺装' };
const PLAZA_CENTERS = { fountain: '喷泉', well: '水井', cross: '市场十字碑', statue: '雕像', maypole: '五月柱', obelisk: '方尖碑', column: '纪念柱', shrine: '路边神龛', tree: '大树', none: '无' };
const PLAZA_PAVING = {
  stone: { label: '石板', base: [['cobblestone', 4], ['stone_bricks', 3], ['andesite', 2], ['mossy_cobblestone', 1]], accent: 'polished_andesite', border: 'stone_bricks', slab: 'stone_brick_slab', trim: 'stone_brick' },
  worn: { label: '旧石（带苔藓）', base: [['cobblestone', 3], ['mossy_cobblestone', 3], ['stone', 2], ['coarse_dirt', 1]], accent: 'stone_bricks', border: 'mossy_stone_bricks', slab: 'mossy_stone_brick_slab', trim: 'mossy_stone_brick' },
  brick: { label: '砖', base: [['bricks', 4], ['mud_bricks', 2], ['packed_mud', 1]], accent: 'stone_bricks', border: 'stone_bricks', slab: 'stone_brick_slab', trim: 'stone_brick' },
  sandstone: { label: '砂岩', base: [['smooth_sandstone', 3], ['sandstone', 3], ['cut_sandstone', 2]], accent: 'cut_red_sandstone', border: 'cut_sandstone', slab: 'cut_sandstone_slab', trim: 'sandstone' },
  dark: { label: '深板岩', base: [['cobbled_deepslate', 3], ['deepslate_bricks', 3], ['deepslate_tiles', 2], ['cracked_deepslate_bricks', 1]], accent: 'polished_deepslate', border: 'deepslate_bricks', slab: 'deepslate_brick_slab', trim: 'deepslate_brick' },
};

const PLAZA_DEFAULT = {
  shape: 'octagon', width: 25, length: 21, paving: 'stone', pattern: 'rings', center: 'fountain',
  stalls: 4, goods: 'mix', stall_roof: 'mix', lamps: 'corners', trees: 4, tree_species: 'mix', tree_size: 'm', tree_layout: 'edge',
  tree_spacing: 5, planter: 'slab', benches: true, curb: true, seed: 1,
};
const PLAZA_TREE_LAYOUTS = { edge: '沿边随机', corners: '四角', ring: '围绕中心', avenue: '两侧成排', random: '自由散布' };
const PLAZA_PLANTERS = { slab: '石台阶树池', grass: '草地', none: '无（直接种在铺装里）' };

function plaza(o = {}) {
  const p = { ...PLAZA_DEFAULT, ...o };
  const W = Math.max(9, Math.min(45, Math.round(p.width))), L = Math.max(9, Math.min(45, Math.round(p.length)));
  const hw = (W - 1) >> 1, hl = (L - 1) >> 1;      // odd sizes keep a centre block
  const pave = PLAZA_PAVING[p.paving] || PLAZA_PAVING.stone, seed = p.seed || 1;
  const rng = new PyRandom(deriveSeed(seed, 'plaza'));
  const report = [];

  // ---- 1. footprint mask ----
  const jit = [];                                   // irregular: half-width per row, smoothed noise
  if (p.shape === 'irregular') for (let z = -hl; z <= hl; z++) {
    const t = (z + hl) / (2 * hl), n = _h(seed, 'pz-edge', Math.floor((z + hl) / 4)) * 2 - 1;
    jit.push(Math.round(hw * (0.6 + 0.4 * t) + n * 1.2));
  }
  const cut = Math.round(Math.min(hw, hl) * 0.55);
  const inside = (x, z) => {
    if (Math.abs(x) > hw || Math.abs(z) > hl) return false;
    if (p.shape === 'octagon') return Math.abs(x) + Math.abs(z) <= hw + hl - cut;
    if (p.shape === 'round') return (x / (hw + 0.5)) ** 2 + (z / (hl + 0.5)) ** 2 <= 1;
    if (p.shape === 'irregular') return Math.abs(x) <= jit[z + hl];
    return true;
  };
  // distance to the edge (8-neighbour BFS): 1 on the border ring, growing inward
  const E = new Map(), q = [];
  for (let x = -hw; x <= hw; x++) for (let z = -hl; z <= hl; z++) if (inside(x, z)) {
    let edge = false;
    for (let dx = -1; dx <= 1 && !edge; dx++) for (let dz = -1; dz <= 1; dz++) if (!inside(x + dx, z + dz)) { edge = true; break; }
    if (edge) { E.set(x + ',' + z, 1); q.push([x, z]); }
  }
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i], d = E.get(x + ',' + z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const k = (x + dx) + ',' + (z + dz);
      if (inside(x + dx, z + dz) && !E.has(k)) { E.set(k, d + 1); q.push([x + dx, z + dz]); }
    }
  }
  const S = new Structure(), used = new Set(), mark = (x, z) => used.add(x + ',' + z), free = (x, z) => inside(x, z) && !used.has(x + ',' + z);
  const entrance = (x, z) => Math.abs(x) <= 1 || Math.abs(z) <= 1;

  // ---- 2. centrepiece (decides the inner circle the pattern rings around) ----
  const C = new Structure(); let cr = 0;
  const big = Math.min(hw, hl) >= 9;
  if (p.center === 'fountain') {
    const mat = { stone: 'stone', worn: 'mossy', brick: 'stone', sandstone: 'sandstone', dark: 'dark' }[p.paving] || 'stone';
    const R = big ? 4 : 3, f = fountainProp({ radius: R, tiers: big ? 2 : 1, rim: 'block', material: mat, lanterns: false, apron: 0, seed });
    for (const [k, st] of f.S.blocks) C.blocks.set(k, st);
    cr = R;
  }
  else if (MONUMENT_TYPES[p.center]) {
    const mat = { stone: 'stone', worn: 'mossy', brick: 'stone', sandstone: 'sandstone', dark: 'dark' }[p.paving] || 'stone';
    const m = monument({ kind: p.center, material: mat, steps: 2, flowers: false, seed });
    for (const [k, st] of m.S.blocks) C.blocks.set(k, st);
    cr = m.radius;
  }
  else if (p.center === 'well') { const w = well({ style: 'roof', stone: 'stone_bricks', seed }); for (const [k, st] of w.S.blocks) C.blocks.set(k, st); cr = 2; }
  else if (p.center === 'tree') {
    const t = tree({ species: 'oak', size: big ? 'l' : 'm', seed });
    for (const [k, st] of t.S.blocks) C.blocks.set(k, st);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      const ring = Math.max(Math.abs(x), Math.abs(z)) === 2;
      C.set(x, -1, z, ring ? B(pave.border) : B('grass_block', { snowy: false }));
      if (ring) C.set(x, 0, z, B(`${pave.slab}`, { type: 'bottom', waterlogged: false }));
      else if ((x || z) && rng.random() < 0.5) C.set(x, 0, z, B(['short_grass', 'poppy', 'dandelion', 'oxeye_daisy'][Math.floor(rng.random() * 4)]));
    }
    cr = 2;
  }
  for (let x = -cr - 1; x <= cr + 1; x++) for (let z = -cr - 1; z <= cr + 1; z++) if (Math.hypot(x, z) <= cr + 1.5) mark(x, z);

  // ---- 3. paving ----
  for (const [k, e] of E) {
    const [x, z] = k.split(',').map(Number), d = Math.hypot(x, z);
    let accent = false;
    if (p.pattern === 'rings') accent = e % 4 === 0;
    else if (p.pattern === 'grid') accent = x % 5 === 0 || z % 5 === 0;
    else if (p.pattern === 'radial') accent = (x === 0 || z === 0 || Math.abs(x) === Math.abs(z)) || Math.round(d) === cr + 3;
    else if (p.pattern === 'checker') accent = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0;
    if (p.pattern !== 'radial' && cr && Math.round(d) === cr + 2) accent = true;   // a ring around the centrepiece
    const u = patchNoise(x, 0, z, deriveSeed(seed, 'plaza-pave'), 'pz', 2);
    S.set(x, -1, z, B(e === 1 ? pave.border : accent ? pave.accent : pickU(u, pave.base)));
    S.set(x, -2, z, B('dirt'));
  }
  for (const [k, st] of C.blocks) S.blocks.set(k, st);

  // ---- 4. lamps: walk from the centre toward each target direction, stop two short of the edge ----
  const toward = (ang, back) => {
    const dx = Math.cos(ang) * hw, dz = Math.sin(ang) * hl;
    let last = null;
    for (let t = 0; t <= 1.5; t += 0.01) {
      const x = Math.round(dx * t), z = Math.round(dz * t);
      if (!inside(x, z)) break;
      last = [x, z];
    }
    if (!last) return null;
    const len = Math.hypot(last[0], last[1]) || 1;
    return [Math.round(last[0] - last[0] / len * back), Math.round(last[1] - last[1] / len * back)];
  };
  const lampAngles = p.lamps === 'corners' ? [45, 135, 225, 315]
    : p.lamps === 'ring' ? (n => Array.from({ length: n }, (_, i) => 360 * (i + 0.5) / n))(Math.max(6, Math.round((W + L) / 5))) : [];
  let nl = 0;
  for (const a of lampAngles) {
    const at = toward(a * Math.PI / 180, 1); if (!at || !free(at[0], at[1]) || entrance(at[0], at[1])) continue;
    const lp = lampPost({ style: 'pillar', height: 3, stone: pave.trim === 'stone_brick' ? 'cobblestone' : pave.trim });
    placeProp(S, lp, at[0], 0, at[1], 0); mark(at[0], at[1]); nl++;
  }

  // ---- 7. benches on the diagonals around the centrepiece ----
  let nb = 0;
  if (p.benches && cr) {
    const r = cr + 3;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx * r, cells = [[x, sz * r], [x, sz * (r - 1)]];
      if (!cells.every(([a, b]) => free(a, b))) continue;
      for (const [a, b] of cells) { S.set(a, 0, b, B('spruce_stairs', { facing: sx < 0 ? 'west' : 'east', half: 'bottom', shape: 'straight', waterlogged: false })); mark(a, b); }
      nb++;
    }
  }

  // ---- 5. market stalls along the edges, facing the centre, keeping the four entrances clear ----
  // each (side, direction along the side) has a cursor; take turns so the stalls spread round the square
  const goodsKeys = Object.keys(STALL_WARES), roofKeys = Object.keys(STALL_ROOFS); let ns = 0;
  const goodsUsed = [], g0 = Math.floor(rng.random() * goodsKeys.length), r0 = Math.floor(rng.random() * roofKeys.length);
  const fp = []; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) fp.push([a, b]);   // 5x3 booth + front crates + gable overhang
  const lanes = []; for (const sgn of [-1, 1]) for (const side of [0, 2, 1, 3]) lanes.push({ side, sgn, t: 4, done: false });
  const fitAt = (side, t) => {
    const q = [2, 3, 0, 1][side];                  // quarter turns so the front faces the centre
    const rot = ([a, b]) => { let x = a, z = b; for (let i = 0; i < q; i++) [x, z] = [-z, x]; return [x, z]; };
    for (let inset = 2; inset <= 9; inset++) {
      const cx = side === 1 ? hw - inset : side === 3 ? -hw + inset : t;
      const cz = side === 0 ? -hl + inset : side === 2 ? hl - inset : t;
      const cells = fp.map(rot).map(([a, b]) => [cx + a, cz + b]);
      if (cells.every(([x, z]) => free(x, z) && !entrance(x, z))) return { cx, cz, cells, q };
    }
    return null;
  };
  while (ns < (p.stalls | 0) && lanes.some(l => !l.done)) for (const ln of lanes) {
    if (ln.done || ns >= (p.stalls | 0)) continue;
    const along = ln.side % 2 === 0 ? hw : hl; let ok = null;
    while (!ok && ln.t <= along - 2) { ok = fitAt(ln.side, ln.sgn * ln.t); ln.t += ok ? 6 : 1; }
    if (!ok) { ln.done = true; continue; }
    const goods = p.goods === 'mix' ? goodsKeys[(g0 + ns) % goodsKeys.length] : (STALL_WARES[p.goods] ? p.goods : 'produce');
    const roofK = p.stall_roof === 'mix' ? roofKeys[(r0 + ns) % roofKeys.length] : (STALL_ROOFS[p.stall_roof] ? p.stall_roof : 'flat');
    const st = stall({ wares: goods, roof: roofK, width: 5, depth: 3, seed: seed * 31 + ns });
    placeProp(S, st, ok.cx, 0, ok.cz, ok.q);
    for (const [x, z] of ok.cells) mark(x, z);
    goodsUsed.push(STALL_WARES[goods].label); ns++;
  }

  // ---- 6. trees: candidate spots by layout, then greedy with a minimum spacing ----
  let nt = 0; const treeSpecies = [];
  {
    const want = Math.max(0, Math.min(24, p.trees | 0)), gap = Math.max(3, Math.min(12, p.tree_spacing | 0 || 5));
    const trng = new PyRandom(deriveSeed(seed, 'plaza-trees'));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(trng.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let cand = [];
    const lay = p.tree_layout || 'edge';
    if (lay === 'edge' || lay === 'random') {
      for (const [k, e] of E) { const [x, z] = k.split(',').map(Number); if (lay === 'random' ? e >= 3 : e >= 3 && e <= 4) cand.push([x, z]); }
      shuffle(cand);
    } else if (lay === 'corners') {
      for (const c of [45, 135, 225, 315]) for (const back of [3, 4, 5, 6]) for (const da of [0, 12, -12, 24, -24]) {
        const at = toward((c + da) * Math.PI / 180, back); if (at) cand.push(at);
      }
    } else if (lay === 'ring') {
      const n = Math.max(want, 1), r0 = cr + 4;
      for (const dr of [0, 1, 2, 3]) for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * (i + 0.5) / n + (dr % 2 ? Math.PI / n : 0), r = r0 + dr;
        cand.push([Math.round(Math.cos(a) * r * hw / Math.max(hw, hl)), Math.round(Math.sin(a) * r * hl / Math.max(hw, hl))]);
      }
    } else if (lay === 'avenue') {                   // two rows along the long axis
      const longX = hw >= hl, half = longX ? hw : hl, n = Math.max(1, Math.ceil(want / 2)) + 1;
      for (const extra of [0, 1, 2]) for (let i = 0; i < n; i++) for (const sgn of [-1, 1]) {
        let t = Math.round(-half + 3 + (2 * half - 6) * (n === 1 ? 0.5 : i / (n - 1)));
        if (Math.abs(t) <= 2) t = (i % 2 ? 1 : -1) * 3;  // keep the cross axis (entrances) clear
        // walk in from this side's edge until the cell is 3 from the edge (works for every shape)
        for (let a = (longX ? hl : hw); a >= 0; a--) {
          const c = longX ? [t, sgn * a] : [sgn * a, t];
          if ((E.get(c[0] + ',' + c[1]) || 0) >= 3 + extra) { cand.push(c); break; }
        }
      }
    }
    const placedT = [], spOrder = ['oak', 'birch', 'cherry', 'spruce', 'dark_oak'];
    const sp0 = Math.floor(trng.random() * spOrder.length);
    for (const [x, z] of cand) {
      if (nt >= want) break;
      if (placedT.some(([a, b]) => Math.hypot(a - x, b - z) < gap)) continue;
      let fits = true;
      for (let dx = -1; dx <= 1 && fits; dx++) for (let dz = -1; dz <= 1; dz++) if (!free(x + dx, z + dz) || entrance(x + dx, z + dz)) { fits = false; break; }
      if (!fits) continue;
      const sp = p.tree_species === 'mix' ? (lay === 'avenue' ? spOrder[sp0] : spOrder[(sp0 + nt) % 3]) : (TREE_SPECIES[p.tree_species] ? p.tree_species : 'oak');
      const big = p.tree_size === 'l' && ['oak', 'birch', 'spruce'].includes(sp);
      if (p.planter !== 'none') {
        S.set(x, -1, z, B('grass_block', { snowy: false }));
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          if (p.planter === 'grass') { S.set(x + dx, -1, z + dz, B('grass_block', { snowy: false })); if (trng.random() < 0.35) S.set(x + dx, 0, z + dz, B(['short_grass', 'poppy', 'dandelion', 'cornflower'][Math.floor(trng.random() * 4)])); }
          else S.set(x + dx, 0, z + dz, B(pave.slab, { type: 'bottom', waterlogged: false }));
        }
      } else S.set(x, -1, z, B('dirt'));
      // big spruce has a 2x2 trunk: keep it inside the planter
      const t = tree({ species: sp, size: big ? 'l' : 'm', seed: seed * 7 + nt + 1 });
      placeProp(S, t, x, 0, z, 0, { ifEmpty: true });
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) mark(x + dx, z + dz);
      placedT.push([x, z]); treeSpecies.push(TREE_SPECIES[sp] + (big ? '（大）' : '')); nt++;
    }
  }

  // ---- 8. curb: a slab ring on the border band, open at the four entrances ----
  if (p.curb) for (const [k, e] of E) {
    if (e !== 1) continue;
    const [x, z] = k.split(',').map(Number);
    if (entrance(x, z) || S.has(x, 0, z)) continue;
    S.set(x, 0, z, B(pave.slab, { type: 'bottom', waterlogged: false }));
  }

  fixConnections(S); stairShapes(S);
  report.push(`广场：${PLAZA_SHAPES[p.shape] || p.shape} ${W}×${L}，${E.size} 格铺装（${pave.label} · ${PLAZA_PATTERNS[p.pattern] || p.pattern}）`);
  report.push(`中心：${PLAZA_CENTERS[p.center] || '无'}；路灯 ${nl} 盏；摊位 ${ns} 个${ns ? '（' + goodsUsed.join('、') + '）' : ''}；树 ${nt} 棵${nt ? '（' + PLAZA_TREE_LAYOUTS[p.tree_layout || 'edge'] + '：' + treeSpecies.join('、') + '）' : ''}；长椅 ${nb} 组`);
  const adjust = [];
  if (nt < (p.trees | 0)) adjust.push({ key: 'trees', got: nt, why: `间距 ${p.tree_spacing || 5} 格时只放得下 ${nt} 棵，可以减小间距、加大广场或换一种布置` });
  if (ns < (p.stalls | 0)) adjust.push({ key: 'stalls', got: ns, why: '广场太小或被中心物、树占了位置，加大广场或减少树' });
  if (nt < (p.trees | 0)) report.push(`树：要求 ${p.trees} 棵，只放下 ${nt} 棵（间距 ${p.tree_spacing || 5} 格放不下，可以减小间距或换一种布置）`);
  if (ns < (p.stalls | 0)) report.push(`摊位：要求 ${p.stalls} 个，只放下 ${ns} 个（广场太小或被其他物件占用）`);
  return { S, foot: [-hw, hw, -hl, hl], tags: ['landmark', 'plaza'], report, spec: { ...p, width: W, length: L, trees: nt, stalls: ns }, adjust };
}

const LANDMARKS = {
  church: { label: '教堂', make: church, styles: CHURCH_KINDS, defaults: CHURCH_DEFAULT, matSlots: CHURCH_MAT_SLOTS },
  cathedral: { label: '主教座堂', make: cathedral, styles: CATHEDRAL_STYLES, defaults: CATHEDRAL_DEFAULT, matSlots: CHURCH_MAT_SLOTS },
  monument: { label: '纪念物', make: monument, styles: MONUMENT_TYPES, defaults: MONUMENT_DEFAULT },
  fountain: { label: '喷泉', make: fountainProp, styles: FOUNTAIN_SHAPES, defaults: FOUNTAIN_DEFAULT },
  stall: { label: '摊位', make: stall, styles: STALL_ROOFS, defaults: STALL_DEFAULT },
  plaza: { label: '广场', make: plaza, styles: PLAZA_SHAPES, defaults: PLAZA_DEFAULT },
};
Object.assign(PROPS, LANDMARKS);
