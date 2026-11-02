// ---------------------------------------------------------------------------------------------
// Layout layer: one district (街区) on the terrain.
//   1. main street: the straight line across the region that needs the least earthwork
//   2. a market square on the flattest stretch of one side, with a well, lamps and trees
//   3. narrow plots (burgage plots) along both sides; each house gets a level pad inside the user's
//      cut / fill budget, faces the street and is joined to it by a short path
//   4. back gardens get trees; plots that can't be levelled within budget stay green
// ---------------------------------------------------------------------------------------------
const PALETTE_KEYS = ['medieval_timber', 'taiga_cabin', 'oak_cottage'];

function chooseStreet(T, width, margin) {
  let best = null;
  for (const axis of ['x', 'z']) {
    const span = axis === 'x' ? T.L : T.W, len = axis === 'x' ? T.W : T.L;
    for (let c = margin; c < span - margin; c += 2) {
      const cells = []; for (let a = 1; a < len - 1; a++) cells.push(axis === 'x' ? [T.x0 + a, T.z0 + c] : [T.x0 + c, T.z0 + a]);
      const lv = gradeLine(T, cells, 3);
      let cost = 0, wet = 0;
      cells.forEach(([x, z], i) => { cost += Math.abs(lv[i] - T.H(x, z)); wet += T.water[T.idx(x, z)]; });
      cost = (cost + wet * 20) / cells.length + Math.abs(c - span / 2) / span * 0.6 - len / 400;
      if (!best || cost < best.cost) best = { axis, c, cost, cells, lv };
    }
  }
  return best;
}

function town(T, o = {}) {
  if (o.roads && o.roads.length) return townRoads(T, o);
  const seed = o.seed || 1, rng = new PyRandom(deriveSeed(seed, 'town'));
  const budget = { cut: o.budget?.cut ?? 3, fill: o.budget?.fill ?? 3 };
  const width = o.streetWidth || 5, half = (width - 1) / 2, depth = o.plotDepth || 17;
  const report = [], placed = new Set(), occupied = new Set(), roadSet = new Map();
  const st = chooseStreet(T, width, depth + 2);
  const along = st.axis === 'x' ? 0 : 1;                 // index into [x, z] that runs along the street
  const cAt = st.c + (st.axis === 'x' ? T.z0 : T.x0);
  const P = (a, b) => along === 0 ? [a, b] : [b, a];      // (along, across) -> (x, z)
  const aMin = (along === 0 ? T.x0 : T.z0) + 1, aMax = (along === 0 ? T.x1 : T.z1) - 1;
  const roadLevel = a => st.lv[Math.max(0, Math.min(st.lv.length - 1, a - aMin))];
  report.push(`主街：沿 ${st.axis} 方向，长 ${st.cells.length} 格，宽 ${width} 格`);

  // ---- 1. street (graded, no props yet) ----
  const sres = street(T, { path: [P(aMin, cAt), P(aMax, cAt)], kind: 'main', width, seed, lamps: false, roadSet, occupied, placed });
  report.push(`主街高差 ${sres.rise} 格，${sres.steps} 处台阶（坡度不超过 1/3）`);

  // ---- 2. market square on the flattest side stretch ----
  const sqLen = o.squareLength || 15, sqDepth = o.squareDepth || 11;
  let sq = null; const sqItems = [];
  if (o.square !== false) {
    for (const side of [-1, 1]) for (let a0 = aMin + 8; a0 + sqLen < aMax - 8; a0 += 2) {
      const b0 = cAt + side * (Math.floor(half) + 1);
      let lo = Infinity, hi = -Infinity, wet = 0;
      for (let a = a0; a < a0 + sqLen; a++) for (let k = 0; k < sqDepth; k++) {
        const [x, z] = P(a, b0 + side * k); if (!T.inside(x, z)) { wet += 99; continue; }
        lo = Math.min(lo, T.H(x, z)); hi = Math.max(hi, T.H(x, z)); wet += T.water[T.idx(x, z)];
      }
      const lvl = roadLevel(a0 + (sqLen >> 1));
      const cost = Math.max(hi - lvl, 0) + Math.max(lvl - lo, 0) + wet * 50 + Math.abs(a0 + sqLen / 2 - (aMin + aMax) / 2) * 0.15;
      if (!sq || cost < sq.cost) sq = { side, a0, b0, lvl, cost, cut: Math.max(hi - lvl, 0), fill: Math.max(lvl - lo, 0) };
    }
    if (sq && sq.cut <= budget.cut + 1 && sq.fill <= budget.fill + 1) {
      const pave = [['cobblestone', 4], ['stone_bricks', 3], ['andesite', 2], ['mossy_cobblestone', 1]];
      for (let a = sq.a0; a < sq.a0 + sqLen; a++) for (let k = 0; k < sqDepth; k++) {
        const [x, z] = P(a, sq.b0 + sq.side * k);
        const ring = Math.max(Math.abs(a - (sq.a0 + (sqLen >> 1))), Math.abs(k - (sqDepth >> 1)));
        const u = patchNoise(x, 0, z, deriveSeed(seed, 'square'), 'sq', 2);
        T.setGround(x, z, sq.lvl, ring % 3 === 0 ? 'minecraft:stone_bricks' : 'minecraft:' + pickU(u, pave));
        occupied.add(x + ',' + z); roadSet.set(key3(x, 0, z), sq.lvl);
      }
      // blend the square's edges into the slope
      for (let a = sq.a0 - 2; a < sq.a0 + sqLen + 2; a++) for (let k = -0; k < sqDepth + 2; k++) {
        const [x, z] = P(a, sq.b0 + sq.side * k);
        if (!T.inside(x, z) || occupied.has(x + ',' + z) || roadSet.has(key3(x, 0, z))) continue;
        const d = Math.max(sq.a0 - a, a - (sq.a0 + sqLen - 1), k - (sqDepth - 1), 0), t = Math.min(1, d / 3), o0 = T.orig[T.idx(x, z)];
        T.setGround(x, z, Math.round(sq.lvl + (o0 - sq.lvl) * t));
      }
      const [wx, wz] = P(sq.a0 + (sqLen >> 1), sq.b0 + sq.side * (sqDepth >> 1));
      sqItems.push({ type: 'well', style: 'roof', seed, x: wx, z: wz, q: 0 });
      for (const [da, dk] of [[1, 1], [sqLen - 2, 1], [1, sqDepth - 2], [sqLen - 2, sqDepth - 2]]) {
        const [x, z] = P(sq.a0 + da, sq.b0 + sq.side * dk);
        sqItems.push({ type: 'lamp', style: 'pillar', height: 3, x, z, q: 0 });
      }
      for (const [da, dk] of [[3, sqDepth - 1], [sqLen - 4, sqDepth - 1]]) {
        const [x, z] = P(sq.a0 + da, sq.b0 + sq.side * dk);
        sqItems.push({ type: 'tree', species: 'oak', size: 'm', seed: seed + da, x, z });
      }
      report.push(`集市广场：${sqLen}×${sqDepth}，中心带顶水井，四角石柱灯`);
    } else { sq = null; report.push('集市广场：找不到在改造预算内的平地，未放置'); }
  }

  // ---- ground layer is done: everything from here on is a movable item ----
  const zoneItems = applyZones(T, o.zones || [], { budget, roadSet, occupied, seed, report });
  const ground = cloneTerrain(T), occ0 = new Set(occupied);
  for (const r of o.suppress || []) for (let x = r[0]; x <= r[2]; x++) for (let z = r[1]; z <= r[3]; z++) occupied.add(x + ',' + z);
  const ctx = { budget, roadSet, occupied, placed, strict: true }; T.protect = placed;
  const items = [];
  const add = it => { const r = placeItem(T, it, ctx); if (r.ok) items.push(it); return r; };
  sqItems.forEach(add); zoneItems.forEach(add); keepItems(T, o.keep, ctx, items);

  // ---- 3. plots and houses ----
  let houses = 0, skipped = 0, n = 0;
  const mainPal = o.palette && o.palette !== 'auto' ? o.palette : rng.choice(PALETTE_KEYS);
  const palFor = () => (o.palette && o.palette !== 'auto') || rng.random() < 0.7 ? mainPal : rng.choice(PALETTE_KEYS);
  const pads = [];
  for (const side of [-1, 1]) {
    let a = aMin + 1;
    while (a < aMax - 9) {
      const fw = rng.randint(11, 15);
      if (sq && side === sq.side && a + fw > sq.a0 - 1 && a < sq.a0 + sqLen + 1) { a = sq.a0 + sqLen + 2; continue; }
      if (a + fw > aMax) break;
      const it = planHouse(T, { side, a, fw, cAt, half, P, roadLevel, seed: seed * 1000 + (n++), rng, palette: palFor() });
      const res = it ? add(it) : { ok: false };
      if (res.ok) { houses++; pads.push({ a, fw, side, backFrom: it.backFrom, seed: it.spec.seed }); } else skipped++;
      a += fw + rng.randint(1, 3);
    }
  }
  report.push(`房屋：${houses} 栋` + (skipped ? `；${skipped} 块地超出改造预算，留作绿地` : ''));

  // ---- 4. street lamps, back-garden trees ----
  let lamps = 0;
  for (let a = aMin + 4, side = 1; a < aMax - 2; a += 11, side = -side) {
    for (const s of [side, -side]) {
      const [x, z] = P(a, cAt + s * (Math.floor(half) + 1));
      if (!T.inside(x, z) || occupied.has(x + ',' + z) || roadSet.has(key3(x, 0, z))) continue;
      const ab = n => [...P(a + n, cAt + s * (Math.floor(half) + 1))].join(',');
      if (occupied.has(ab(1)) || occupied.has(ab(-1))) continue;
      const [dx, dz] = P(0, -s);
      add({ type: 'lamp', style: 'arm', height: 3, x, z, q: Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 0 : 2) : (dz > 0 ? 1 : 3) }); lamps++; break;
    }
  }
  let trees = 0;
  for (const p of pads) for (let i = 0; i < 2; i++) {
    if (rng.random() < 0.35) continue;
    const a = p.a + 2 + rng.randint(0, Math.max(0, p.fw - 5)), k = p.backFrom + 2 + rng.randint(0, 2);
    const [x, z] = P(a, cAt + p.side * k);
    if (!T.inside(x, z) || occupied.has(x + ',' + z) || T.water[T.idx(x, z)]) continue;
    let clear = true;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (occupied.has((x + dx) + ',' + (z + dz))) clear = false;
    if (!clear) continue;
    add({ type: 'tree', species: rng.choice(['oak', 'birch', 'oak']), size: rng.choice(['s', 'm']), seed: p.seed + i, x, z }); trees++;
  }
  report.push(`路灯 ${lamps} 盏，后院树 ${trees} 棵`);
  stairShapes(T.S); fixConnections(T.S);
  const e = T.summary(), chk = checkPlacement(T.S, placed);
  report.push(`土方：挖 ${e.cut} 格、填 ${e.fill} 格；最大挖深 ${e.maxCut}、最大填高 ${e.maxFill}（预算 ${budget.cut} / ${budget.fill}）；改动了 ${(e.share * 100).toFixed(1)}% 的地面`);
  report.push(chk.total ? `放置检查：${chk.total} 处问题 ${JSON.stringify(chk.issues)}` : '放置检查：通过');
  items.forEach((it, i) => { it.id = i + 1; if (!it.manual) it.auto = true; });
  return { report, earth: e, check: chk, houses, street: st, square: sq, scene: { ground, occ0, roadSet, budget, items, nextId: items.length + 1 } };
}

