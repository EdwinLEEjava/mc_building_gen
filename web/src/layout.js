// ---------------------------------------------------------------------------------------------
// transform.py / layout.py / annex.py
// ---------------------------------------------------------------------------------------------
const TEMPLATES = { 12: [5, 1, '每 5 格一阶'], 15: [4, 1, '每 4 格一阶'], 20: [3, 1, '每 3 格一阶'], 26: [2, 1, '每 2 格一阶'], 33: [3, 2, '2 格、1 格交替'], 45: [1, 1, '每格一阶'] };
const _POS = [...new Set([...Object.keys(TEMPLATES).map(Number), ...Object.keys(TEMPLATES).map(Number).filter(a => a < 45).map(a => 90 - a)])].sort((a, b) => a - b);
const SUPPORTED = [0, ..._POS, ..._POS.map(a => -a)];
function templateFor(angle) {
  if (!angle) return null;
  const mirror = angle < 0, a = Math.abs(angle);
  let p, q, label, quarter, sign;
  if (TEMPLATES[a]) { [p, q, label] = TEMPLATES[a]; quarter = 0; sign = 1; }
  else if (TEMPLATES[90 - a]) { [p, q, label] = TEMPLATES[90 - a]; quarter = 1; sign = -1; }
  else throw new Error(`不支持的角度 ${angle}°，可选：${JSON.stringify(SUPPORTED)}`);
  if (mirror) { quarter = quarter ? 3 : 0; sign = -sign; }
  return [p, q, label, quarter, sign];
}
function stretch(angle) { const t = templateFor(angle); if (!t) return 1.0; return Math.sqrt(1 + Math.pow(t[1] / t[0], 2)); }
function localFootprint(width, depth, angle) {
  const t = templateFor(angle); if (!t) return [width, depth];
  const p = t[0], k = stretch(angle);
  return [Math.max(2 * p, p * pyRound(width / k / p)), Math.max(5, pyRound(depth * k))];
}
const _ROT = { north: 'east', east: 'south', south: 'west', west: 'north' };
const ROT_RE = /^([^\[]+)(?:\[(.*)\])?$/;
function rot90State(state) {
  const m = ROT_RE.exec(state), name = m[1], props = m[2];
  if (!props) return state;
  const out = {};
  for (const pr of props.split(',')) {
    const [k, v] = pr.split('=');
    if (k === 'facing' && v in _ROT) out[k] = _ROT[v];
    else if (k === 'axis' && (v === 'x' || v === 'z')) out[k] = v === 'x' ? 'z' : 'x';
    else if (k in _ROT) out[_ROT[k]] = v;
    else out[k] = v;
  }
  return name + '[' + Object.keys(out).sort().map(k => k + '=' + out[k]).join(',') + ']';
}
function rotQuarter(blocks, q) {   // Map key->state, quarter turns (x, z) -> (-z, x)
  for (let i = 0; i < pmod(q, 4); i++) {
    const nb = new Map();
    for (const [k, st] of blocks) { const [x, y, z] = unkey(k); nb.set(key3(-z, y, x), rot90State(st)); }
    blocks = nb;
  }
  return blocks;
}
function rotate(S, angle) {
  const t = templateFor(angle); if (!t) return S;
  const [p, q, , quarter, sign] = t;
  const src = rotQuarter(S.blocks, quarter);
  const out = new Structure(), r2n = p * q, r2d = p * p + q * q;
  for (const [k, st] of src) {
    const [x, y, z] = unkey(k);
    const x2 = x - sign * fdiv(z * r2n + fdiv(r2d, 2), r2d);
    const z2 = z + sign * fdiv(x2 * q, p);
    out.blocks.set(key3(x2, y, z2), st);
  }
  fixConnections(out);
  return out;
}
const _PARTIAL = ['_stairs', '_slab', '_trapdoor', '_door', '_pane', '_fence', '_wall', 'lantern', 'campfire', 'torch', '_sign', 'flower', 'poppy', 'dandelion', 'cornflower', 'fern', 'grass[', 'short_grass', 'glass_pane', '_carpet', 'chain', 'air'];
const _full = st => st !== undefined && st !== null && !_PARTIAL.some(s => st.includes(s)) && !st.endsWith('short_grass');
function fixConnections(S) {
  for (const [k, st] of [...S.blocks]) {
    const name = st.split('[')[0];
    const pane = name.endsWith('_pane') || name === 'minecraft:iron_bars', fence = name.endsWith('_fence');
    if (!(pane || fence)) continue;
    const [x, y, z] = unkey(k), props = {};
    for (const [d, [dx, dz]] of Object.entries(_STEP)) {
      const nb = S.blocks.get(key3(x + dx, y, z + dz)), nbn = nb ? nb.split('[')[0] : '';
      const same = (pane && (nbn.endsWith('_pane') || nbn === 'minecraft:iron_bars')) || (fence && (nbn.endsWith('_fence') || nbn.endsWith('_fence_gate')));
      props[d] = (same || _full(nb)) ? 'true' : 'false';
    }
    // a pane with fewer than two neighbours to lean on (next to stairs, slabs, air, or in a diagonal wall) would
    // shrink to a bare post: keep the arms the builder wrote into its state, so it stays a full sheet of glass
    if (pane && Object.values(props).filter(v => v === 'true').length < 2) {
      const m = /\[(.*)\]/.exec(st);
      if (m) for (const pr of m[1].split(',')) { const [kk, v] = pr.split('='); if (kk in _STEP && v === 'true') props[kk] = 'true'; }
    }
    props.waterlogged = 'false';
    S.blocks.set(k, name + '[' + Object.keys(props).sort().map(kk => kk + '=' + props[kk]).join(',') + ']');
  }
}

// ---- layout ----
const PLANS = ['rect', 'longhouse', 'L', 'T', 'H', 'cross', 'cross_long'];
const PLAN_LABEL = { rect: '长方形', longhouse: '长屋（一字形 + 牲口棚）', L: 'L 型', T: 'T 型', H: 'H 型', U: 'H 型（只向后凸出）', cross: '十字', cross_long: '十字架（X 型）' };
const RANK = { tower: 3, cross_wing: 2, main: 1, wing: 0, cross: 0, byre: -1, annex: -2 };
const WINGS = ['main', 'wing', 'cross_wing', 'cross'];
const QUARTER = { north: 0, east: 1, south: 2, west: 3 };
class Volume {
  constructor(role, rect, axis, front, over = {}) { this.role = role; this.rect = rect; this.axis = axis; this.front = front; this.over = over; this.rank = RANK[role]; this.kind = role; this.post = null; }
  get localSize() { const [x0, x1, z0, z1] = this.rect; return this.axis === 'x' ? [x1 - x0 + 1, z1 - z0 + 1] : [z1 - z0 + 1, x1 - x0 + 1]; }
  ridgeLine() { const [x0, x1, z0, z1] = this.rect; return this.axis === 'x' ? (z0 + z1) / 2 : (x0 + x1) / 2; }
  contains(x, z, strict = false) { const [x0, x1, z0, z1] = this.rect; return strict ? (x0 < x && x < x1 && z0 < z && z < z1) : (x0 <= x && x <= x1 && z0 <= z && z <= z1); }
}
const parity = (n, ref) => pmod(n, 2) === pmod(ref, 2) ? n : n + 1;
function choosePlan(spec, rng) {
  const W = spec.width;
  const opts = W < 13 ? [['rect', 3], ['L', 3], ['T', 1], ['longhouse', 1]] : [['rect', 2], ['L', 3], ['T', 2], ['longhouse', 1], ['H', 2], ['cross', 1], ['cross_long', 1]];
  let total = 0; for (const [, w] of opts) total += w;
  let r = rng.random() * total;
  for (const [name, w] of opts) { r -= w; if (r < 0) return name; }
  return opts[opts.length - 1][0];
}
function planVolumes(spec, plan, rng) {
  let W = spec.width; const D = spec.depth, F = spec.floors, vols = [];
  const endWing = (right, pf, pb, wd) => { const x0 = right ? W - wd : 0; return new Volume('cross_wing', [x0, x0 + wd - 1, -pf, D - 1 + pb], 'z', right ? 'east' : 'west', { floors: F }); };
  if (plan === 'L') {
    const wd = parity(rng.choice([D, D + 2]), D); W = Math.max(W, wd + 7);
    const pf = rng.randint(3, 6), pb = rng.choice([0, 0, 1, 2]);
    vols.push(endWing(rng.random() < 0.5, pf, pb, wd));
  } else if (plan === 'H' || plan === 'U') {
    const wd = parity(rng.choice([D, D + 2]), D); W = Math.max(W, 2 * wd + 5);
    let pf, pb;
    if (plan === 'U') { pf = 0; pb = rng.randint(4, 7); }
    else { pf = rng.choice([0, 2, 3, 4, 5]); pb = rng.choice([0, 2, 3, 4, 5]); if (Math.max(pf, pb) < 3) pb = rng.randint(3, 5); }
    vols.push(endWing(false, pf, pb, wd), endWing(true, pf, pb, wd));
  } else if (plan === 'T') {
    const wd = parity(Math.max(5, D - rng.choice([2, 4])), D); W = Math.max(W, wd + 8);
    const cx = fdiv(W, 2) + rng.choice([-2, -1, 0, 0, 1, 2]), x0 = cx - fdiv(wd, 2);
    if (rng.random() < 0.7) { const pb = rng.randint(4, 8); vols.push(new Volume('wing', [x0, x0 + wd - 1, 0, D - 1 + pb], 'z', 'east', { floors: Math.max(1, F - rng.choice([0, 1])) })); }
    else { const pf = rng.randint(3, 5); vols.push(new Volume('wing', [x0, x0 + wd - 1, -pf, D - 1], 'z', 'east', { floors: F })); }
  } else if (plan === 'cross') {
    const a = rng.randint(3, 5); W = D + 2 * a;
    vols.push(new Volume('cross', [a, a + D - 1, -a, D - 1 + a], 'z', 'east', { floors: F }));
  } else if (plan === 'cross_long') {
    const a = rng.randint(3, 4), b = rng.randint(2 * a + 1, 3 * a + 1); W = b + D + a;
    if (rng.random() < 0.5) vols.push(new Volume('cross', [b, b + D - 1, -a, D - 1 + a], 'z', 'east', { floors: F }));
    else vols.push(new Volume('cross', [a, a + D - 1, -a, D - 1 + a], 'z', 'east', { floors: F }));
  } else if (plan === 'longhouse') {
    const bl = rng.randint(5, 8), db = parity(Math.max(5, D - rng.choice([0, 2])), D), dz = fdiv(D - db, 2);
    vols.push(new Volume('byre', [W - 1, W - 1 + bl, dz, dz + db - 1], 'x', 'north', { floors: 1, jetty: false, floor_height: F > 1 ? spec.floor_height : Math.max(3, spec.floor_height - 1) }));
  }
  const main = new Volume('main', [0, W - 1, 0, D - 1], 'x', 'north');
  return [W, [main, ...vols]];
}
function buildVolume(vol, spec, idx) {
  const [Wl, Dl] = vol.localSize;
  const seeds = { ...(spec.seeds || {}) };
  if (idx) {
    if (!('windows' in seeds)) seeds.windows = `${spec.seed}:${vol.role}${idx}`;
    if (!('dormers' in seeds)) seeds.dormers = `${spec.seed}:${vol.role}${idx}`;
  }
  const vs = { ...spec, width: Wl, depth: Dl, plan: 'rect', rotation: 0, ground: false, chimney: false, front_door: false, dormers: 0, seeds, ...vol.over };
  if ((vs.floors !== undefined ? vs.floors : 1) < 2) vs.jetty = false;
  const hb = new HouseBuilder(vs);
  const S = hb.build();
  if (vol.post) vol.post(hb, S);
  const q = QUARTER[vol.front];
  const blocks = rotQuarter(S.blocks, q);
  const corners = [...rotQuarter(new Map([[key3(0, 0, 0), 'a'], [key3(Wl - 1, 0, Dl - 1), 'b']]), q).keys()].map(unkey);
  const mx = Math.min(...corners.map(c => c[0])), mz = Math.min(...corners.map(c => c[2]));
  const ox = vol.rect[0] - mx, oz = vol.rect[2] - mz;
  vol.blocks = new Map();
  for (const [k, st] of blocks) { const [x, y, z] = unkey(k); vol.blocks.set(key3(x + ox, y, z + oz), st); }
  vol.hb = hb; vol.wallTop = vs.floors * vs.floor_height;
  let top = -Infinity; for (const k of vol.blocks.keys()) { const y = unkey(k)[1]; if (y > top) top = y; }
  vol.top = top; vol.spec = vs;
  return vol;
}
function crop(lower, higher) {
  if (lower.axis === higher.axis || !WINGS.includes(lower.role) || !WINGS.includes(higher.role)) {
    const nb = new Map(); for (const [k, v] of lower.blocks) { const [x, , z] = unkey(k); if (!higher.contains(x, z, true)) nb.set(k, v); }
    lower.blocks = nb; return;
  }
  const r = higher.ridgeLine(), ax = higher.axis === 'x' ? 2 : 0, along = higher.axis === 'x' ? 0 : 2;
  const [hx0, hx1, hz0, hz1] = higher.rect;
  const [loAl, hiAl] = along === 0 ? [hx0, hx1] : [hz0, hz1];
  let [x0, x1, z0, z1] = lower.rect;
  const [a0, a1] = ax === 2 ? [z0, z1] : [x0, x1], [h0, h1] = ax === 2 ? [hz0, hz1] : [hx0, hx1];
  const before = a0 < h0, after = a1 > h1;
  if (before && after) return;
  const keepLow = before || !after;
  const keep = k => { if (!(loAl - 2 <= k[along] && k[along] <= hiAl + 2)) return true; return keepLow ? k[ax] <= r : k[ax] >= r; };
  const nb = new Map(); for (const [k, v] of lower.blocks) if (keep(unkey(k))) nb.set(k, v);
  lower.blocks = nb;
  [x0, x1, z0, z1] = lower.rect;
  const ri = Math.trunc(r), ceil = -fdiv(-r, 1);
  if (ax === 0) lower.rect = keepLow ? [x0, Math.min(x1, ri), z0, z1] : [Math.max(x0, ceil), x1, z0, z1];
  else lower.rect = keepLow ? [x0, x1, z0, Math.min(z1, ri)] : [x0, x1, Math.max(z0, ceil), z1];
  lower.rect = lower.rect.map(c => Math.trunc(c));
}
const isWindow = st => st.includes('glass');
const isDecor = st => ['_trapdoor', 'lantern'].some(t => st.includes(t));
function overlap(a, b) { const [ax0, ax1, az0, az1] = a.rect, [bx0, bx1, bz0, bz1] = b.rect; return ax0 <= bx1 && bx0 <= ax1 && az0 <= bz1 && bz0 <= az1; }

function buildLayout(spec) {
  let s = { ...DEFAULT_SPEC, ...spec };
  const rng = new PyRandom(deriveSeed(s.seed, 'layout')), arng = new PyRandom(deriveSeed(s.seed, 'annexes'));
  let plan = s.plan !== undefined ? s.plan : 'auto';
  if (plan === 'auto') plan = choosePlan(s, rng);
  const kinds = resolveAnnexes(s, arng);
  const angle = s.rotation || 0;
  if (plan === 'rect' && !kinds.length) return buildHouse({ ...s, plan: 'rect', _direct: true });
  if (angle) { const [w, d] = localFootprint(s.width, s.depth, angle); s = { ...s, width: w, depth: d, flush_walls: true }; }
  let W, vols;
  if (plan === 'rect') { W = s.width; vols = [new Volume('main', [0, s.width - 1, 0, s.depth - 1], 'x', 'north')]; }
  else[W, vols] = planVolumes(s, plan, rng);
  s = { ...s, width: W };
  const placed = planAnnexVolumes(s, kinds, vols, arng);
  const avoid = vols.slice(1).filter(v => v.role !== 'annex').map(v => [v.rect[0] - 2, v.rect[1] + 2]);
  Object.assign(vols[0].over, { dormers: spec.dormers !== undefined ? spec.dormers : DEFAULT_SPEC.dormers, dormer_avoid: avoid });
  vols.forEach((v, i) => buildVolume(v, s, i));
  const main = vols[0];
  const order = sortBy(vols, v => [v.top, v.rank]);
  order.forEach((lo, i) => { for (const hi of order.slice(i + 1)) if (overlap(lo, hi)) crop(lo, hi); });
  const S = new Structure(), origin = new Map();
  for (const v of order) for (const [k, st] of v.blocks) { S.blocks.set(k, st); origin.set(k, v); }
  for (const v of vols) {
    const [x0, x1, z0, z1] = v.rect;
    for (const k of [...S.blocks.keys()]) {
      const [x, y, z] = unkey(k);
      if (1 <= y && y < v.wallTop && x0 < x && x < x1 && z0 < z && z < z1 && origin.get(k) !== v) {
        if (v.blocks.has(k)) { S.blocks.set(k, v.blocks.get(k)); origin.set(k, v); }
        else { S.blocks.delete(k); origin.delete(k); }
      }
    }
  }
  for (const [k, st] of [...S.blocks]) {
    const v = origin.get(k); if (v === undefined) continue;
    const [x, y, z] = unkey(k);
    const others = vols.filter(w => w !== v && w.contains(x, z) && y <= w.top);
    if (isDecor(st) && others.length) {
      const under = order.slice().reverse().find(w => w !== v && w.blocks.has(k));
      if (under !== undefined) { S.blocks.set(k, under.blocks.get(k)); origin.set(k, under); }
      else { S.blocks.delete(k); origin.delete(k); }
      continue;
    }
    if (isWindow(st)) {
      const faced = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const o = origin.get(key3(x + dx, y, z + dz)); return o !== undefined && o !== v && !v.contains(x + dx, z + dz); });
      if (others.length || faced) {
        const slot = y < v.spec.floor_height ? 'infill_ground' : 'infill_upper';
        const e = v.hb.p[slot];
        S.blocks.set(k, !isStr(e) ? 'minecraft:' + pickU(patchNoise(x, y, z, v.hb.seeds.materials, slot, 2), e) : B(e));
      }
    }
  }
  const hb = main.hb;
  const door = placeDoor(S, origin, main, vols);
  if (door) {
    const underJetty = door.dir === 'north' && truthy(main.spec.jetty) && main.spec.floors > 1;
    if (underJetty) S.blocks.set(key3(door.pos[0], main.spec.floor_height - 1, -1), B('lantern', { hanging: true, waterlogged: false }));
    if (kinds.includes('porch') && !underJetty) { addPorch(S, door, main, arng); placed.push('porch'); }
    else if (kinds.includes('hood') && !underJetty) { addHood(S, door, main); placed.push('hood'); }
  }
  if (kinds.includes('oriel') && addOriel(S, main, vols, door, arng)) placed.push('oriel');
  if (s.chimney !== undefined ? truthy(s.chimney) : true) placeChimney(S, main, vols.filter(v => v.role !== 'annex'), rng);
  if (s.ground !== undefined ? truthy(s.ground) : true) placeGround(S, vols, hb, door ? [...door.step, door.dir] : null);
  let out = S;
  out.layout = { plan, width: W, annexes: placed, function: s.function !== undefined ? s.function : 'dwelling', volumes: vols.map(v => [v.kind, v.rect, v.axis, v.spec.floors, v.spec.floor_height]) };
  if (angle) {
    out = rotate(S, angle); sealDoors(out, hb);
    out.layout = { plan, annexes: placed, function: s.function !== undefined ? s.function : 'dwelling' };
  }
  return out;
}
const _NOT_WALL = ['_log', '_door', '_trapdoor', '_stairs', '_slab', 'lantern', 'glass_pane', 'campfire'];
function placeDoor(S, origin, main, vols) {
  const insideAny = (x, z) => vols.some(v => v.contains(x, z, true)), onOrIn = (x, z) => vols.some(v => v.contains(x, z));
  const mx = (main.rect[0] + main.rect[1]) / 2;
  let best = null;
  for (const [k, st] of S.blocks) {
    const [x, y, z] = unkey(k);
    if (y !== 1 || _NOT_WALL.some(t => st.includes(t)) || st.includes('glass')) continue;
    const up = S.blocks.get(key3(x, 2, z)) || '';
    if (!up || _NOT_WALL.some(t => up.includes(t))) continue;
    const v = origin.get(k); if (v === undefined) continue;
    for (const [name, [dx, dz]] of Object.entries(_STEP)) {
      if (!insideAny(x - dx, z - dz) || S.has(x - dx, 1, z - dz)) continue;
      let cx = x + dx, cz = z + dz, ok = false;
      for (let i = 0; i < 2; i++) {
        if (S.has(cx, 1, cz) || S.has(cx, 2, cz)) break;
        if (!onOrIn(cx, cz)) { ok = true; break; }
        cx += dx; cz += dz;
      }
      if (!ok) continue;
      const score = (v === main ? 0 : 2) + (name === 'north' ? 0 : 1) + Math.abs(x - mx) * 0.05;
      if (best === null || score < best[0]) best = [score, x, z, name];
    }
  }
  if (best === null) return null;
  const [, x, z, name] = best, [dx, dz] = _STEP[name], p = main.hb.p;
  S.blocks.set(key3(x, 1, z), B(p.door, { facing: name, half: 'lower', hinge: 'left', open: false, powered: false }));
  S.blocks.set(key3(x, 2, z), B(p.door, { facing: name, half: 'upper', hinge: 'left', open: false, powered: false }));
  let cx = x + dx, cz = z + dz;
  for (let i = 0; i < 3; i++) {
    for (const lat of [-1, 0, 1]) {
      const [lx, lz] = dz ? [cx + lat, cz] : [cx, cz + lat];
      for (const yy of [1, 2, 3]) if ((S.blocks.get(key3(lx, yy, lz)) || '').includes('_trapdoor')) S.blocks.delete(key3(lx, yy, lz));
    }
    if (!S.has(cx, 0, cz)) {
      S.blocks.set(key3(cx, 0, cz), B(main.hb.baseStairs(), { facing: _OPP[name], half: 'bottom', shape: 'straight', waterlogged: false }));
      break;
    }
    cx += dx; cz += dz;
  }
  return { pos: [x, z], dir: name, step: [cx, cz] };
}
function placeChimney(S, main, vols, rng) {
  const D = main.rect[3] + 1, others = vols.filter(v => v !== main);
  const xs = range(main.rect[0] + 2, main.rect[1] - 1).filter(x => !others.some(v => v.rect[0] - 1 <= x && x <= v.rect[1] + 1));
  if (!xs.length) return;
  const x = rng.choice([xs[0], xs[xs.length - 1], xs[fdiv(xs.length, 2)]]), z = fdiv(D, 2) + 1;
  let top = main.wallTop;
  for (const k of S.blocks.keys()) { const [a, b, c] = unkey(k); if (a === x && c === z && b > top) top = b; }
  const p = main.hb.p, seed = main.hb.seeds.materials;
  for (let y = 1; y < top + 3; y++) S.blocks.set(key3(x, y, z), 'minecraft:' + pickU(patchNoise(x, y, z, seed, 'chimney', 1), p.chimney));
  S.blocks.set(key3(x, top + 3, z), B('campfire', { facing: 'north', lit: true, signal_fire: false, waterlogged: false }));
}
function placeGround(S, vols, hb, doorX) {
  const xs = [...vols.map(v => v.rect[0]), ...vols.map(v => v.rect[1])], zs = [...vols.map(v => v.rect[2]), ...vols.map(v => v.rect[3])];
  const pad = 3, p = hb.p, seed = hb.seeds.materials;
  for (let x = Math.min(...xs) - pad; x <= Math.max(...xs) + pad; x++) for (let z = Math.min(...zs) - pad - 1; z <= Math.max(...zs) + pad; z++)
    if (!S.has(x, -1, z)) S.blocks.set(key3(x, -1, z), 'minecraft:' + pickU(patchNoise(x, -1, z, seed, 'ground', 3), p.ground));
  if (doorX !== null) {
    const [cx, cz, name] = doorX, [dx, dz] = _STEP[name];
    for (let i = 1; i < pad + 2; i++) S.blocks.set(key3(cx + dx * i, -1, cz + dz * i), B(p.path));
  }
  const near = (x, z) => vols.some(v => v.rect[0] - 1 <= x && x <= v.rect[1] + 1 && v.rect[2] - 2 <= z && z <= v.rect[3] + 1);
  const plants = ['short_grass', 'short_grass', 'short_grass', 'poppy', 'dandelion', 'cornflower', 'fern'];
  for (const [x, y, z, st] of sortedBlocks(S)) {
    if (y === -1 && st.includes('grass_block') && !near(x, z) && !S.has(x, 0, z))
      if (hb.rngPlants.random() < 0.18) S.blocks.set(key3(x, 0, z), B(hb.rngPlants.choice(plants)));
  }
}

