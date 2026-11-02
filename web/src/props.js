// ---------------------------------------------------------------------------------------------
// Components (小品): small parametric builds placed in streets, squares and gardens.
// Each returns { S, foot:[x0,x1,z0,z1], tags } in local coordinates: y = 0 is the first layer above
// the ground, negative y digs into it, (0, 0) is the anchor (centre). Front = north (-z).
// ---------------------------------------------------------------------------------------------
const WALL1 = (b) => B(b, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' });
const LEAF = (b) => B(b, { distance: 1, persistent: true, waterlogged: false });

// ---- lamp posts --------------------------------------------------------------------------------
const LAMP_STYLES = { arm: '单臂吊灯', double: '双臂吊灯', pillar: '石柱座灯', post: '木桩座灯',
  gallows: '撑架链吊灯', quad: '四臂吊灯', cresset: '铁火盆柱', torch: '火把木桩',
  crane: '木梁挑臂灯', crane2: '双挑臂灯', yoke: '横梁双链灯', candela: '烛台双灯' };
const LAMP_CHISEL = { cobblestone: 'chiseled_stone_bricks', stone_brick: 'chiseled_stone_bricks', mossy_cobblestone: 'chiseled_stone_bricks', andesite: 'polished_andesite', blackstone: 'chiseled_polished_blackstone', deepslate_brick: 'chiseled_deepslate' };
const LAMP_BASE = { cobblestone: 'cobblestone', stone_brick: 'stone_bricks', mossy_cobblestone: 'mossy_cobblestone', andesite: 'polished_andesite', blackstone: 'polished_blackstone_bricks', deepslate_brick: 'deepslate_bricks' };
const LAMP_SLAB = { cobblestone: 'cobblestone', stone_brick: 'stone_brick', mossy_cobblestone: 'mossy_cobblestone', andesite: 'polished_andesite', blackstone: 'polished_blackstone_brick', deepslate_brick: 'deepslate_brick' };
// research-based medieval forms (2026-10-30): gallows/crook bracket with chain, multi-arm post,
// covered lantern, cresset (fire basket on a pole, the earliest street light), torch post.
function lampRich(style, h, wood, stone, lan) {
  const S = new Structure(), base = LAMP_BASE[stone] || 'stone_bricks', wall = WALL1(`${stone}_wall`);
  const fence = B(`${wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false });
  const slab = (y) => B(`${LAMP_SLAB[stone] || 'stone_brick'}_slab`, { type: y, waterlogged: false });
  // ---- reference-board styles (2026-10-30, GamaBuild-like): carved plinth with studs, banded shaft
  // (wall / fence / wall), a timber or stone head, lanterns on chains or standing on end posts.
  const dark = stone === 'blackstone' || stone === 'deepslate_brick';
  const plinth = () => {
    S.set(0, 0, 0, B(LAMP_CHISEL[stone] || 'chiseled_stone_bricks'));
    for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']])
      S.set(dx, 0, dz, B(dark ? 'polished_blackstone_button' : 'stone_button', { face: 'wall', facing: f, powered: false }));
  };
  const shaft = (top) => {           // y 1 .. top-1: two walls, timber band, wall under the head
    for (let y = 1; y < top; y++) S.set(0, y, 0, y <= 2 || y === top - 1 ? wall : fence);
  };
  const hang = (x, y, len) => {      // chain(s) under (x, y) then a hanging lantern
    for (let i = 1; i <= len; i++) S.set(x, y - i, 0, B('chain', { axis: 'y', waterlogged: false }));
    S.set(x, y - len - 1, 0, B(lan, { hanging: true, waterlogged: false }));
  };
  const wslab = t => B(`${wood}_slab`, { type: t, waterlogged: false });
  const wstair = (f, half) => B(`${wood}_stairs`, { facing: f, half, shape: 'straight', waterlogged: false });
  if (style === 'crane' || style === 'crane2') {   // lantern at y = h; timber head at T = h + 2
    const T = h + 2, two = style === 'crane2';
    plinth(); shaft(T);
    S.set(0, T, 0, B(`${wood}_planks`)); S.set(0, T + 1, 0, wslab('bottom'));
    for (const d of two ? [1, -1] : [1]) {
      S.set(d, T, 0, B(`${wood}_planks`)); S.set(d, T + 1, 0, wslab('bottom'));
      S.set(2 * d, T, 0, wslab('top')); S.set(3 * d, T, 0, B(`${wood}_planks`));
      S.set(d, T - 1, 0, wstair(d > 0 ? 'west' : 'east', 'top'));       // brace
      hang(3 * d, T, 1);
    }
    if (!two) { S.set(-1, T, 0, wstair('east', 'bottom')); S.set(-1, T - 1, 0, B(`${wood}_trapdoor`, { facing: 'west', half: 'top', open: true, powered: false, waterlogged: false })); }
    fixConnections(S); stairShapes(S);
    return { S, foot: [two ? -3 : -1, 3, -1, 1], tags: ['light'] };
  }
  if (style === 'yoke') {            // stone crossbar with short wall drops, chains and lanterns at both ends
    const T = h + 3;
    plinth(); shaft(T);
    S.set(0, T, 0, B(base)); S.set(0, T + 1, 0, slab('bottom'));
    for (const d of [1, -1]) {
      S.set(d, T, 0, slab('top')); S.set(2 * d, T, 0, B(base));
      S.set(2 * d, T - 1, 0, wall);
      hang(2 * d, T - 1, 1);
    }
    fixConnections(S);
    return { S, foot: [-2, 2, -1, 1], tags: ['light'] };
  }
  if (style === 'candela') {         // candelabra: fence crossbar, stone cups on the ends, standing lanterns
    const T = Math.max(2, h - 2);
    plinth();
    for (let y = 1; y <= T; y++) S.set(0, y, 0, y <= 1 ? wall : fence);
    for (const d of [1, -1, 2, -2]) S.set(d, T, 0, fence);
    S.set(0, T + 1, 0, wslab('bottom'));
    for (const d of [2, -2]) { S.set(d, T + 1, 0, wall); S.set(d, T + 2, 0, B(lan, { hanging: false, waterlogged: false })); }
    fixConnections(S);
    return { S, foot: [-2, 2, -1, 1], tags: ['light'] };
  }
  if (style === 'gallows') {          // stone foot, timber post, braced arm, chain, hanging lantern
    S.set(0, 0, 0, B(base));
    for (let y = 1; y <= h + 1; y++) S.set(0, y, 0, B(`${wood}_log`, { axis: 'y' }));
    S.set(1, h + 1, 0, fence); S.set(2, h + 1, 0, fence);
    S.set(1, h, 0, B(`${wood}_stairs`, { facing: 'west', half: 'top', shape: 'straight', waterlogged: false }));
    S.set(2, h, 0, B('chain', { axis: 'y', waterlogged: false }));
    S.set(2, h - 1, 0, B(lan, { hanging: true, waterlogged: false }));
    fixConnections(S);
    return { S, foot: [0, 2, 0, 0], tags: ['light'] };
  }
  if (style === 'quad') {             // stone column, cross of four arms, lantern under each, slab cap
    S.set(0, 0, 0, B(base));
    for (let y = 1; y <= h; y++) S.set(0, y, 0, wall);
    S.set(0, h + 1, 0, fence); S.set(0, h + 2, 0, slab('bottom'));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      S.set(dx, h + 1, dz, fence);
      S.set(dx, h, dz, B(lan, { hanging: true, waterlogged: false }));
    }
    fixConnections(S);
    return { S, foot: [-1, 1, -1, 1], tags: ['light'] };
  }
  if (style === 'cresset') {          // stone shaft, iron basket (bars) round a burning fire
    S.set(0, 0, 0, B(base));
    for (let y = 1; y < h; y++) S.set(0, y, 0, wall);
    S.set(0, h, 0, B(lan.startsWith('soul') ? 'soul_campfire' : 'campfire', { facing: 'north', lit: true, signal_fire: false, waterlogged: false }));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) S.set(dx, h, dz, B('iron_bars', { east: false, north: false, south: false, waterlogged: false, west: false }));
    fixConnections(S);
    return { S, foot: [-1, 1, -1, 1], tags: ['light'] };
  }
  // torch: log stump, fence pole, torch on top
  S.set(0, 0, 0, B(`${wood}_log`, { axis: 'y' }));
  for (let y = 1; y < h; y++) S.set(0, y, 0, fence);
  S.set(0, h, 0, B(`${wood}_log`, { axis: 'y' }));
  const wt = lan.startsWith('soul') ? 'soul_wall_torch' : 'wall_torch';
  for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) S.set(dx, h, dz, B(wt, { facing: f }));
  return { S, foot: [-1, 1, -1, 1], tags: ['light'] };
}
function lampPost(o = {}) {
  const style = o.style || 'arm', h = Math.max(2, Math.min(6, o.height || 3));
  const wood = o.wood || 'dark_oak', stone = o.stone || 'cobblestone', soul = !!o.soul;
  const S = new Structure(), lan = soul ? 'soul_lantern' : 'lantern';
  if (!['arm', 'double', 'pillar', 'post'].includes(style) && LAMP_STYLES[style]) return lampRich(style, h, wood, stone, lan);
  const fence = B(`${wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false });
  if (style === 'pillar') {
    S.set(0, 0, 0, B(stone === 'cobblestone' ? 'stone_bricks' : stone));
    for (let y = 1; y < h; y++) S.set(0, y, 0, WALL1(stone === 'cobblestone' ? 'stone_brick_wall' : `${stone}_wall`));
    S.set(0, h, 0, B(lan, { hanging: false, waterlogged: false }));
    return { S, foot: [0, 0, 0, 0], tags: ['light'] };
  }
  if (style === 'post') {
    S.set(0, 0, 0, WALL1(`${stone}_wall`));
    for (let y = 1; y < h; y++) S.set(0, y, 0, fence);
    S.set(0, h, 0, B(lan, { hanging: false, waterlogged: false }));
    return { S, foot: [0, 0, 0, 0], tags: ['light'] };
  }
  // arm / double: wall base, fence post, fence arm(s) at the top with a hanging lantern under each
  S.set(0, 0, 0, WALL1(`${stone}_wall`));
  for (let y = 1; y <= h + 1; y++) S.set(0, y, 0, fence);
  const arms = style === 'double' ? [-1, 1] : [1];
  for (const d of arms) {
    S.set(d, h + 1, 0, fence);
    S.set(d, h, 0, B(lan, { hanging: true, waterlogged: false }));
  }
  fixConnections(S);
  return { S, foot: [Math.min(0, ...arms), Math.max(0, ...arms), 0, 0], tags: ['light'] };
}

// ---- trees: the vanilla tree features (trunk placer + foliage placer, same parameters as the game) ----
// oak / birch: StraightTrunk + BlobFoliage; big oak: FancyTrunk + FancyFoliage; spruce: StraightTrunk +
// SpruceFoliage; mega spruce: GiantTrunk + MegaPineFoliage; dark oak: DarkOakTrunk + DarkOakFoliage;
// cherry: CherryTrunk + CherryFoliage. Only the random numbers differ from the game (its own RNG).
const TREE_SPECIES = { oak: '橡树', birch: '白桦', spruce: '云杉', dark_oak: '深色橡树', cherry: '樱花' };
const TREE_VARIANTS = { oak: '普通 / 大橡树', birch: '普通 / 高大白桦', spruce: '普通 / 巨型云杉', dark_oak: '普通', cherry: '普通' };
function tree(o = {}) {
  const sp = o.species || 'oak', big = o.size === 'l', R = new PyRandom(deriveSeed(o.seed || 1, 'tree:' + sp + (big ? 'l' : 'n')));
  const nextInt = n => n <= 1 ? 0 : R._randbelow(n), nextFloat = () => R.random(), nextBool = () => R.random() < 0.5;
  const uni = (a, b) => a + nextInt(b - a + 1);
  const S = new Structure(), wood = sp, logName = `${wood}_log`, leaf = LEAF(`${wood}_leaves`);
  const logAt = (x, y, z, axis = 'y') => S.set(x, y, z, B(logName, { axis }));
  const leafAt = (x, y, z) => { if (!S.has(x, y, z)) S.set(x, y, z, leaf); };
  // FoliagePlacer.placeLeavesRow with the per-placer skip rule
  const row = (px, py, pz, range, y, dbl, skip) => {
    const off = dbl ? 1 : 0;
    for (let dx = -range; dx <= range + off; dx++) for (let dz = -range; dz <= range + off; dz++) {
      const ax = dbl ? Math.min(Math.abs(dx), Math.abs(dx - 1)) : Math.abs(dx), az = dbl ? Math.min(Math.abs(dz), Math.abs(dz - 1)) : Math.abs(dz);
      if (!skip(ax, y, az, range, dx, dz)) leafAt(px + dx, py + y, pz + dz);
    }
  };
  const jdiv = (a, b) => Math.trunc(a / b);           // Java integer division
  const blob = (px, py, pz, radius, offset, height) => {   // BlobFoliagePlacer
    for (let y = offset; y >= offset - height; y--) {
      const r = Math.max(radius - 1 - jdiv(y, 2), 0);
      row(px, py, pz, r, y, false, (x, yy, z, rg) => x === rg && z === rg && (nextInt(2) === 0 || yy === 0));
    }
  };
  const straight = (base, ra, rb) => { const h = base + nextInt(ra + 1) + nextInt(rb + 1); for (let i = 0; i < h; i++) logAt(0, i, 0); return h; };

  if ((sp === 'oak' && !big) || sp === 'birch') {
    const h = sp === 'oak' ? straight(4, 2, 0) : straight(5, 2, big ? 6 : 0);
    blob(0, h, 0, 2, 0, 3);
  } else if (sp === 'oak' && big) {                     // FancyTrunkPlacer(3, 11, 0) + FancyFoliagePlacer(2, 4, 4)
    const free = 3 + nextInt(12), height = free + 2, trunkH = Math.floor(height * 0.618);
    const per = Math.min(1, Math.floor(1.382 + Math.pow(height / 13, 2)));
    const shape = y => { if (y < height * 0.3) return -1; const r = height / 2, adj = r - y; let d = Math.sqrt(r * r - adj * adj); if (adj === 0) d = r; else if (Math.abs(adj) >= r) return 0; return d * 0.5; };
    const limb = (a, b, place) => {
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], steps = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
      if (!steps) { if (place) logAt(a[0], a[1], a[2]); return true; }
      for (let i = 0; i <= steps; i++) {
        const p = [a[0] + Math.floor(0.5 + i * d[0] / steps), a[1] + Math.floor(0.5 + i * d[1] / steps), a[2] + Math.floor(0.5 + i * d[2] / steps)];
        if (place) { const xd = Math.abs(p[0] - a[0]), zd = Math.abs(p[2] - a[2]), m = Math.max(xd, zd); logAt(p[0], p[1], p[2], m > 0 ? (xd === m ? 'x' : 'z') : 'y'); }
      }
      return true;
    };
    const coords = [[[0, height - 5, 0], trunkH]];
    for (let ry = height - 5; ry >= 0; ry--) {
      const sh = shape(ry); if (sh < 0) continue;
      for (let i = 0; i < per; i++) {
        const rad = sh * (nextFloat() + 0.328), ang = nextFloat() * 2 * Math.PI;
        const cs = [Math.floor(rad * Math.sin(ang) + 0.5), ry - 1, Math.floor(rad * Math.cos(ang) + 0.5)];
        if (limb(cs, [cs[0], cs[1] + 5, cs[2]], false)) {
          const bh = cs[1] - Math.sqrt(cs[0] * cs[0] + cs[2] * cs[2]) * 0.381, top = bh > trunkH ? trunkH : Math.trunc(bh);
          if (limb([0, top, 0], cs, false)) coords.push([cs, top]);
        }
      }
    }
    limb([0, 0, 0], [0, trunkH, 0], true);
    for (const [p, base] of coords) if (!(p[0] === 0 && p[1] === base && p[2] === 0) && base >= height * 0.2) limb([0, base, 0], p, true);
    for (const [p, base] of coords) if (base >= height * 0.2) {
      for (let y = 4; y >= 0; y--) {                    // FancyFoliagePlacer: offset 4, height 4
        const r = 2 + (y !== 4 && y !== 0 ? 1 : 0);
        row(p[0], p[1], p[2], r, y, false, (x, yy, z, rg) => (x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5) > rg * rg);
      }
    }
  } else if (sp === 'spruce' && !big) {                 // StraightTrunk(5, 2, 1) + SpruceFoliage(2..3, 0..2, trunk 1..2)
    const h = straight(5, 2, 1), radius = uni(2, 3), offset = uni(0, 2), fh = Math.max(4, h - uni(1, 2));
    let cur = nextInt(2), max = 1, min = 0;
    for (let y = offset; y >= -fh; y--) {
      row(0, h, 0, cur, y, false, (x, yy, z, rg) => x === rg && z === rg && rg > 0);
      if (cur >= max) { cur = min; min = 1; max = Math.min(max + 1, radius); } else cur++;
    }
  } else if (sp === 'spruce' && big) {                  // GiantTrunk(13, 2, 14) + MegaPineFoliage(0, 0, crown 13..17)
    const h = 13 + nextInt(3) + nextInt(15);
    for (let i = 0; i < h; i++) { logAt(0, i, 0); if (i < h - 1) { logAt(1, i, 0); logAt(1, i, 1); logAt(0, i, 1); } }
    const fh = uni(13, 17); let prev = 0;
    for (let yy = h - fh; yy <= h; yy++) {
      const yo = h - yy, smooth = Math.floor(yo / fh * 3.5);
      const jag = yo > 0 && smooth === prev && (yy & 1) === 0 ? smooth + 1 : smooth;
      row(0, yy, 0, jag, 0, true, (x, y, z, rg) => x + z >= 7 || x * x + z * z > rg * rg);
      prev = smooth;
    }
  } else if (sp === 'dark_oak') {                       // DarkOakTrunk(6, 2, 1) + DarkOakFoliage(0, 0)
    const h = 6 + nextInt(3) + nextInt(2), dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]], lean = dirs[nextInt(4)];
    const leanH = h - nextInt(4); let steps = 2 - nextInt(3), tx = 0, tz = 0;
    for (let dy = 0; dy < h; dy++) {
      if (dy >= leanH && steps > 0) { tx += lean[0]; tz += lean[1]; steps--; }
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) logAt(tx + a, dy, tz + b);
    }
    const ey = h - 1, att = [[tx, ey, tz, true]];
    for (let ox = -1; ox <= 2; ox++) for (let oz = -1; oz <= 2; oz++) {
      if ((ox < 0 || ox > 1 || oz < 0 || oz > 1) && nextInt(3) <= 0) {
        const len = nextInt(3) + 2;
        for (let by = 0; by < len; by++) logAt(ox, ey - by - 1, oz);
        att.push([ox, ey, oz, false]);
      }
    }
    for (const [px, py, pz, dbl] of att) {
      const skip = (yv) => (x, y, z, rg, dx, dz) => {
        if (y === 0 && dbl && (dx === -rg || dx >= rg) && (dz === -rg || dz >= rg)) return true;
        if (y === -1 && !dbl) return x === rg && z === rg;
        if (y === 1) return x + z > rg * 2 - 2;
        return false;
      };
      if (dbl) { row(px, py, pz, 2, -1, true, skip()); row(px, py, pz, 3, 0, true, skip()); row(px, py, pz, 2, 1, true, skip()); if (nextBool()) row(px, py, pz, 0, 2, true, skip()); }
      else { row(px, py, pz, 2, -1, false, skip()); row(px, py, pz, 1, 0, false, skip()); }
    }
  } else if (sp === 'cherry') {                         // CherryTrunkPlacer(7, 1, 0, ...) + CherryFoliagePlacer(4, 0, 5, ...)
    const h = 7 + nextInt(2), w = nextInt(4), count = w === 0 ? 1 : w === 3 ? 3 : 2;
    const first = Math.max(0, h - 1 + uni(-4, -3)); let second = Math.max(0, h - 1 + uni(-4, -4)); if (second >= first) second++;
    const middle = count === 3, both = count >= 2;
    const trunkH = middle ? h : both ? Math.max(first, second) + 1 : first + 1;
    for (let i = 0; i < trunkH; i++) logAt(0, i, 0);
    const att = []; if (middle) att.push([0, trunkH, 0]);
    const D = [[0, -1, 'z'], [1, 0, 'x'], [0, 1, 'z'], [-1, 0, 'x']], dir = D[nextInt(4)], opp = D[(D.indexOf(dir) + 2) % 4];
    const branch = (d, off, cont) => {
      const p = [0, off, 0], endOff = h - 1 + uni(-1, 0), away = cont || endOff < off, dist = uni(2, 4) + (away ? 1 : 0);
      const end = [d[0] * dist, endOff, d[1] * dist];
      for (let i = 0; i < (away ? 2 : 1); i++) { p[0] += d[0]; p[2] += d[1]; logAt(p[0], p[1], p[2], d[2]); }
      const vdir = end[1] > p[1] ? 1 : -1;
      for (let guard = 0; guard < 64; guard++) {
        const dm = Math.abs(end[0] - p[0]) + Math.abs(end[1] - p[1]) + Math.abs(end[2] - p[2]);
        if (dm === 0) return [end[0], end[1] + 1, end[2]];
        const up = nextFloat() < Math.abs(end[1] - p[1]) / dm;
        if (up) p[1] += vdir; else { p[0] += d[0]; p[2] += d[1]; }
        logAt(p[0], p[1], p[2], up ? 'y' : d[2]);
      }
      return [p[0], p[1] + 1, p[2]];
    };
    att.push(branch(dir, first, first < trunkH - 1));
    if (both) att.push(branch(opp, second, second < trunkH - 1));
    const skip = (x, y, z, rg) => {
      if (y === -1 && (x === rg || z === rg) && nextFloat() < 0.25) return true;
      const corner = x === rg && z === rg;
      return rg > 2 ? (corner || (x + z > rg * 2 - 2 && nextFloat() < 0.25)) : (corner && nextFloat() < 0.25);
    };
    for (const [px, py, pz] of att) {
      const cur = 4 - 1;
      row(px, py, pz, cur - 2, 5 - 3, false, skip); row(px, py, pz, cur - 1, 5 - 4, false, skip);
      for (let y = 5 - 5; y >= 0; y--) row(px, py, pz, cur, y, false, skip);
      for (const [rg, ly] of [[cur, -1], [cur - 1, -2]]) {
        row(px, py, pz, rg, ly, false, skip);
        for (let dx = -rg; dx <= rg; dx++) for (let dz = -rg; dz <= rg; dz++) {      // hanging leaves under the row's edge
          if (Math.abs(dx) !== rg && Math.abs(dz) !== rg) continue;
          if (!S.has(px + dx, py + ly, pz + dz) || Math.abs(dx) + Math.abs(dz) + 1 >= 7) continue;
          if (nextFloat() <= 0.16666667) { leafAt(px + dx, py + ly - 1, pz + dz); if (Math.abs(dx) + Math.abs(dz) + 2 < 7 && nextFloat() <= 0.33333334) leafAt(px + dx, py + ly - 2, pz + dz); }
        }
      }
    }
  }
  return { S, foot: [0, 0, 0, 0], tags: ['tree'] };
}