// one plot -> a house item (spec, centre, facing); placement decides the pad
function planHouse(T, c) {
  const { side, a, fw, cAt, half, P, roadLevel, seed, rng } = c;
  const set0 = Math.floor(half) + 2;
  const W = fw - 2, D = rng.randint(7, 9), floors = rng.choice([1, 2, 2, 2, 3]);
  const palette = c.palette && c.palette !== 'auto' ? c.palette : rng.choice(PALETTE_KEYS);
  const k0 = set0 + 1, k1 = k0 + D - 1, a0 = a + 1, a1 = a0 + W - 1;
  const fp = [P(a0, cAt + side * k0), P(a1, cAt + side * k1)];
  const spec = solve({ palette, width: W, depth: D, floors, seed, plan: 'rect', annexes: [], ground: false, chimney: rng.random() < 0.6, dormers: 'auto', roof_style: 'gable', jetty: rng.random() < 0.6 })[0];
  spec.width = W; spec.depth = D;
  const [fx, fz] = P(0, -side);                        // direction from the house toward the street
  const q = Math.abs(fx) >= Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz > 0 ? 2 : 0);
  return { type: 'house', spec, q, cx: (fp[0][0] + fp[1][0]) / 2, cz: (fp[0][1] + fp[1][1]) / 2, level: roadLevel(a0 + (W >> 1)), backFrom: k1 + 2 };
}

function cloneTerrain(T) {
  const S = new Structure(); S.blocks = new Map(T.S.blocks); S.box = T.S.box.map(v => v.slice());
  const U = Object.create(Terrain.prototype); Object.assign(U, T);
  U.S = S; U.h = T.h.slice(); U.water = T.water.slice(); U.orig = T.orig;
  return U;
}
const _structCache = new WeakMap();
// an imported structure's blocks (array of [key, state], footprint at y = 0) as a Map, cached
function structBlocks(data) { if (!_structCache.has(data)) _structCache.set(data, new Map(data)); return _structCache.get(data); }
// an empty district on the terrain: no roads, no items — the user places everything
function emptyScene(T, budget) { return { ground: cloneTerrain(T), occ0: new Set(), roadSet: new Map(), budget: budget || { cut: 3, fill: 3 }, items: [], nextId: 1 }; }
const _houseCache = new Map();
function houseBlocks(spec) {
  const k = JSON.stringify(spec);
  if (!_houseCache.has(k)) { if (_houseCache.size > 64) _houseCache.clear(); _houseCache.set(k, buildHouse(spec).blocks); }
  return _houseCache.get(k);
}
// front of a house is local north (-z); after q quarter turns (x, z) -> (-z, x)
const facingOf = q => [[0, -1], [1, 0], [0, 1], [-1, 0]][pmod(q, 4)];