// ---- annexes ----
const FUNCTIONS = {
  dwelling: { hood: 0.45, porch: 0.25, oriel: 0.5, storage: 0.35, woodshed: 0.3, tower: 0.12 },
  smithy: { smithy: 1.0, hood: 0.3, woodshed: 0.4, oriel: 0.2 },
  farm: { stable: 0.75, woodshed: 0.5, storage: 0.4, porch: 0.3 },
  tavern: { porch: 0.7, oriel: 0.6, tower: 0.25, stable: 0.35, storage: 0.3 },
};
const FUNCTION_LABEL = { dwelling: '住宅', smithy: '铁匠铺', farm: '农舍', tavern: '酒馆' };
const ANNEX_LABEL = { storage: '披屋（储物）', woodshed: '柴房', stable: '马厩', smithy: '铁匠铺', tower: '楼梯塔', hood: '门罩', porch: '门廊', oriel: '凸窗' };
const LEAN_TOS = ['smithy', 'stable', 'storage', 'woodshed'];
function resolveAnnexes(spec, rng) {
  const want = spec.annexes !== undefined ? spec.annexes : 'auto';
  if (Array.isArray(want)) return want.slice();
  if (!truthy(want)) return [];
  let func = spec.function !== undefined ? spec.function : 'dwelling';
  if (func === 'auto') func = rng.choice(Object.keys(FUNCTIONS));
  const probs = FUNCTIONS[func];
  if (!probs) throw new Error('未知功能 ' + func);
  const out = Object.entries(probs).filter(([, p]) => rng.random() < p).map(([k]) => k);
  if (out.includes('porch') && out.includes('hood')) out.splice(out.indexOf('hood'), 1);
  return out;
}
function planAnnexVolumes(spec, kinds, vols, rng) {
  const main = vols[0], [x0, x1, z0, z1] = main.rect, D = z1 - z0 + 1, others = vols.slice(1);
  const F = spec.floors, fh = spec.floor_height, mainTop = F * fh;
  const westFree = others.every(v => v.rect[0] > x0 + 1), eastFree = others.every(v => v.rect[1] < x1 - 1);
  const back = range(x0 + 1, x1).filter(x => !others.some(v => v.rect[0] - 1 <= x && x <= v.rect[1] + 1 && v.rect[3] > z1));
  let segs = [], cur = [];
  for (const x of back) { if (cur.length && x !== cur[cur.length - 1] + 1) { segs.push(cur); cur = []; } cur.push(x); }
  if (cur.length) segs.push(cur);
  const placed = [];
  const leanSpec = (kind, Dl) => { const span = Dl + 2, fha = Math.max(3, Math.min(4, mainTop - fdiv(span, 2) - 1)); return { floors: 1, floor_height: fha, jetty: false, roof_style: 'mono', roof_pitch: 'normal', front_door: kind === 'storage', dormers: 0 }; };
  const order = sortBy(kinds.filter(k => LEAN_TOS.includes(k)), k => k === 'smithy' ? 0 : 1);
  const ends = [['west', westFree], ['east', eastFree]].filter(([, f]) => f).map(([e]) => e);
  rng.shuffle(ends);
  for (const kind of order) {
    const d = { smithy: () => rng.choice([4, 5]), stable: () => 4, woodshed: () => 3, storage: () => rng.choice([3, 4]) };
    // Python builds the whole dict literal (evaluating every rng.choice) before indexing it
    const dv = { smithy: d.smithy(), stable: d.stable(), woodshed: d.woodshed(), storage: d.storage() }[kind];
    const Dl = dv + 1;
    const wl = { smithy: 7, stable: rng.choice([7, 9]), woodshed: 5, storage: rng.choice([5, 7]) }[kind];
    const useEnd = ends.length && (kind === 'smithy' || kind === 'stable' || !segs.length);
    let v;
    if (useEnd) {
      const end = ends.shift(), l = Math.min(wl, D - 2);
      if (l < 5) continue;
      const zc = z0 + fdiv(D - l, 2);
      const rect = end === 'west' ? [x0 - dv, x0, zc, zc + l - 1] : [x1, x1 + dv, zc, zc + l - 1];
      v = new Volume('annex', rect, 'z', end, leanSpec(kind, Dl));
    } else {
      segs = sortBy(segs, sg => -sg.length);
      if (!segs.length || segs[0].length < 5) continue;
      const seg = segs.shift();
      let l = Math.min(wl, seg.length);
      if (l % 2 === 0) l -= 1;
      if (l < 5) continue;
      const start = seg[0] + rng.randint(0, seg.length - l);
      const restL = seg.slice(0, start - seg[0]), restR = seg.slice(start - seg[0] + l);
      for (const sg of [restL.slice(0, -1), restR.slice(1)]) if (sg.length >= 5) segs.push(sg);
      v = new Volume('annex', [start, start + l - 1, z1, z1 + dv], 'x', 'south', leanSpec(kind, Dl));
    }
    v.kind = kind; v.post = LOCAL_POST[kind];
    vols.push(v); placed.push(kind);
  }
  if (kinds.includes('tower') && segs.length) {
    segs = sortBy(segs, sg => -sg.length);
    const seg = segs[0];
    if (seg.length >= 7) {
      const cx = seg[fdiv(seg.length, 2)], tw = 5;
      const style = rng.choice(['gable', 'gable', 'magical']);
      const v = new Volume('tower', [cx - fdiv(tw, 2), cx + fdiv(tw, 2), z1 - 1, z1 + 3], 'x', 'south', { floors: F + 1, jetty: false, roof_style: style, roof_pitch: 'steep', front_door: false, dormers: 0 });
      v.kind = 'tower'; vols.push(v); placed.push('tower');
    }
  }
  return placed;
}
function openFront(hb, S) {
  const W = hb.spec.width, fh = hb.spec.floor_height, flush = !!hb.spec.flush_walls;
  for (let x = 1; x < W - 1; x++) for (let y = 1; y < fh; y++) for (const z of (flush ? [0] : [0, 1])) {
    const st = S.get(x, y, z) || '';
    if (z === 0 && st.includes('_log') && !flush) continue;
    S.del(x, y, z);
  }
}
function postSmithy(hb, S) {
  openFront(hb, S);
  const W = hb.spec.width, D = hb.spec.depth, back = D - 2;
  S.set(2, 1, back, B('blast_furnace', { facing: 'north', lit: true }));
  S.set(3, 1, back, B('furnace', { facing: 'north', lit: true }));
  S.set(fdiv(W, 2), 1, 2, B('anvil', { facing: 'east' }));
  S.set(W - 3, 1, back, B('grindstone', { face: 'floor', facing: 'north' }));
  S.set(W - 3, 1, 2, B('cauldron'));
  const cx = 1, cz = back;
  let top = hb.spec.floor_height;
  for (const k of S.blocks.keys()) { const [a, b, c] = unkey(k); if (a === cx && c === cz && b > top) top = b; }
  for (let y = 1; y < top + 3; y++) S.set(cx, y, cz, B(pickU(patchNoise(cx, y, cz, hb.seeds.materials, 'chimney', 1), hb.p.chimney)));
  S.set(cx, top + 3, cz, B('campfire', { facing: 'north', lit: true, signal_fire: false, waterlogged: false }));
}
function postStable(hb, S) {
  openFront(hb, S);
  const W = hb.spec.width, D = hb.spec.depth, wood = hb.woodStairs().slice(0, -7);
  for (let x = 1; x < W - 1; x++) if (!(S.get(x, 1, 0) || '').includes('_log')) S.set(x, 1, 0, B(`${wood}_fence_gate`, { facing: 'north', in_wall: false, open: false, powered: false }));
  for (let z = 2; z < D - 1; z++) S.set(fdiv(W, 2), 1, z, B(`${wood}_fence`, { north: z > 2, south: z < D - 2, east: false, west: false, waterlogged: false }));
  for (const [x, y] of [[1, 1], [1, 2], [2, 1], [W - 2, 1]]) S.set(x, y, D - 2, B('hay_block', { axis: 'y' }));
}
function postWoodshed(hb, S) {
  openFront(hb, S);
  const W = hb.spec.width, D = hb.spec.depth;
  for (let x = 1; x < W - 1; x++) {
    for (let z = Math.max(2, D - 3); z < D - 1; z++) for (const y of [1, 2]) S.set(x, y, z, B('spruce_log', { axis: 'z' }));
    if (x % 2) S.set(x, 3, D - 2, B('spruce_log', { axis: 'z' }));
  }
  S.set(fdiv(W, 2), 1, 1, B('oak_log', { axis: 'y' }));
}
function postStorage(hb, S) {
  const D = hb.spec.depth;
  S.set(1, 1, D - 2, B('barrel', { facing: 'up', open: false }));
  S.set(2, 1, D - 2, B('barrel', { facing: 'up', open: false }));
}
const LOCAL_POST = { smithy: postSmithy, stable: postStable, woodshed: postWoodshed, storage: postStorage };
function outsideCell(door, main) {
  const [x, z] = door.pos, [dx, dz] = _STEP[door.dir];
  let cx = x + dx, cz = z + dz;
  while (main.contains(cx, cz)) { cx += dx; cz += dz; }
  return [cx, cz];
}
const lat = name => (name === 'north' || name === 'south') ? [1, 0] : [0, 1];
function addHood(S, door, main) {
  const name = door.dir, [cx, cz] = outsideCell(door, main), [lx, lz] = lat(name), wood = main.hb.woodStairs(), back = _OPP[name];
  for (const t of [-1, 0, 1]) S.blocks.set(key3(cx + lx * t, 3, cz + lz * t), B(wood, { facing: back, half: 'bottom', shape: 'straight', waterlogged: false }));
  const trap = main.hb.p.trapdoor;
  for (const t of [-1, 1]) if (!S.has(cx + lx * t, 2, cz + lz * t)) S.blocks.set(key3(cx + lx * t, 2, cz + lz * t), B(trap, { facing: name, half: 'top', open: false, powered: false, waterlogged: false }));
}
function addPorch(S, door, main, rng) {
  const name = door.dir, [dx, dz] = _STEP[name], [cx, cz] = outsideCell(door, main), [lx, lz] = lat(name), hb = main.hb;
  const pd = rng.choice([2, 3]), base = Math.max(3, Math.min(4, main.wallTop - 2));
  const mainOf = e => isStr(e) ? e : e.reduce((b, nw) => (b === null || nw[1] > b[1]) ? nw : b, null)[0];
  const stairs = mainOf(hb.p.roof_stairs), full = mainOf(hb.p.roof_full), slab = mainOf(hb.p.roof_slab), seed = hb.seeds.materials;
  const at = (r, t) => [cx + dx * r + lx * t, cz + dz * r + lz * t];
  for (let r = 0; r < pd; r++) for (let t = -2; t <= 2; t++) {
    const [x, z] = at(r, t);
    S.blocks.set(key3(x, 0, z), 'minecraft:' + pickU(patchNoise(x, 0, z, seed, 'base', 2), hb.p.base));
    for (const y of [1, 2, 3]) { const st = S.blocks.get(key3(x, y, z)) || ''; if (st.includes('_trapdoor') || st.includes('lantern')) S.blocks.delete(key3(x, y, z)); }
  }
  let [x, z] = at(pd, 0);
  S.blocks.set(key3(x, 0, z), B(hb.baseStairs(), { facing: _OPP[name], half: 'bottom', shape: 'straight', waterlogged: false }));
  for (const t of [-2, 2]) { [x, z] = at(pd - 1, t); for (let y = 1; y < base; y++) S.blocks.set(key3(x, y, z), hb.log('post', 'y')); }
  for (let r = 0; r <= pd; r++) {
    const cells = [[-2, 0, 's'], [2, 0, 's'], [-1, 1, 's'], [1, 1, 's'], [0, 2, 'slab']];
    if (r < pd) cells.push([-1, 0, 'f'], [1, 0, 'f'], [0, 0, 'f'], [0, 1, 'f']);
    for (const [t, dy, kind] of cells) {
      [x, z] = at(r, t);
      let st;
      if (kind === 's') { const face = lx ? (t < 0 ? 'east' : 'west') : (t < 0 ? 'south' : 'north'); st = B(stairs, { facing: face, half: 'bottom', shape: 'straight', waterlogged: false }); }
      else if (kind === 'slab') st = B(slab, { type: 'bottom', waterlogged: false });
      else if (r === pd - 1 && dy === 0) st = hb.log('beam', lx ? 'x' : 'z');
      else st = B(full);
      S.blocks.set(key3(x, base + dy, z), st);
    }
  }
}
function addOriel(S, main, vols, door, rng) {
  const hb = main.hb, sp = main.spec, F = sp.floors, h = sp.floor_height;
  if (F < 2) return false;
  const k = F - 1, y0 = k * h, j = truthy(sp.jetty) ? k : 0, zo = -j - 1, W0 = main.localSize[0];
  const xs = framePositions(0, W0 - 1, sp.post_spacing), others = vols.filter(v => v !== main);
  let bays = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1], n = b - a - 1;
    if (n < 3 || n > 5 || a < main.rect[0] || b > main.rect[1]) continue;
    if (others.some(v => v.rect[0] - 1 <= b && a <= v.rect[1] + 1 && v.rect[2] <= 0)) continue;
    if (door && door.dir === 'north' && a - 3 <= door.pos[0] && door.pos[0] <= b + 3) continue;
    bays.push([a, b]);
  }
  if (!bays.length) return false;
  const mid = (main.rect[0] + main.rect[1]) / 2;
  bays = sortBy(bays, ab => Math.abs((ab[0] + ab[1]) / 2 - mid));
  const [a, b] = rng.random() < 0.6 ? bays[0] : rng.choice(bays);
  const wood = hb.woodStairs(), glass = hb.windowBlock('x'), seed = hb.seeds.materials;
  for (let y = y0 + 1; y < y0 + h; y++) {
    for (const x of [a, b]) S.blocks.set(key3(x, y, zo), hb.log('post', 'y'));
    for (let x = a + 1; x < b; x++) {
      if (y === y0 + 1) S.blocks.set(key3(x, y, zo), !isStr(hb.p.infill_upper) ? 'minecraft:' + pickU(patchNoise(x, y, zo, seed, 'infill_upper', 2), hb.p.infill_upper) : B(hb.p.infill_upper));
      else S.blocks.set(key3(x, y, zo), glass);
    }
  }
  for (let x = a; x <= b; x++) {
    S.blocks.set(key3(x, y0, zo), hb.log('beam', 'x'));
    S.blocks.set(key3(x, y0 - 1, zo), B(wood, { facing: 'south', half: 'top', shape: 'straight', waterlogged: false }));
    S.blocks.set(key3(x, y0 + h, zo), B(wood, { facing: 'south', half: 'bottom', shape: 'straight', waterlogged: false }));
  }
  return true;
}