// ---- well --------------------------------------------------------------------------------------
const WELL_STYLES = { open: '石砌井', roof: '带顶井' };
function well(o = {}) {
  const style = o.style || 'roof', stone = o.stone || 'stone_bricks', wood = o.wood || 'spruce';
  const rng = new PyRandom(deriveSeed(o.seed || 1, 'well'));
  const S = new Structure();
  const stoneMix = () => B(rng.random() < 0.25 ? (stone === 'stone_bricks' ? 'mossy_stone_bricks' : 'mossy_cobblestone') : stone);
  const rim = (x, z) => Math.max(Math.abs(x), Math.abs(z)) === 2;
  // shaft: walls 4 deep, water 3 deep, inner 3x3
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    for (let y = -4; y <= -1; y++) {
      if (rim(x, z)) S.set(x, y, z, stoneMix());
      else S.set(x, y, z, y === -4 ? B('gravel') : B('water', { level: 0 }));
    }
    if (rim(x, z)) S.set(x, 0, z, stoneMix());
  }
  if (style === 'roof') {
    const fence = B(`${wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false });
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = 1; y <= 3; y++) S.set(x, y, z, fence);
    // little hip roof: a ring of stairs rising toward the middle, planks inside, slab on top
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (!rim(x, z)) { S.set(x, 4, z, B(`${wood}_planks`)); continue; }
      const f = z === -2 ? 'south' : z === 2 ? 'north' : x === -2 ? 'east' : 'west';
      S.set(x, 4, z, B(`${wood}_stairs`, { facing: f, half: 'bottom', shape: 'straight', waterlogged: false }));
    }
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      if (x || z) S.set(x, 5, z, B(`${wood}_stairs`, { facing: z === -1 ? 'south' : z === 1 ? 'north' : x === -1 ? 'east' : 'west', half: 'bottom', shape: 'straight', waterlogged: false }));
    }
    S.set(0, 5, 0, B(`${wood}_slab`, { type: 'bottom', waterlogged: false }));
    S.set(0, 3, 0, B('chain', { axis: 'y', waterlogged: false }));
    S.set(0, 4, 0, B(`${wood}_planks`));
    fixConnections(S);
    stairShapes(S);
  }
  return { S, foot: [-2, 2, -2, 2], tags: ['water', 'landmark'] };
}

const PROPS = {
  lamp: { label: '路灯', make: lampPost, styles: LAMP_STYLES },
  tree: { label: '树', make: tree, styles: TREE_SPECIES },
  well: { label: '井', make: well, styles: WELL_STYLES },
};

// copy a component into a world structure at (x, y, z), turned by quarter turns (front north -> ...)
function placeProp(W, prop, x, y, z, q = 0, opts = {}) {
  const blocks = rotQuarter(prop.S.blocks, q), placed = opts.placed;
  for (const [k, st] of blocks) {
    const [a, b, c] = unkey(k), kk = key3(x + a, y + b, z + c);
    if (opts.ifEmpty && W.blocks.has(kk) && !isAir(W.blocks.get(kk))) continue;
    W.blocks.set(kk, st);
    if (placed) placed.add(kk);
  }
}

// ---- placement checks: things that break or change once pasted into the game -------------------
const SOIL = /(grass_block|dirt|podzol|coarse_dirt|rooted_dirt|farmland|moss_block|mud\b|mycelium)/;
const GRAVITY = /^minecraft:(sand|red_sand|gravel|suspicious_\w+|\w+_concrete_powder|anvil|chipped_anvil|damaged_anvil|scaffolding|pointed_dripstone)\b/;
const PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|poppy|dandelion|cornflower|\w+_tulip|allium|azure_bluet|oxeye_daisy|lily_of_the_valley|blue_orchid|rose_bush|lilac|peony|sunflower|\w+_sapling|sweet_berry_bush|wildflowers|pink_petals)\b/;
function checkPlacement(S, only) {
  const issues = { leaves: 0, lantern: 0, plant: 0, gravity: 0, water: 0, door: 0 }, where = {};
  const note = (k, key) => { issues[k]++; (where[k] = where[k] || []).length < 5 && where[k].push(key); };
  const get = (x, y, z) => S.blocks.get(key3(x, y, z));
  const keys = only ? [...only] : [...S.blocks.keys()];
  for (const k of keys) {
    const st = S.blocks.get(k); if (!st) continue;
    const [x, y, z] = unkey(k), below = get(x, y - 1, z), above = get(x, y + 1, z);
    if (st.includes('_leaves[') && st.includes('persistent=false')) note('leaves', k);
    if (/lantern\[/.test(st)) { if (st.includes('hanging=true') ? isAir(above) : isAir(below)) note('lantern', k); }
    if (PLANT.test(st) && !st.includes(':potted_') && !(below && SOIL.test(below)) && !(st.includes('half=upper'))) note('plant', k);
    if (GRAVITY.test(st) && (isAir(below) || isWater(below))) note('gravity', k);
    if (isWater(st)) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) if (isAir(get(x + dx, y + dy, z + dz))) { note('water', k); break; }
    if (/_door\[/.test(st)) { const up = st.includes('half=lower'); const o = get(x, y + (up ? 1 : -1), z); if (!o || !/_door\[/.test(o)) note('door', k); }
  }
  const total = Object.values(issues).reduce((a, b) => a + b, 0);
  return { total, issues, where };
}