// Place one item onto the terrain. Houses get a level pad (within budget when ctx.strict, best
// effort otherwise), a blended surround and a path to the nearest road in front of the door.
// Returns { ok, box: [[x0,y0,z0],[x1,y1,z1]], over } — `over` = how far past the budget it went.
// 地标 (landmark buildings placed by hand in the layout): they sit on a 台基 — a level platform of the
// footprint plus a 1-cell margin and a 前庭 (forecourt) in front of the entrance. Where the ground
// around the platform is more than a block lower or higher, the edge is a stone retaining wall; the
// front edge is ramped down / up to the surrounding ground instead so the forecourt stays walkable.
const LANDMARK_PLACE = { church: { forecourt: 5, label: '教堂', front: 3 }, cathedral: { forecourt: 8, label: '主教座堂', front: 3 } };   // front: quarter turns from local north to the entrance (the church's west door faces local -x)
const _lmCache = new Map();
function landmarkBlocks(it) {
  const o = { ...it }; for (const k of ['id', 'cx', 'cz', 'q', 'manual', 'lift', 'level', 'road', 'zone', 'district', 'x', 'z']) delete o[k];
  const key = JSON.stringify(o);
  if (!_lmCache.has(key)) { if (_lmCache.size > 16) _lmCache.clear(); _lmCache.set(key, PROPS[it.type].make(o).S.blocks); }
  return _lmCache.get(key);
}
function placeItem(T, it, ctx) {
  const { budget, roadSet, occupied, placed } = ctx;
  const LM = LANDMARK_PLACE[it.type];
  if (it.type !== 'house' && it.type !== 'struct' && !LM) {
    const x = Math.round(it.x), z = Math.round(it.z);
    if (!T.inside(x, z)) return { ok: false };
    if (ctx.strict && T.water[T.idx(x, z)]) return { ok: false };
    const clash = occupied.has(x + ',' + z) || roadSet.has(key3(x, 0, z)) ? 1 : 0;
    const prop = it.type === 'lamp' ? lampPost({ style: it.style, height: it.height || 3, seed: it.seed, wood: it.wood, stone: it.stone, soul: it.soul })
      : it.type === 'well' ? well({ style: it.style || 'roof', seed: it.seed })
      : tree({ species: it.species || 'oak', size: it.size || 'm', seed: it.seed || 1 });
    if (it.type === 'tree' && !roadSet.has(key3(x, 0, z))) T.setGround(x, z, T.H(x, z), 'minecraft:grass_block[snowy=false]');
    const y = T.H(x, z) + 1, blocks = rotQuarter(prop.S.blocks, it.q || 0);
    let b = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    for (const [k, st] of blocks) {
      const [a, yy, c] = unkey(k), kk = key3(x + a, y + yy, z + c);
      if (it.type === 'tree' && T.S.blocks.has(kk) && !isAir(T.S.blocks.get(kk))) continue;
      T.S.blocks.set(kk, st); placed.add(kk);
      b = [[Math.min(b[0][0], x + a), Math.min(b[0][1], y + yy), Math.min(b[0][2], z + c)], [Math.max(b[1][0], x + a), Math.max(b[1][1], y + yy), Math.max(b[1][2], z + c)]];
    }
    occupied.add(x + ',' + z);
    return { ok: true, box: b, clash };
  }
  // ---- house ----
  const blocks = rotQuarter(LM ? landmarkBlocks(it) : it.type === 'struct' ? structBlocks(it.data) : houseBlocks(it.spec), it.q || 0);
  let mx0 = Infinity, mx1 = -Infinity, mz0 = Infinity, mz1 = -Infinity, my1 = 0;
  let ax0 = Infinity, ax1 = -Infinity, az0 = Infinity, az1 = -Infinity;   // all blocks: roof eaves, steps
  for (const k of blocks.keys()) { const [x, y, z] = unkey(k); my1 = Math.max(my1, y); ax0 = Math.min(ax0, x); ax1 = Math.max(ax1, x); az0 = Math.min(az0, z); az1 = Math.max(az1, z); if (y !== 0) continue; mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); mz0 = Math.min(mz0, z); mz1 = Math.max(mz1, z); }
  const ox = Math.round(it.cx - (mx0 + mx1) / 2), oz = Math.round(it.cz - (mz0 + mz1) / 2);
  const X0 = mx0 + ox, X1 = mx1 + ox, Z0 = mz0 + oz, Z1 = mz1 + oz;
  const cells = []; for (let x = X0 - 1; x <= X1 + 1; x++) for (let z = Z0 - 1; z <= Z1 + 1; z++) cells.push([x, z]);
  const [lfx, lfz] = facingOf((it.q || 0) + (LM ? LM.front || 0 : 0)), fore = [];
  if (LM) { const inR = (x, z) => x >= X0 - 1 && x <= X1 + 1 && z >= Z0 - 1 && z <= Z1 + 1, seen = new Set();
    for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) for (let k = 1; k <= LM.forecourt + 1; k++) { const a = x + lfx * k, b = z + lfz * k, q = a + ',' + b; if (!inR(a, b) && !seen.has(q) && T.inside(a, b)) { seen.add(q); fore.push([a, b]); } }
    cells.push(...fore); }
  if (cells.some(([x, z]) => !T.inside(x, z))) return { ok: false, why: 'outside' };
  if (ctx.strict && !(T.inside(ax0 + ox, az0 + oz) && T.inside(ax1 + ox, az1 + oz))) return { ok: false, why: 'outside' };
  if (ctx.strict && cells.some(([x, z]) => occupied.has(x + ',' + z))) return { ok: false, why: 'occupied' };
  if (ctx.strict && cells.some(([x, z]) => roadSet.has(key3(x, 0, z)))) return { ok: false, why: 'road' };
  if (ctx.strict && cells.some(([x, z]) => T.water[T.idx(x, z)])) return { ok: false, why: 'water' };
  // the forecourt may run up to a road (that is the point of it): only the building's own cells clash
  const core = LM ? cells.slice(0, cells.length - fore.length) : cells;
  const clash = core.filter(([x, z]) => occupied.has(x + ',' + z) || roadSet.has(key3(x, 0, z))).length;
  const hs = cells.map(([x, z]) => T.H(x, z)), pref = it.level ?? hs.slice().sort((p, q) => p - q)[hs.length >> 1];
  let best = null;
  for (let p = Math.min(...hs); p <= Math.max(...hs); p++) {
    const cut = Math.max(0, ...hs.map(h => h - p)), fill = Math.max(0, ...hs.map(h => p - h));
    const over = Math.max(0, cut - budget.cut) + Math.max(0, fill - budget.fill);
    if (ctx.strict && over && !LM) continue;
    const score = over * 100 + Math.abs(p - pref) * 2 + cut + fill;
    if (!best || score < best.score) best = { p, score, over };
  }
  if (!best) return { ok: false, why: 'budget' };
  // it.lift: the user raised / lowered the house by hand (layout gizmo, Y axis); the ground under it is
  // filled or dug to match and blended into the surroundings over 3 cells
  const pad = best.p + (it.lift | 0);
  // 门前台阶 (spec.plinth): the house's door step is a stair on its own ground layer (local y=0) and so
  // ends up level with the terrain, half buried. 'raise' lifts the house one block (its ground layer
  // becomes the terrain surface, the step sits on top); 'flat' keeps the height and drops the outside
  // steps. Unset = decided by the house seed, so a street gets a mix of both.
  const plinth = it.type === 'house' ? (it.spec.plinth || ((((it.spec.seed | 0) * 2654435761) >>> 0) % 2 ? 'raise' : 'flat')) : 'flat';
  const up = LM || plinth === 'raise' ? 1 : 0;
  const covered = new Set(); for (const k of blocks.keys()) { const [x, y, z] = unkey(k); if (y >= 1 && y <= 3) covered.add(x + ',' + z); }
  const dropStep = (x, y, z, st) => plinth === 'flat' && it.type === 'house' && y === 0 && /_stairs/.test(st) && !covered.has(x + ',' + z);
  for (const [x, z] of cells) { if (roadSet.has(key3(x, 0, z)) || (LM && occupied.has(x + ',' + z) && !core.some(c => c[0] === x && c[1] === z))) continue; T.setGround(x, z, pad); occupied.add(x + ',' + z); }
  if (LM) {
    // forecourt paving, then retaining walls on the side / back edges of the platform
    const plat = new Set(cells.map(([x, z]) => x + ',' + z)), foreS = new Set(fore.map(([x, z]) => x + ',' + z));
    const pave = (x, z) => 'minecraft:' + pickU(patchNoise(x, 0, z, 77, 'fore', 2), [['cobblestone', 4], ['stone_bricks', 3], ['andesite', 2], ['mossy_cobblestone', 1]]);
    const wallM = (x, y, z) => 'minecraft:' + pickU(patchNoise(x, y, z, 78, 'wall', 2), [['stone_bricks', 5], ['cracked_stone_bricks', 2], ['mossy_stone_bricks', 2]]);
    for (const [x, z] of fore) if (!roadSet.has(key3(x, 0, z))) T.S.set(x, pad, z, pave(x, z));
    let walls = 0;
    for (const [x, z] of cells) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, nz = z + b; if (plat.has(nx + ',' + nz) || !T.inside(nx, nz) || roadSet.has(key3(nx, 0, nz))) continue;
      if (foreS.has(x + ',' + z) && a === lfx && b === lfz) continue;         // the open front of the forecourt: ramped below
      const o = T.H(nx, nz);
      if (o < pad - 1) { for (let y = o + 1; y <= pad; y++) T.S.set(x, y, z, wallM(x, y, z)); walls++; }
      else if (o > pad + 1) { for (let y = pad + 1; y <= o; y++) T.S.set(nx, y, nz, wallM(nx, y, nz)); walls++; }
    }
    if (walls) it._plinth = walls;
  }
  for (let x = X0 - 4 - (LM ? LM.forecourt + 2 : 0); x <= X1 + 4 + (LM ? LM.forecourt + 2 : 0); x++) for (let z = Z0 - 4 - (LM ? LM.forecourt + 2 : 0); z <= Z1 + 4 + (LM ? LM.forecourt + 2 : 0); z++) {
    if (!T.inside(x, z) || occupied.has(x + ',' + z) || roadSet.has(key3(x, 0, z))) continue;
    if (LM) {   // only the ground in front of the forecourt is ramped; the other sides keep their walls
      const ahead = (x - (X0 + X1) / 2) * lfx + (z - (Z0 + Z1) / 2) * lfz, half = lfx ? (X1 - X0) / 2 : (Z1 - Z0) / 2;
      if (ahead <= half + LM.forecourt + 1) continue;
      const d = Math.ceil(ahead - half - LM.forecourt - 1), o0 = T.orig[T.idx(x, z)];
      const side = lfx ? Math.abs(z - (Z0 + Z1) / 2) - (Z1 - Z0) / 2 - 1 : Math.abs(x - (X0 + X1) / 2) - (X1 - X0) / 2 - 1;
      if (side > 0) continue;
      T.setGround(x, z, Math.round(pad + (o0 - pad) * Math.min(1, d / Math.max(3, Math.abs(o0 - pad) + 1))));
      continue;
    }
    const d = Math.max(X0 - 1 - x, x - X1 - 1, Z0 - 1 - z, z - Z1 - 1), o0 = T.orig[T.idx(x, z)];
    T.setGround(x, z, Math.round(pad + (o0 - pad) * Math.min(1, d / 3)));
  }
  const hits = [];
  for (const [k] of blocks) { const [x, y, z] = unkey(k); const st = T.S.get(x + ox, y + pad + up, z + oz); if (isTreePart(st)) hits.push([x + ox, y + pad + up, z + oz]); }
  if (hits.length) T.clearTreesAt(hits);
  let door = null;
  for (const [k, st] of blocks) {
    const [x, y, z] = unkey(k), kk = key3(x + ox, y + pad + up, z + oz);
    if (dropStep(x, y, z, st)) continue;
    T.S.blocks.set(kk, st); placed.add(kk);
    if (/_door\[/.test(st) && st.includes('half=lower')) door = [x + ox, y + pad + up, z + oz];
  }
  // path from the front door to the nearest road: leave the door straight ahead, then the shortest
  // walk (BFS, turns allowed, prefers going straight) to a cell next to a road. Its levels run evenly
  // from the door to the road, one block per cell at most; every one-block rise gets a stair on the
  // lower cell, facing up the path — including the step up from / down to the road itself.
  if (door && !LM) {
    const own = new Set(); for (const k of blocks.keys()) { const [x, , z] = unkey(k); own.add((x + ox) + ',' + (z + oz)); }
    const ddx = door[0] - (X0 + X1) / 2, ddz = door[2] - (Z0 + Z1) / 2;
    const [sx, sz] = Math.abs(ddx) >= Math.abs(ddz) ? [Math.sign(ddx) || 1, 0] : [0, Math.sign(ddz) || 1];
    let x = door[0] + sx, z = door[2] + sz, guard = 0;
    while (own.has(x + ',' + z) && guard++ < 6) { x += sx; z += sz; }
    const start = [x, z], key = (x, z) => x + ',' + z;
    const roadNb = (x, z) => { for (const [a, b] of [[sx, sz], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (roadSet.has(key3(x + a, 0, z + b))) return [x + a, z + b]; return null; };
    let goal = null, prev = new Map([[key(...start), null]]);
    if (roadSet.has(key3(x, 0, z))) goal = 'here';
    else if (T.inside(x, z) && !occupied.has(key(x, z))) {
      const q = [start];
      for (let qi = 0; qi < q.length && qi < 600 && !goal; qi++) {
        const [cx, cz] = q[qi];
        const r = roadNb(cx, cz); if (r) { goal = { at: [cx, cz], road: r }; break; }
        if (Math.abs(cx - start[0]) + Math.abs(cz - start[1]) > 24) continue;
        for (const [a, b] of [[sx, sz], [sz, sx], [-sz, -sx], [-sx, -sz]]) {   // straight ahead first
          const nx = cx + a, nz = cz + b, k = key(nx, nz);
          if (prev.has(k) || !T.inside(nx, nz) || occupied.has(k) || own.has(k) || T.water[T.idx(nx, nz)]) continue;
          prev.set(k, [cx, cz]); q.push([nx, nz]);
        }
      }
    }
    if (goal && goal !== 'here') {
      const run = []; for (let c = goal.at; c; c = prev.get(key(...c))) run.unshift(c);
      const hit = roadSet.get(key3(goal.road[0], 0, goal.road[1])), L = run.length, diff = hit - pad;
      const lv = run.map((_, i) => pad + Math.round(diff * (i + 1) / (L + 1)));
      const roadTop = T.S.get(goal.road[0], hit, goal.road[1]) || '';
      const soft = /dirt|grass|path|gravel/.test(roadTop);
      const top = soft ? 'minecraft:dirt_path' : 'minecraft:cobblestone', stairM = soft ? 'cobblestone_stairs' : 'stone_brick_stairs';
      // the walk is only graded (plain ground, no paving and no stairs): the user found stray stones and
      // stairs in the grass between the house and the street distracting
      run.forEach(([x, z], i) => { T.setGround(x, z, lv[i]); occupied.add(key(x, z)); });
      return { ok: true, box: [[X0, pad, Z0], [X1, pad + up + my1, Z1]], over: best.over, pad, clash };
      const dirTo = (a, b) => b[0] > a[0] ? 'east' : b[0] < a[0] ? 'west' : b[1] > a[1] ? 'south' : 'north';
      const chain = [[[door[0] + 0, door[2] + 0], pad + up, false], ...run.map((c, i) => [c, lv[i], true]), [goal.road, hit, false]];
      for (let i = 0; i + 1 < chain.length; i++) {
        const [A, la, ma] = chain[i], [Bc, lb, mb] = chain[i + 1];
        if (Math.abs(la - lb) !== 1) continue;
        const [low, lowL, mine, high] = la < lb ? [A, la, ma, Bc] : [Bc, lb, mb, A];
        if (!mine) continue;                           // never put a stair on the road or in the doorway
        const kk = key3(low[0], lowL + 1, low[1]);
        T.S.blocks.set(kk, B(stairM, { facing: dirTo(low, high), half: 'bottom', shape: 'straight', waterlogged: false })); placed.add(kk);
      }
    }
  }
  return { ok: true, box: [[X0, pad, Z0], [X1, pad + up + my1, Z1]], over: best.over, pad, clash };
}

// Rebuild the district from its ground layer and item list (after the user moved / turned /
// resized something). Items that no longer fit still get placed, with a warning.
// ---- journaled composition: every item's writes (blocks, ground heights, occupied cells) are
// recorded, so a single item can be taken out and put back without rebuilding the district ----
class JMap extends Map {
  set(k, v) { this._rec(k); return super.set(k, v); }
  delete(k) { this._rec(k); return super.delete(k); }
  _rec(k) { const j = this.j; if (!j) return; if (!j.b.has(k)) j.b.set(k, [super.get(k), this.own.get(k)]); this.own.set(k, j.id); }
  raw(k, v) { if (v === undefined) super.delete(k); else super.set(k, v); }
}
class JSet extends Set {
  add(k) { if (this.j && !this.has(k)) this.j.push(k); return super.add(k); }
}
function journalTerrain(T) {
  const blocks = new JMap(); for (const [k, v] of T.S.blocks) Map.prototype.set.call(blocks, k, v);
  blocks.own = new Map(); blocks.j = null; T.S.blocks = blocks;
  T.hown = new Map(); T.hj = null;
  const sg = T.setGround;
  T.setGround = function (x, z, y, top) {
    if (this.hj && this.inside(x, z)) { const i = this.idx(x, z); if (!this.hj.has(i)) this.hj.set(i, [this.h[i], this.water[i], this.hown.get(i)]); this.hown.set(i, this.hj.id); }
    return sg.call(this, x, z, y, top);
  };
}
function placeJournaled(st, it) {
  const { T, ctx } = st, jb = { id: it.id, b: new Map() }, jh = new Map(); jh.id = it.id;
  const occ = [], pl = [];
  T.S.blocks.j = jb; T.hj = jh; ctx.occupied.j = occ; ctx.placed.j = pl;
  let r;
  try { r = placeItem(T, it, ctx); } finally { T.S.blocks.j = null; T.hj = null; ctx.occupied.j = null; ctx.placed.j = null; }
  st.J.set(it.id, { b: jb.b, h: jh, occ, pl }); st.seq.push(it.id);
  return r;
}
function unplace(st, id) {
  const J = st.J.get(id); if (!J) return [];
  const { T, ctx } = st, bl = T.S.blocks, keys = [];
  for (const [k, [prev, prevOwn]] of J.b) {
    keys.push(k);
    if (bl.own.get(k) !== id) continue;              // something placed later owns it now
    if (isTreePart(prev)) continue;                  // a tree once cleared stays cleared (it may stand where a neighbour now is)
    bl.raw(k, prev); if (prevOwn === undefined) bl.own.delete(k); else bl.own.set(k, prevOwn);
  }
  for (const [i, [h, w, prevOwn]] of J.h) {
    if (T.hown.get(i) !== id) continue;
    T.h[i] = h; T.water[i] = w; if (prevOwn === undefined) T.hown.delete(i); else T.hown.set(i, prevOwn);
  }
  for (const k of J.occ) if (!st.occ0.has(k)) ctx.occupied.delete(k);
  for (const k of J.pl) ctx.placed.delete(k);
  st.J.delete(id); st.boxes.delete(id); st.seq.splice(st.seq.indexOf(id), 1);
  return keys.concat([...J.h.keys()].map(i => { const x = T.x0 + Math.floor(i / T.L), z = T.z0 + i % T.L; return key3(x, 0, z); }));
}
function noteResult(st, it, r, warn, clashes) {
  if (!r.ok) { warn.push(`#${it.id} 超出地形范围，没有放置`); return; }
  st.boxes.set(it.id, r.box);
  if (r.over) warn.push(`#${it.id} ${LANDMARK_PLACE[it.type] ? LANDMARK_PLACE[it.type].label + '台基' : '房屋地基'}超出改造预算 ${r.over} 格`);
  if (r.clash) { clashes.push(it.id); if (it.type === 'house' || it.type === 'struct' || LANDMARK_PLACE[it.type]) warn.push(`#${it.id} 和别的东西重叠了 ${r.clash} 格`); }
}

// Rebuild the district from its ground layer and item list. Keeps the journals so that
// retouchTown() can later redo just the items that changed.
function composeTown(scene) {
  const T = cloneTerrain(scene.ground); journalTerrain(T);
  const placed = new JSet(), occupied = new JSet(scene.occ0);
  const ctx = { budget: scene.budget, roadSet: scene.roadSet, occupied, placed, strict: false }; T.protect = placed;
  const st = { T, ctx, J: new Map(), boxes: new Map(), occ0: scene.occ0, seq: [] };
  const warn = [], clashes = [];
  const rank = t => LANDMARK_PLACE[t] ? -1 : t === 'house' || t === 'struct' ? 0 : t === 'well' ? 1 : t === 'lamp' ? 2 : 3;
  const order = [...scene.items].sort((a, b) => rank(a.type) - rank(b.type));
  for (const it of order) noteResult(st, it, placeJournaled(st, it), warn, clashes);
  stairShapes(T.S); fixConnections(T.S);
  return { T, boxes: st.boxes, warn, clashes, placed, state: st, earth: T.summary(), check: checkPlacement(T.S, placed) };
}
// Take the given items out and put them back (moved / turned / resized / deleted / new). Only
// their own blocks change; returns the rectangle of columns that changed, for the viewer.
function retouchTown(state, scene, ids) {
  const st = state, T = st.T, touched = [];
  for (const id of ids) touched.push(...unplace(st, id));
  const warn = [], clashes = [], newPlaced = [];
  for (const id of ids) {
    const it = scene.items.find(i => i.id === id); if (!it) continue;
    noteResult(st, it, placeJournaled(st, it), warn, clashes);
    const J = st.J.get(id); if (J) { touched.push(...J.b.keys()); newPlaced.push(...J.pl); for (const i of J.h.keys()) touched.push(key3(T.x0 + Math.floor(i / T.L), 0, T.z0 + i % T.L)); }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, maxY = -Infinity;
  for (const k of touched) { const [x, y, z] = unkey(k); if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (y > maxY) maxY = y; }
  stairShapes(T.S); fixConnections(T.S);
  const rect = x0 <= x1 ? [x0 - 1, z0 - 1, x1 + 1, z1 + 1] : null;
  return { T, boxes: st.boxes, warn, clashes, rect, maxY, earth: T.summary(), check: checkPlacement(T.S, new Set(newPlaced)) };
}
const along0 = (P, x, z) => { const t = P(1, 0); return t[0] ? x : z; };

// ---------------------------------------------------------------------------------------------
// District from roads the user drew: every road is laid first (graded, bridges, walls), then
// both sides are cut into plots and filled with houses that face the road — turned to follow it,
// including the diagonal angles the house builder supports. Lamps along the roads, trees in the
// back gardens. Everything after the roads is a movable item, like the automatic layout.
// ---------------------------------------------------------------------------------------------
function townRoads(T, o) {
  const seed = o.seed || 1, rng = new PyRandom(deriveSeed(seed, 'town-roads'));
  const budget = { cut: o.budget?.cut ?? 3, fill: o.budget?.fill ?? 3 };
  const report = [], placed = new Set(), occupied = new Set(), roadSet = new Map(), roads = [];
  // wider / paved roads first, so their surface runs straight through a junction (the narrower road
  // stops at its edge); roads keep their own index k for numbering and item ownership
  const PRI = { main: 5, brick: 4, cobble: 3, gravel: 2, plank: 1, lane: 0 };
  const order = o.roads.map((rd, k) => k).sort((a, b) => {
    const A = o.roads[a], Bq = o.roads[b], wa = A.width || ROAD_KINDS[A.kind || 'main'].width, wb = Bq.width || ROAD_KINDS[Bq.kind || 'main'].width;
    return (wb - wa) || ((PRI[Bq.kind || 'main'] || 0) - (PRI[A.kind || 'main'] || 0)) || (a - b);
  });
  const foot = [];
  for (const k of order) {
    const rd = o.roads[k];
    const r = street(T, { path: rd.path, kind: rd.kind || 'main', width: rd.width || ROAD_KINDS[rd.kind || 'main'].width, seed: seed + k * 31, lamps: false, roadSet, occupied, placed, runs: rd.runs, fill: rd.fill, cut: rd.cut, curve: rd.curve, radius: rd.radius, bridge: rd.bridge, viaduct_style: rd.viaduct_style, bridge_wood: rd.bridge_wood, crossing: rd.crossing });
    roads[k] = { ...r, rd }; foot[k] = new Set(r.road.map(([x, z]) => x + ',' + z));
    report.push(`道路 ${k + 1}：${r.kind} 长 ${r.length} 格、宽 ${r.width} 格，高差 ${r.rise} 格` + (r.bridge.spans ? `，${r.bridge.style} ${r.bridge.spans} 座` : '') + (r.viaduct ? `，${r.bridge.viaductStyle}式高架 ${r.viaduct} 格` : '') + (r.warnings.length ? '；⚠ ' + r.warnings.join('；') : ''));
  }
  roundJunctions(T, o.roads, foot, roadSet, occupied, report, order);
  raiseKerbs(T, o.roads, foot, roadSet, report);
  const zoneItems = applyZones(T, o.zones || [], { budget, roadSet, occupied, seed, report });
  zoneItems.forEach(it => { it.zone = true; });
  // o.region = [x0, z0, x1, z1]: generate automatic items only inside it (the area around roads that
  // changed); o.fixed = the previous automatic items outside it, put back exactly as they were
  const R0 = o.region || null, inR0 = (x, z) => !R0 || (x >= R0[0] && x <= R0[2] && z >= R0[1] && z <= R0[3]);
  // roads of an automatic layout (rd.district) keep their houses, lamps and trees inside that selection
  const areas = new Map(); for (const zn of o.zones || []) if (zn.kind === 'district' && zn.id != null) areas.set(zn.id, zoneMask(zn));
  let curArea = null; const inR = (x, z) => inR0(x, z) && (!curArea || curArea.has(Math.round(x), Math.round(z)));
  const ground = cloneTerrain(T), occ0 = new Set(occupied);
  for (const r of o.suppress || []) for (let x = r[0]; x <= r[2]; x++) for (let z = r[1]; z <= r[3]; z++) occupied.add(x + ',' + z);
  const ctx = { budget, roadSet, occupied, placed, strict: true }, items = []; T.protect = placed;
  const add = it => { const r = placeItem(T, it, ctx); if (r.ok) items.push(it); return r; };
  zoneItems.forEach(add);
  // previous items of the roads that did not change: put back, but strictly — one the new route now runs over is dropped
  let dropped = 0;
  for (const it of o.fixed || []) { const st = ctx.strict; ctx.strict = true; const r = placeItem(T, it, ctx); ctx.strict = st; if (r.ok) items.push(it); else dropped++; }
  keepItems(T, o.keep, ctx, items);
  const only = o.onlyRoads ? new Set(o.onlyRoads) : null;   // generate automatic items only along these roads
  const mainPal = o.palette && o.palette !== 'auto' ? o.palette : rng.choice(PALETTE_KEYS);
  const palFor = () => (o.palette && o.palette !== 'auto') || rng.random() < 0.7 ? mainPal : rng.choice(PALETTE_KEYS);
  // allowed facings: quarter turns x the builder's slanted angles (only if the user allows slanting)
  const angs = o.slant === false ? [0] : SUPPORTED;
  const yaws = []; for (let q = 0; q < 4; q++) for (const a of angs) yaws.push({ y: ((q * 90 + a) % 360 + 360) % 360, q, a });
  const nearestYaw = want => { let b = yaws[0], bd = 999; for (const c of yaws) { const d = Math.abs(((c.y - want) % 360 + 540) % 360 - 180) + (c.a ? 2 : 0); if (d < bd) { bd = d; b = c; } } return b; };
  let houses = 0, n = 0, lamps = 0, trees = 0;
  const backs = [];
  // rd.floors: storeys to pick from; rd.core = [x, z, r]: taller houses near the centre, lower at the edge
  const floorsOf = (rd, x, z) => { let f = rng.choice(rd.floors || [1, 2, 2, 2, 3]); if (rd.core) { const t = Math.hypot(x - rd.core[0], z - rd.core[1]) / Math.max(1, rd.core[2]); if (t < 0.35) f = Math.min(3, f + 1); else if (t > 0.75) f = Math.max(1, f - 1); } return f; };
  for (const [rk, R] of roads.entries()) {
    const cells = R.cells, lv = R.levels, half = (R.width - 1) / 2, N = cells.length;
    if (N < 12 || (only && !only.has(rk))) continue;
    curArea = R.rd.district != null ? areas.get(R.rd.district) || null : null;
    const dist = [0]; for (let i = 1; i < N; i++) dist.push(dist[i - 1] + Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]));
    const at = d => { let i = 0; while (i < N - 1 && dist[i] < d) i++; return i; };
    const frame = i => { const a = cells[Math.max(0, i - 4)], b = cells[Math.min(N - 1, i + 4)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return { t: [dx / l, dz / l], n: [-dz / l, dx / l] }; };
    const L = dist[N - 1];
    if (R.rd.houses !== false) for (const side of [-1, 1]) {
      let s = 3;
      while (s < L - 8) {
        const fw = R.rd.plot ? rng.randint(R.rd.plot[0], R.rd.plot[1]) : rng.randint(11, 15), W = fw - 2, D = R.rd.depth ? rng.randint(R.rd.depth[0], R.rd.depth[1]) : rng.randint(7, 9), i = at(s + fw / 2), { n: nn } = frame(i);
        const setback = half + 2 + D / 2 + 0.5, cx = cells[i][0] + nn[0] * side * setback, cz = cells[i][1] + nn[1] * side * setback;
        if (!inR(cx, cz)) { s += fw + 1; continue; }        // outside the area being redone: keep what is there
        const fx = -nn[0] * side, fz = -nn[1] * side, Y = nearestYaw(Math.atan2(fx, -fz) * 180 / Math.PI);
        const sp = solve({ palette: palFor(), width: W, depth: D, floors: floorsOf(R.rd, cx, cz), seed: seed * 1000 + (n++), plan: 'rect', annexes: [], ground: false, chimney: rng.random() < 0.6, dormers: 'auto', roof_style: 'gable', jetty: rng.random() < 0.6, rotation: Y.a })[0];
        if (!Y.a) { sp.width = W; sp.depth = D; }
        // push the house back from the road until its footprint (steps, jetty and all) clears it
        let it, rr;
        for (let push = 0; push <= 6; push++) {
          it = { type: 'house', spec: sp, q: Y.q, cx: cx + nn[0] * side * push, cz: cz + nn[1] * side * push, level: lv[i], road: rk };
          if (!inR(it.cx, it.cz)) { rr = { ok: false, why: 'area' }; break; }
          rr = add(it); if (rr.why !== 'road') break;
        } (ctx.why = ctx.why || {})[rr.why || 'ok'] = (ctx.why[rr.why || 'ok'] || 0) + 1;
        if (rr.ok) { houses++; backs.push({ x: it.cx + nn[0] * side * (D / 2 + 5), z: it.cz + nn[1] * side * (D / 2 + 5), seed: sp.seed, t: frame(i).t, W, road: rk }); s += fw + (R.rd.gap ? rng.randint(R.rd.gap[0], R.rd.gap[1]) : rng.randint(1, 3)); }
        else s += 3;
      }
    }
    // lamps: every ~12 blocks, alternating sides, right at the road edge
    const lsp = Math.max(6, R.rd.lampSpacing || 12);
    if (R.rd.lamps !== false) for (let d = Math.round(lsp / 2), side = 1; d < L - 2; d += lsp, side = -side) {
      const i = at(d), { n: nn } = frame(i);
      for (const sd of [side, -side]) {
        const x = Math.round(cells[i][0] + nn[0] * sd * (half + 1)), z = Math.round(cells[i][1] + nn[1] * sd * (half + 1));
        if (!inR(x, z)) break;
        if (!T.inside(x, z) || occupied.has(x + ',' + z) || roadSet.has(key3(x, 0, z)) || T.water[T.idx(x, z)] || Math.abs(T.H(x, z) - lv[i]) > 2) continue;
        const fx = -nn[0] * sd, fz = -nn[1] * sd;
        add({ type: 'lamp', road: rk, style: R.rd.lamp || 'arm', height: 3, x, z, q: Math.abs(fx) >= Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3) }); lamps++; break;
      }
    }
  }
  for (const b of backs) for (let k = 0; k < 2; k++) {
    curArea = roads[b.road] && roads[b.road].rd.district != null ? areas.get(roads[b.road].rd.district) || null : null;
    if (rng.random() < 0.35) continue;
    const off = (rng.random() - 0.5) * (b.W - 3), x = Math.round(b.x + b.t[0] * off), z = Math.round(b.z + b.t[1] * off);
    if (!inR(x, z)) continue;
    if (!T.inside(x, z) || T.water[T.idx(x, z)] || roadSet.has(key3(x, 0, z))) continue;
    let clear = true; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (occupied.has((x + dx) + ',' + (z + dz))) clear = false;
    if (!clear) continue;
    add({ type: 'tree', road: b.road, species: rng.choice(['oak', 'birch', 'oak']), size: rng.choice(['s', 'm']), seed: b.seed + k, x, z }); trees++;
  }
  if (o.debug) console.log(ctx.why);
  if (o.fixed) report.push(`局部重算：只重排道路 ${o.onlyRoads.map(k => k + 1).join('、')} 两侧，其他道路的 ${o.fixed.length - dropped} 个组件保持不变` + (dropped ? `（${dropped} 个和新路线重叠，已移除）` : ''));
  report.push(`房屋：${houses} 栋${o.fixed ? '新建' : ''}（朝向跟随道路）`, `路灯 ${lamps} 盏，后院树 ${trees} 棵`);
  stairShapes(T.S); fixConnections(T.S);
  const e = T.summary(), chk = checkPlacement(T.S, placed);
  report.push(`土方：挖 ${e.cut} 格、填 ${e.fill} 格；最大挖深 ${e.maxCut}、最大填高 ${e.maxFill}（预算 ${budget.cut} / ${budget.fill}）`);
  report.push(chk.total ? `放置检查：${chk.total} 处问题 ${JSON.stringify(chk.issues)}` : '放置检查：通过');
  items.forEach((it, i) => { it.id = i + 1; if (!it.manual) it.auto = true; });
  return { report, earth: e, check: chk, houses, scene: { ground, occ0, roadSet, budget, items, nextId: items.length + 1 } };
}

// Things the user placed or changed by hand survive a regeneration: they go in first (wherever
// they are, no budget check), so the automatic houses and props plan around them.
// Junctions (路口): where two roads meet, the concave corners between them are paved as arcs of radius
// r (the larger of the two roads' cornerRadius; 0 = square corners). Done as a closing of the paved area
// around each junction: cells within r of the road surface, whose whole r-disc stays within that band,
// are part of the rounded shape. A narrow branch meeting a wide road flares out the same way.
function roundJunctions(T, roads, foot, roadSet, occupied, report, order = null) {
  const K = roads.map((rd, k) => k).filter(k => foot[k]);
  const pts = [];
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
    const a = foot[K[i]], b = foot[K[j]], small = a.size < b.size ? a : b, big = small === a ? b : a;
    const r = Math.max(roads[K[i]].cornerRadius ?? 3, roads[K[j]].cornerRadius ?? 3);
    if (r <= 0) continue;
    for (const c of small) { const [x, z] = c.split(',').map(Number); if (big.has(c) || big.has((x + 1) + ',' + z) || big.has((x - 1) + ',' + z) || big.has(x + ',' + (z + 1)) || big.has(x + ',' + (z - 1))) pts.push([x, z, r, K[i], K[j]]); }
  }
  if (!pts.length) return 0;
  // cluster junction cells (cells within 8 of each other belong to the same junction)
  const groups = [];
  for (const p of pts) { let g = groups.find(g => Math.abs(g.cx - p[0]) <= 8 && Math.abs(g.cz - p[1]) <= 8); if (!g) groups.push(g = { cx: p[0], cz: p[1], x0: p[0], x1: p[0], z0: p[1], z1: p[1], r: p[2], roads: new Set() }); g.roads.add(p[3]); g.roads.add(p[4]); g.x0 = Math.min(g.x0, p[0]); g.x1 = Math.max(g.x1, p[0]); g.z0 = Math.min(g.z0, p[1]); g.z1 = Math.max(g.z1, p[1]); g.r = Math.max(g.r, p[2]); }
  const isRoad = (x, z) => roadSet.has(key3(x, 0, z));
  let filled = 0;
  for (const g of groups) {
    const r = g.r, R = Math.ceil(r), pad = R * 2 + 4, x0 = g.x0 - pad, x1 = g.x1 + pad, z0 = g.z0 - pad, z1 = g.z1 + pad;
    const near = (x, z, rad) => { for (let a = -Math.ceil(rad); a <= Math.ceil(rad); a++) for (let b = -Math.ceil(rad); b <= Math.ceil(rad); b++) if (a * a + b * b <= rad * rad + 0.01 && isRoad(x + a, z + b)) return true; return false; };
    const dil = new Set();
    for (let x = x0 - R; x <= x1 + R; x++) for (let z = z0 - R; z <= z1 + R; z++) if (near(x, z, r)) dil.add(x + ',' + z);
    // paving for the corners: the junction's most common road surface (not the kerb at its edge)
    const tally = new Map();
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (isRoad(x, z)) { const t = T.S.get(x, roadSet.get(key3(x, 0, z)), z); if (t && !/_slab|_stairs|_wall|fence|lantern/.test(t)) tally.set(t, (tally.get(t) || 0) + 1); }
    const pave = [...tally].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const add = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (isRoad(x, z) || !dil.has(x + ',' + z) || !T.inside(x, z) || T.water[T.idx(x, z)] || occupied.has(x + ',' + z)) continue;
      let inside = true;
      for (let a = -R; a <= R && inside; a++) for (let b = -R; b <= R; b++) if (a * a + b * b <= r * r + 0.01 && !dil.has((x + a) + ',' + (z + b))) { inside = false; break; }
      if (!inside) continue;
      // nearest road cell gives level and paving
      let best = null, bd = 1e9;
      for (let a = -R - 1; a <= R + 1; a++) for (let b = -R - 1; b <= R + 1; b++) { if (!isRoad(x + a, z + b)) continue; const d = a * a + b * b; if (d < bd) { bd = d; best = [x + a, z + b]; } }
      if (!best) continue;
      const lv = roadSet.get(key3(best[0], 0, best[1]));
      if (Math.abs(lv - T.H(x, z)) > 4) continue;                    // not next to a bridge deck / high viaduct
      add.push([x, z, lv, pave.length ? pave[(x * 7 + z * 13 & 0xff) % Math.min(2, pave.length)] : 'minecraft:cobblestone']);
    }
    for (const [x, z, lv, top] of add) { T.setGround(x, z, lv, /_slab|_stairs|_wall|fence|lantern/.test(top) ? 'minecraft:cobblestone' : top); roadSet.set(key3(x, 0, z), lv); filled++; }
    redoEdges(T, roads, foot, roadSet, g, R, order, add);
  }
  if (filled) report.push(`路口：${groups.length} 处，转角铺成圆弧共 ${filled} 格`);
  return filled;
}
// Edged roads (kerb + drain: 规整石板主街; kerb: 砖铺街道) at a junction: each road laid its own kerbs,
// so one road's kerb runs across the other's surface and the rounded corners have none. Redo the
// edges over the whole junction: the leading road (laid first) gets kerb on the outline of the joined
// surface — round the arcs too — and drains one cell in; kerb / drain cells that ended up inside the
// junction become ordinary paving of the road they belong to.
function redoEdges(T, roads, foot, roadSet, g, R, order, fillets) {
  const parts = [...g.roads], lead = order ? order.find(k => g.roads.has(k)) : parts[0];
  const KL = ROAD_KINDS[roads[lead].kind || 'main'] || {}, edged = k => { const P = (ROAD_KINDS[roads[k].kind || 'main'] || {}).pattern; return P === 'setts' || P === 'herring'; };
  const pad = R + 6, x0 = g.x0 - pad, x1 = g.x1 + pad, z0 = g.z0 - pad, z1 = g.z1 + pad;
  const isRoad = (x, z) => roadSet.has(key3(x, 0, z)), fillet = new Set(fillets.map(([x, z]) => x + ',' + z));
  // ring: 1 = on the outline of the joined surface, 2 = one cell in, 3 = further in
  const ring = (x, z) => { for (let d = 1; d <= 2; d++) for (let a = -d; a <= d; a++) for (let b = -d; b <= d; b++) if (Math.max(Math.abs(a), Math.abs(b)) === d && !isRoad(x + a, z + b)) return d; return 3; };
  const edgeMats = new Set(); for (const k of parts) { const Kk = ROAD_KINDS[roads[k].kind || 'main'] || {}; if (Kk.kerb) edgeMats.add('minecraft:' + Kk.kerb); if (Kk.drain) edgeMats.add('minecraft:' + Kk.drain); }
  const bodyOf = (k, x, z) => { const Kk = ROAD_KINDS[roads[k].kind || 'main'] || {}; if (Kk.pattern === 'setts') return 'minecraft:' + Kk.body; if (Kk.pattern === 'herring') return 'minecraft:' + ((Math.floor((x + 2 * z) / 2) & 1) ? Kk.a : Kk.b); return null; };
  const wLead = roads[lead].width || KL.width || 5;
  let n = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (!isRoad(x, z)) continue;
    const key = x + ',' + z, lv = roadSet.get(key3(x, 0, z)), cur = T.S.get(x, lv, z);
    if (!cur || /_slab|_stairs|_wall|fence|lantern|_log|_planks/.test(cur)) continue;     // steps, bridges: leave
    const owner = foot[lead] && foot[lead].has(key) || fillet.has(key) ? lead : parts.find(k => foot[k] && foot[k].has(key));
    if (owner === undefined) continue;
    const rg = ring(x, z);
    let want = null;
    if (owner === lead && edged(lead)) {
      if (rg === 1) want = 'minecraft:' + KL.kerb;
      else if (rg === 2 && KL.drain && wLead >= 5) want = 'minecraft:' + KL.drain;
      else if (edgeMats.has(cur) || fillet.has(key)) want = bodyOf(lead, x, z);
    } else if (rg >= 2 && edgeMats.has(cur)) want = bodyOf(owner, x, z) || bodyOf(lead, x, z);   // a kerb now inside the junction
    // 过渡: a side road of another kind blends into the leading road over its last 3 cells
    if (owner !== lead && want === null) {
      const Ko = ROAD_KINDS[roads[owner].kind || 'main'] || {};
      if ((roads[owner].kind || 'main') !== (roads[lead].kind || 'main') && Ko.pattern !== 'plank' && KL.pattern !== 'plank') {
        let dist = 9; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const c = (x + a) + ',' + (z + b); if (foot[lead] && foot[lead].has(c) || fillet.has(c)) dist = Math.min(dist, Math.max(Math.abs(a), Math.abs(b))); }
        const hh = (((x * 73856093) ^ (z * 19349663)) >>> 0) % 1000 / 1000;
        if (dist <= 3 && hh < [0, 0.8, 0.5, 0.22][dist]) {
          const leadBody = bodyOf(lead, x, z) || (KL.centre ? 'minecraft:' + KL.centre[0][0] : null);
          want = hh < [0, 0.8, 0.5, 0.22][dist] / 2 && leadBody ? leadBody : 'minecraft:cobblestone';
        }
      }
    }
    if (want && want !== cur) { T.S.set(x, lv, z, want); n++; }
  }
  return n;
}
// 路缘高半格: kerbRaise roads get a bottom slab of the kerb stone on top of each kerb cell that lies on
// the outline of the paved area, so the kerb stands half a block above the carriageway. Junctions stay
// open (their kerb was moved to the joined outline by redoEdges); slopes and bridges are left flat.
function raiseKerbs(T, roads, foot, roadSet, report) {
  let n = 0;
  roads.forEach((rd, k) => {
    if (!rd.kerbRaise || !foot[k]) return;
    const K = ROAD_KINDS[rd.kind || 'main'] || {}; if (!K.kerb) return;
    const kerb = 'minecraft:' + K.kerb, slab = 'minecraft:' + ((K.slabs && K.slabs[K.kerb]) || 'stone_brick_slab') + '[type=bottom]';
    for (const c of foot[k]) {
      const [x, z] = c.split(',').map(Number), lv = roadSet.get(key3(x, 0, z)); if (lv == null) continue;
      if (T.S.get(x, lv, z) !== kerb || T.S.get(x, lv + 1, z)) continue;
      if (roadSet.has(key3(x + 1, 0, z)) && roadSet.has(key3(x - 1, 0, z)) && roadSet.has(key3(x, 0, z + 1)) && roadSet.has(key3(x, 0, z - 1))) continue;
      T.S.set(x, lv + 1, z, slab); n++;
    }
  });
  if (n) report.push(`路缘高出半格：${n} 格`);
}
function keepItems(T, keep, ctx, items) {
  if (!keep || !keep.length) return;
  const strict = ctx.strict; ctx.strict = false;
  for (const it of keep) { const r = placeItem(T, it, ctx); if (r.ok) items.push(it); }
  ctx.strict = strict;
}
// Zones drawn by the user (axis-aligned rectangles): 'plaza' = levelled, paved, with a well,
// corner lamps and two trees; 'reserve' = kept free of anything automatic.
function applyZones(T, zones, c) {
  const out = [];
  zones.forEach((zn, k) => {
    if (zn.kind === 'district') return;                       // the selection of an automatic layout: only limits where its houses go
    if (zn.kind === 'landmark') { if (zn.item) { out.push(JSON.parse(JSON.stringify(zn.item))); c.report.push(`地标：${(LANDMARK_PLACE[zn.item.type] || {}).label || zn.item.type}`); } return; }
    const Mk = zn.shapes && zn.shapes.length ? zoneMask(zn) : null, inZ = (x, z) => !Mk || Mk.has(x, z);
    const x0 = Math.max(T.x0, Math.min(zn.x0, zn.x1)), x1 = Math.min(T.x1, Math.max(zn.x0, zn.x1)), z0 = Math.max(T.z0, Math.min(zn.z0, zn.z1)), z1 = Math.min(T.z1, Math.max(zn.z0, zn.z1));
    if (x1 - x0 < 2 || z1 - z0 < 2) return;
    if (zn.kind === 'reserve') { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (inZ(x, z)) c.occupied.add(x + ',' + z); c.report.push(`保留空地 ${x1 - x0 + 1}×${z1 - z0 + 1}`); return; }
    // plaza level: the median of the ground, pulled toward any road already running through it
    const hs = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (inZ(x, z)) hs.push(c.roadSet.get(key3(x, 0, z)) ?? T.H(x, z));
    hs.sort((a, b) => a - b); const lvl = hs[hs.length >> 1];
    const pave = [['cobblestone', 4], ['stone_bricks', 3], ['andesite', 2], ['mossy_cobblestone', 1]], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!inZ(x, z)) continue;
      const ring = Math.max(Math.abs(Math.round(x - cx)), Math.abs(Math.round(z - cz))), u = patchNoise(x, 0, z, deriveSeed(c.seed + k, 'plaza'), 'pz', 2);
      T.setGround(x, z, lvl, ring % 3 === 0 ? 'minecraft:stone_bricks' : 'minecraft:' + pickU(u, pave));
      c.occupied.add(x + ',' + z); c.roadSet.set(key3(x, 0, z), lvl);
    }
    for (let x = x0 - 3; x <= x1 + 3; x++) for (let z = z0 - 3; z <= z1 + 3; z++) {
      if (!T.inside(x, z) || c.occupied.has(x + ',' + z) || c.roadSet.has(key3(x, 0, z))) continue;
      let d = Math.max(x0 - x, x - x1, z0 - z, z - z1);
      if (Mk) { d = 4; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (Mk.has(x + a, z + b)) d = Math.min(d, Math.max(Math.abs(a), Math.abs(b))); if (d > 3) continue; }
      const o0 = T.orig[T.idx(x, z)];
      T.setGround(x, z, Math.round(lvl + (o0 - lvl) * Math.min(1, d / 3)));
    }
    // roads leaving the plaza: re-grade them so they reach the plaza level smoothly (at most one block
    // per two cells, starting level with the plaza at its edge), half-slab steps on each rise
    const inPlaza = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && inZ(x, z);
    const dist = new Map(), q = [];
    for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) if (!inPlaza(x, z) && c.roadSet.has(key3(x, 0, z))) { dist.set(x + ',' + z, 1); q.push([x, z]); }
    for (let i = 0; i < q.length; i++) {
      const [x, z] = q[i], d = dist.get(x + ',' + z); if (d >= 10) continue;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + a) + ',' + (z + b); if (!dist.has(k) && !inPlaza(x + a, z + b) && c.roadSet.has(key3(x + a, 0, z + b))) { dist.set(k, d + 1); q.push([x + a, z + b]); } }
    }
    let regraded = 0;
    for (const [k, d] of dist) {
      const [x, z] = k.split(',').map(Number), cur = c.roadSet.get(key3(x, 0, z)), lim = Math.floor(d / 2);
      const nl = Math.max(lvl - lim, Math.min(lvl + lim, cur));
      if (nl === cur || Math.abs(cur - lvl) > 8) continue;                    // leave bridges / viaducts alone
      const topB = T.S.get(x, cur, z) || 'minecraft:cobblestone';
      for (let y = Math.min(cur, nl) + 1; y <= Math.max(cur, nl) + 1; y++) { const st = T.S.get(x, y, z); if (st && /_slab\[/.test(st)) T.S.del(x, y, z); }
      T.setGround(x, z, nl, topB); c.roadSet.set(key3(x, 0, z), nl); regraded++;
    }
    let slabs = 0;
    for (const [k] of dist) {
      const [x, z] = k.split(',').map(Number), l = c.roadSet.get(key3(x, 0, z));
      const up = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = c.roadSet.get(key3(x + a, 0, z + b)); return n === l + 1; });
      if (!up || T.S.get(x, l + 1, z)) continue;
      const topB = (T.S.get(x, l, z) || '').replace('minecraft:', '').split('[')[0];
      const slab = /cobble|andesite|stone|gravel|dirt/.test(topB) ? (topB.includes('mossy') ? 'mossy_cobblestone_slab' : topB.includes('andesite') ? 'andesite_slab' : 'cobblestone_slab') : 'stone_brick_slab';
      T.S.set(x, l + 1, z, B(slab, { type: 'bottom', waterlogged: false })); slabs++;
    }
    if (regraded) c.report.push(`广场接路：${regraded} 格道路改坡接到广场高度，${slabs} 处半砖台阶`);
    const W = x1 - x0 + 1, L = z1 - z0 + 1;
    if (W >= 7 && L >= 7) out.push({ type: 'well', style: 'roof', seed: c.seed + k, x: Math.round(cx), z: Math.round(cz), q: 0 });
    if (W >= 5 && L >= 5) for (const [x, z] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) if (inZ(x, z)) out.push({ type: 'lamp', style: 'pillar', height: 3, x, z, q: 0 });
    if (W >= 11) for (const x of [x0 + 3, x1 - 3]) out.push({ type: 'tree', species: 'oak', size: 'm', seed: c.seed + x, x, z: z1 });
    c.report.push(`广场 ${W}×${L}（地面高度 ${lvl}）`);
  });
  return out;
}
