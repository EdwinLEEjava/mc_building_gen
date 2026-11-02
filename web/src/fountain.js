// ---------------------------------------------------------------------------------------------
// Fountain (喷泉) as its own landmark. Only still water: every water block is a source sitting on a
// solid floor and walled in on all four sides, so nothing flows once pasted.
//   basin: shape + radius + depth, rim style, optional apron of paving around it
//   tiers: bowls stacked on a central column, each smaller and two blocks higher
//   top:   water bowl / lantern / finial
// ---------------------------------------------------------------------------------------------
const FOUNTAIN_SHAPES = { round: '圆形', octagon: '八角形', square: '方形', quatrefoil: '四叶形' };
const FOUNTAIN_RIMS = { block: '石砌池沿', ledge: '台阶池沿（可坐）', wall: '矮墙池沿' };
const FOUNTAIN_TOPS = { water: '顶层水盆', lantern: '灯笼', finial: '尖顶石饰' };
const FOUNTAIN_MATERIALS = {
  stone: { label: '石砖', block: 'stone_bricks', accent: 'chiseled_stone_bricks', stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', wall: 'stone_brick_wall', floor: 'cobblestone' },
  mossy: { label: '苔石砖', block: 'mossy_stone_bricks', accent: 'chiseled_stone_bricks', stairs: 'mossy_stone_brick_stairs', slab: 'mossy_stone_brick_slab', wall: 'mossy_stone_brick_wall', floor: 'mossy_cobblestone' },
  sandstone: { label: '砂岩', block: 'cut_sandstone', accent: 'chiseled_sandstone', stairs: 'sandstone_stairs', slab: 'cut_sandstone_slab', wall: 'sandstone_wall', floor: 'smooth_sandstone' },
  dark: { label: '深板岩', block: 'deepslate_bricks', accent: 'chiseled_deepslate', stairs: 'deepslate_brick_stairs', slab: 'deepslate_brick_slab', wall: 'deepslate_brick_wall', floor: 'cobbled_deepslate' },
  quartz: { label: '石英', block: 'quartz_bricks', accent: 'chiseled_quartz_block', stairs: 'quartz_stairs', slab: 'quartz_slab', wall: 'diorite_wall', floor: 'smooth_quartz' },
};
const FOUNTAIN_DEFAULT = { shape: 'round', radius: 4, depth: 1, tiers: 2, rim: 'ledge', top: 'water', material: 'stone', lanterns: true, lily: true, apron: 1, seed: 1 };

function fountainProp(o = {}) {
  const p = { ...FOUNTAIN_DEFAULT, ...o };
  const R = Math.max(2, Math.min(8, p.radius | 0)), depth = Math.max(1, Math.min(2, p.depth | 0));
  const M = FOUNTAIN_MATERIALS[p.material] || FOUNTAIN_MATERIALS.stone;
  const rng = new PyRandom(deriveSeed(p.seed || 1, 'fountain'));
  const S = new Structure();
  const toC = (x, z) => Math.abs(z) >= Math.abs(x) ? (z < 0 ? 'south' : 'north') : (x < 0 ? 'east' : 'west');
  const stair = (f, half) => B(M.stairs, { facing: f, half, shape: 'straight', waterlogged: false });
  const wall = () => B(M.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' });

  // ---- basin footprint ----
  const lobe = R * 0.5, lr = R * 0.62;
  const inside = (x, z) => {
    if (p.shape === 'square') return Math.max(Math.abs(x), Math.abs(z)) <= R;
    if (p.shape === 'octagon') return Math.max(Math.abs(x), Math.abs(z)) <= R && Math.abs(x) + Math.abs(z) <= R * 1.45;
    if (p.shape === 'quatrefoil') return Math.hypot(x, z) <= R * 0.55 || [[lobe, 0], [-lobe, 0], [0, lobe], [0, -lobe]].some(([a, b]) => Math.hypot(x - a, z - b) <= lr);
    return Math.hypot(x, z) <= R + 0.4;
  };
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const cells = []; for (let x = -R - 1; x <= R + 1; x++) for (let z = -R - 1; z <= R + 1; z++) if (inside(x, z)) cells.push([x, z]);
  const isRim = (x, z) => N8.some(([dx, dz]) => !inside(x + dx, z + dz));
  let water = 0;
  for (const [x, z] of cells) {
    S.set(x, -depth - 1, z, B(M.floor));
    if (isRim(x, z)) {
      for (let y = -depth; y <= 0; y++) S.set(x, y, z, B(M.block));
      if (p.rim === 'wall') S.set(x, 1, z, wall());
    } else {
      for (let y = -depth; y <= 0; y++) S.set(x, y, z, B('water', { level: 0 }));
      water++;
      if (p.lily && Math.hypot(x, z) > 2.5 && rng.random() < 0.08) S.set(x, 1, z, B('lily_pad'));
    }
  }
  // ledge: a ring of steps outside the rim (seats); apron: paving around everything
  const ring = (dist) => {
    const out = [];
    for (let x = -R - dist - 1; x <= R + dist + 1; x++) for (let z = -R - dist - 1; z <= R + dist + 1; z++) {
      if (inside(x, z)) continue;
      let near = false; for (let dx = -dist; dx <= dist && !near; dx++) for (let dz = -dist; dz <= dist; dz++) if (inside(x + dx, z + dz)) { near = true; break; }
      if (near) out.push([x, z]);
    }
    return out;
  };
  if (p.rim === 'ledge') for (const [x, z] of ring(1)) { S.set(x, 0, z, stair(toC(x, z), 'bottom')); S.set(x, -1, z, B(M.block)); }
  const ap = Math.max(0, Math.min(3, p.apron | 0)) + (p.rim === 'ledge' ? 1 : 0);
  if (ap) for (const [x, z] of ring(ap)) if (!S.has(x, -1, z)) S.set(x, -1, z, B(rng.random() < 0.3 ? M.block : M.floor));

  // ---- lanterns on short posts at the four diagonal points of the rim ----
  let nl = 0;
  if (p.lanterns) for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let at = null; for (let t = R + 1; t >= 1; t--) { const x = Math.round(sx * t * 0.7071), z = Math.round(sz * t * 0.7071); if (inside(x, z) && isRim(x, z)) { at = [x, z]; break; } }
    if (!at) continue;
    const [x, z] = at, y0 = p.rim === 'wall' ? 1 : 1;
    S.set(x, y0, z, B(M.block)); S.set(x, y0 + 1, z, wall()); S.set(x, y0 + 2, z, B('lantern', { hanging: false, waterlogged: false })); nl++;
  }

  // ---- tiers: bowls on a central column ----
  const radii = []; let r = Math.min(3, R - 2);
  for (let t = 0; t < Math.max(0, Math.min(3, p.tiers | 0)) && r >= 1; t++) { radii.push(r); r = Math.max(1, r - 1); if (radii.length > 1 && radii[radii.length - 1] === 1 && radii[radii.length - 2] === 1) { radii.pop(); break; } }
  const tiersGot = radii.length;
  let y = 0;
  for (let i = 0; i < radii.length; i++) {
    const br = radii[i], top = i === radii.length - 1, by = y + (i === 0 ? 3 : 2);
    // the first column stands on the pool floor (through the water); later ones on the bowl below
    for (let yy = i === 0 ? -depth : y + 1; yy < by; yy++) S.set(0, yy, 0, B(yy === 1 && i === 0 ? M.accent : M.block));
    // bowl: floor at by-1 under the water, rim of upside-down stairs at by, water inside
    for (let x = -br; x <= br; x++) for (let z = -br; z <= br; z++) {
      const d = br === 1 ? Math.max(Math.abs(x), Math.abs(z)) : Math.hypot(x, z);
      if (d > br + 0.4) continue;
      const rim = br === 1 ? d === 1 : d > br - 0.6;
      if (rim) S.set(x, by, z, stair(toC(x, z), 'top'));
      else {
        S.set(x, by - 1, z, B(M.block));
        const centre = !x && !z;
        if (centre && !(top && p.top === 'water')) S.set(x, by, z, B(M.block));
        else { S.set(x, by, z, B('water', { level: 0 })); water++; }
      }
    }
    y = by;
  }
  if (p.top !== 'water') {
    if (!radii.length) { for (let yy = -depth; yy < 0; yy++) S.set(0, yy, 0, B(M.block)); S.set(0, 0, 0, B(M.accent)); }   // a plinth in the pool
    else S.set(0, y, 0, B(M.block));
    if (p.top === 'lantern') S.set(0, y + 1, 0, B('lantern', { hanging: false, waterlogged: false }));
    else { S.set(0, y + 1, 0, B(M.accent)); S.set(0, y + 2, 0, wall()); S.set(0, y + 3, 0, B(M.slab, { type: 'bottom', waterlogged: false })); }
  }

  fixConnections(S); stairShapes(S);
  const ext = R + ap + 1;
  const report = [`喷泉：${FOUNTAIN_SHAPES[p.shape] || '圆形'}水池，半径 ${R}，水深 ${depth}，${FOUNTAIN_RIMS[p.rim] || ''}；${radii.length} 层水盆；顶部${FOUNTAIN_TOPS[p.top] || ''}；${M.label}；水 ${water} 格（全部为静水源）；灯柱 ${nl} 根`];
  return { S, foot: [-ext, ext, -ext, ext], tags: ['water', 'landmark'], report, spec: { ...p, radius: R, depth, tiers: tiersGot }, adjust: tiersGot < Math.min(3, p.tiers | 0) ? [{ key: 'tiers', got: tiersGot, why: `半径 ${R} 的水池中间只放得下 ${tiersGot} 层水盆，加大半径可以放更多层` }] : [] };
}
