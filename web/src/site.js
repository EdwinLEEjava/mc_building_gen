// ---------------------------------------------------------------------------------------------
// Site generator: a street laid onto the terrain. The centreline is graded to a walkable slope
// (one block up per `run` blocks at most), the ground is cut / filled to it, the edges blend back
// into the natural slope, and lamps / trees are set along the sides.
// ---------------------------------------------------------------------------------------------
// Road types (道路类型). `pattern` decides how a cell is paved from its position:
//   d = distance from the centreline, i = index along the road, u = patch noise in [0,1)
//   setts:  regular quarried blocks in courses, a cross band every 4 rows, drains and kerbs at the sides
//   mix:    weighted random (edge list near the sides) — rounded cobbles, gravel, earth
//   herring: brick in a herringbone-like bond, stone kerbs
//   plank:  boards across the road, log beams along both edges
const ROAD_KINDS = {
  main: { label: '规整石板主街', note: '切割整齐的石块成排铺设，中间每隔几排一道横向石带，两侧排水沟和路缘石', width: 5, run: 3, slab: true, pattern: 'setts', bridge: 'arch',
    body: 'stone_bricks', cracked: 'cracked_stone_bricks', band: 'polished_andesite', drain: 'andesite', kerb: 'smooth_stone',
    slabs: { stone_bricks: 'stone_brick_slab', cracked_stone_bricks: 'stone_brick_slab', polished_andesite: 'polished_andesite_slab', andesite: 'andesite_slab', smooth_stone: 'smooth_stone_slab' } },
  cobble: { label: '卵石街道', note: '圆卵石和碎石成片混铺，边缘杂有苔石和砾石，城镇里的普通街道', width: 5, run: 3, slab: true, pattern: 'mix', bridge: 'stone',
    centre: [['cobblestone', 5], ['andesite', 3], ['stone', 2]], edge: [['cobblestone', 4], ['mossy_cobblestone', 2], ['gravel', 2], ['coarse_dirt', 1]],
    slabs: { cobblestone: 'cobblestone_slab', andesite: 'andesite_slab', stone: 'stone_slab', mossy_cobblestone: 'mossy_cobblestone_slab', gravel: 'cobblestone_slab', coarse_dirt: 'cobblestone_slab' } },
  brick: { label: '砖铺街道', note: '红砖和泥砖人字形铺砌，石砖路缘，富裕街区或广场周边', width: 5, run: 3, slab: true, pattern: 'herring', bridge: 'arch',
    a: 'bricks', b: 'mud_bricks', kerb: 'stone_bricks',
    slabs: { bricks: 'brick_slab', mud_bricks: 'mud_brick_slab', stone_bricks: 'stone_brick_slab' } },
  gravel: { label: '碎石大道', note: '压实的砾石和粗土，中间两道车辙，城外连接村镇的大路', width: 5, run: 3, slab: false, pattern: 'mix', rut: true, bridge: 'mixed',
    centre: [['gravel', 4], ['coarse_dirt', 3], ['dirt_path', 2], ['andesite', 1]], edge: [['coarse_dirt', 3], ['dirt_path', 2], ['grass_block[snowy=false]', 2]] },
  lane: { label: '土路小巷', note: '踩实的土径，中间长草的车辙，房屋之间的小路', width: 3, run: 2, slab: false, pattern: 'mix', rut: true, bridge: 'timber',
    centre: [['dirt_path', 5], ['coarse_dirt', 2], ['gravel', 1]], edge: [['dirt_path', 3], ['coarse_dirt', 3], ['grass_block[snowy=false]', 2]] },
  plank: { label: '木板栈道', note: '横铺木板、两侧原木纵梁，沼泽、河岸和码头边', width: 3, run: 2, slab: true, pattern: 'plank', bridge: 'timber',
    board: 'spruce_planks', beam: 'stripped_spruce_wood', slabs: { spruce_planks: 'spruce_slab' } },
};
// Bridges (桥梁样式): used for river crossings and for viaducts (高架) over deep fills
const BRIDGE_STYLES = {
  stone: { label: '石墩石面桥', note: '石砖桥墩支撑平直桥面，墩旁半砖托肩', pier: 6, rail: 'stone_brick_wall' },
  arch: { label: '石拱桥', note: '桥墩之间是连续的半圆石拱，拱券用倒置楼梯收边', pier: 6, rail: 'stone_brick_wall' },
  timber: { label: '木栈桥', note: '原木排架桥墩、交叉斜撑，木板桥面，栅栏扶手', pier: 4, rail: 'fence' },
  mixed: { label: '石墩木面桥', note: '石砖桥墩、木梁木板桥面、栅栏扶手（中世纪最常见的做法）', pier: 5, rail: 'fence' },
};

// ---- curves (平滑弯道) ------------------------------------------------------------------------
// The picked points are turned into a dense list of float points { x, z, seg } (seg = which leg of the
// original path it belongs to, for per-leg slopes):
//   straight: the polyline itself
//   smooth:   centripetal Catmull-Rom spline through every point (no overshoot, no loops)
//   fillet:   straight legs, each corner replaced by a circular arc of radius r (shrunk if the legs are short)
const ROAD_CURVES = { straight: '折线（直角转弯）', smooth: '平滑曲线', fillet: '直路 + 圆角转弯' };
function curvePoints(path, mode = 'straight', radius = 6) {
  const P = path.map(([x, z]) => [x, z]).filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  const out = [], push = (x, z, seg) => out.push({ x, z, seg });
  const line = (a, b, seg, skipFirst) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4)); for (let i = skipFirst ? 1 : 0; i <= n; i++) push(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, seg); };
  if (P.length < 2) { if (P.length) push(P[0][0], P[0][1], 0); return out; }
  if (mode === 'smooth' && P.length >= 3) {
    const ext = [[2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]], ...P, [2 * P[P.length - 1][0] - P[P.length - 2][0], 2 * P[P.length - 1][1] - P[P.length - 2][1]]];
    for (let s = 0; s + 1 < P.length; s++) {
      const p0 = ext[s], p1 = ext[s + 1], p2 = ext[s + 2], p3 = ext[s + 3];
      const td = (a, b) => Math.pow(Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])), 0.5);
      const t0 = 0, t1 = t0 + td(p0, p1), t2 = t1 + td(p1, p2), t3 = t2 + td(p2, p3);
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4));
      for (let i = s ? 1 : 0; i <= n; i++) {
        const t = t1 + (t2 - t1) * i / n, L = (a, b, ta, tb) => [0, 1].map(k => ((tb - t) * a[k] + (t - ta) * b[k]) / (tb - ta));
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3), C = L(B1, B2, t1, t2);
        push(C[0], C[1], s);
      }
    }
    return out;
  }
  if (mode === 'fillet' && P.length >= 3) {
    let cur = P[0];
    for (let s = 1; s + 1 < P.length; s++) {
      const A = P[s - 1], Bp = P[s], C = P[s + 1];
      const u = [A[0] - Bp[0], A[1] - Bp[1]], v = [C[0] - Bp[0], C[1] - Bp[1]], lu = Math.hypot(...u), lv = Math.hypot(...v);
      const cos = (u[0] * v[0] + u[1] * v[1]) / (lu * lv), th = Math.acos(Math.max(-1, Math.min(1, cos)));
      if (th > Math.PI - 0.02) { line(cur, Bp, s - 1, out.length > 0); cur = Bp; continue; }   // nearly straight
      let r = radius, t = r / Math.tan(th / 2);
      const tmax = Math.min(lu, lv) / 2; if (t > tmax) { t = tmax; r = t * Math.tan(th / 2); }
      const p1 = [Bp[0] + u[0] / lu * t, Bp[1] + u[1] / lu * t], p2 = [Bp[0] + v[0] / lv * t, Bp[1] + v[1] / lv * t];
      line(cur, p1, s - 1, out.length > 0);
      const bis = [u[0] / lu + v[0] / lv, u[1] / lu + v[1] / lv], lb = Math.hypot(...bis), dc = r / Math.sin(th / 2);
      const c = [Bp[0] + bis[0] / lb * dc, Bp[1] + bis[1] / lb * dc];
      let a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]), da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const n = Math.max(2, Math.ceil(Math.abs(da) * r * 4));
      for (let i = 1; i <= n; i++) { const a = a1 + da * i / n; push(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, i < n / 2 ? s - 1 : s); }
      cur = p2;
    }
    line(cur, P[P.length - 1], P.length - 2, out.length > 0);
    return out;
  }
  for (let s = 0; s + 1 < P.length; s++) line(P[s], P[s + 1], s, s > 0);
  return out;
}
// dense float points -> integer centreline cells (8-connected, no repeats) + for each float point its cell
function cellsOfCurve(fine) {
  const out = []; out.seg = []; out.fineCell = [];
  for (const f of fine) {
    const x = Math.round(f.x), z = Math.round(f.z), l = out[out.length - 1];
    if (!l || l[0] !== x || l[1] !== z) {
      // keep the chain 8-connected
      if (l && Math.max(Math.abs(x - l[0]), Math.abs(z - l[1])) > 1) { const n = Math.max(Math.abs(x - l[0]), Math.abs(z - l[1])); for (let i = 1; i < n; i++) { out.push([Math.round(l[0] + (x - l[0]) * i / n), Math.round(l[1] + (z - l[1]) * i / n)]); out.seg.push(f.seg); } }
      out.push([x, z]); out.seg.push(f.seg);
    }
    out.fineCell.push(out.length - 1);
  }
  return out;
}

// polyline -> list of integer cells, densified, no repeats
function traceLine(path) {
  const out = []; out.seg = [];
  for (let s = 0; s + 1 < path.length; s++) {
    const [ax, az] = path[s], [bx, bz] = path[s + 1], n = Math.max(Math.abs(bx - ax), Math.abs(bz - az)) * 2;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(ax + (bx - ax) * i / n), z = Math.round(az + (bz - az) * i / n), l = out[out.length - 1];
      if (!l || l[0] !== x || l[1] !== z) { out.push([x, z]); out.seg.push(s); }
    }
  }
  return out;
}
// graded levels along the centreline: smoothed terrain, then at most one level step per `run` cells
// `run` may be a number or a per-cell array (blocks walked per one-block climb; 1 = stairs)
// Levels along the centreline that move the least earth: dynamic programming over (cell, level,
// cells since the last step). A step of one level is only allowed once `run` cells have passed
// since the previous one, so the slope limit holds everywhere; bridge decks are hard minimums and
// the approaches find their own ramps.
function gradeLine(T, cells, run, win = 1, spans = [], fixed = null) {
  const n = cells.length, R = i => Math.max(1, Array.isArray(run) ? run[Math.min(i, run.length - 1)] || 3 : run);
  const raw = cells.map(([x, z]) => T.inside(x, z) ? T.H(x, z) : null);
  const g0 = raw.map(v => v ?? raw.find(u => u !== null) ?? 0);
  const g = g0.map((_, i) => { let s = 0, k = 0; for (let j = i - win; j <= i + win; j++) if (j >= 0 && j < n) { s += g0[j]; k++; } return s / k; });
  const floor = new Array(n).fill(-Infinity);
  for (const sp of spans) for (let i = sp.a; i <= sp.b; i++) floor[i] = Math.max(floor[i], sp.deck);
  const fx = fixed ? fixed.filter(v => v != null) : [];
  let lo = Math.floor(Math.min(...g, ...fx)) - 2, hi = Math.ceil(Math.max(...g, ...fx, ...floor.filter(isFinite))) + 2;
  const H = hi - lo + 1, C = Math.max(...cells.map((_, i) => R(i))) + 1, S = H * C, INF = 1e18;
  // a cell that is already a road (a junction) must keep that road's level exactly
  const cost = (i, L) => L < floor[i] || (fixed && fixed[i] != null && L !== fixed[i]) ? INF : Math.abs(L - g[i]);
  let cur = new Float64Array(S).fill(INF);
  const back = new Int32Array(n * S).fill(-1);
  for (let h = 0; h < H; h++) cur[h * C + (C - 1)] = cost(0, lo + h);
  for (let i = 1; i < n; i++) {
    const nxt = new Float64Array(S).fill(INF), need = R(i), ci = cost.bind(null, i);
    for (let h = 0; h < H; h++) for (let c = 0; c < C; c++) {
      const v = cur[h * C + c]; if (v >= INF) continue;
      // stay level
      const c2 = Math.min(C - 1, c + 1), k = h * C + c2, w = v + ci(lo + h);
      if (w < nxt[k]) { nxt[k] = w; back[i * S + k] = h * C + c; }
      // one step up / down (tiny penalty so it never steps for nothing)
      if (c + 1 >= need) for (const dh of [-1, 1]) {
        const h2 = h + dh; if (h2 < 0 || h2 >= H) continue;
        const k2 = h2 * C, w2 = v + ci(lo + h2) + 0.05;
        if (w2 < nxt[k2]) { nxt[k2] = w2; back[i * S + k2] = h * C + c; }
      }
    }
    cur = nxt;
  }
  let best = 0; for (let k = 1; k < S; k++) if (cur[k] < cur[best]) best = k;
  if (cur[best] >= INF && fixed) return gradeLine(T, cells, run, win, spans, null);
  const lv = new Array(n);
  for (let i = n - 1; i >= 0; i--) { lv[i] = lo + Math.floor(best / C); if (i) best = back[i * S + best]; }
  return lv;
}
// top of the water column over (x,z), or null if dry
function waterTop(T, x, z) {
  if (!T.inside(x, z) || !T.water[T.idx(x, z)]) return null;
  let y = T.H(x, z) + 1; while (/^minecraft:(water|bubble_column)/.test(T.S.get(x, y + 1, z) || '')) y++;
  return y;
}
// wet stretches of the centreline (any water within the road width), small dry gaps merged
// Only water under the centreline means the road crosses a river; water that merely touches the
// road's edge is a bank (handled with a quay wall). A wet stretch that is long and has water on
// both sides of the road is the route running down the river itself: no bridge, just a warning.
function bridgeSpans(T, cells, half, warn = [], strict = false) {
  const wet = cells.map(([x, z]) => waterTop(T, x, z));
  const spans = []; let cur = null;
  wet.forEach((t, i) => {
    if (t === null) return;
    if (cur && i - cur.b <= 3) { cur.b = i; cur.top = Math.max(cur.top, t); }
    else { cur = { a: i, b: i, top: t }; spans.push(cur); }
  });
  // reach a little onto the banks so the deck lands on dry ground
  for (const sp of spans) { sp.a = Math.max(0, sp.a - 1); sp.b = Math.min(cells.length - 1, sp.b + 1); sp.deck = sp.top + 3; }
  return spans.filter(sp => {
    const len = sp.b - sp.a + 1;
    if (len < 16) return true;
    // across a river the water reaches far along the road's normal; along a river it doesn't
    let along = 0, probes = 0;
    for (let i = sp.a + 2; i <= sp.b - 2; i += 4) {
      const p = cells[Math.max(0, i - 3)], q = cells[Math.min(cells.length - 1, i + 3)], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l, nz = dx / l, [x, z] = cells[i];
      if (waterTop(T, x, z) === null) continue;
      let ext = 1;
      for (const sg of [1, -1]) for (let k = 1; k < 40; k++) { if (waterTop(T, Math.round(x + nx * k * sg), Math.round(z + nz * k * sg)) === null) break; ext++; }
      probes++; if (len > 1.5 * ext) along++;
    }
    if (probes && along / probes >= 0.5) {
      if (!strict) { warn.push(`(${cells[sp.a][0]}, ${cells[sp.a][1]}) 到 (${cells[sp.b][0]}, ${cells[sp.b][1]}) 这段路线顺着水面走了约 ${sp.b - sp.a + 1} 格，建成了长桥`); return true; }
      warn.push(`(${cells[sp.a][0]}, ${cells[sp.a][1]}) 到 (${cells[sp.b][0]}, ${cells[sp.b][1]}) 这段路线顺着河道压在水里（约 ${sp.b - sp.a + 1} 格），没有架桥，改成了临水石堤；建议把这段路线移到岸上或改为横穿河道`);
      return false;
    }
    return true;
  });
}
function street(T, o = {}) {
  const kind = ROAD_KINDS[o.kind || 'main'], w = o.width || kind.width, run = o.run || kind.run, seed = o.seed || 1;
  const curve = ROAD_CURVES[o.curve] ? o.curve : 'straight';
  const fine = curve === 'straight' ? null : curvePoints(o.path, curve, o.radius || Math.max(4, w + 2));
  const cells = fine ? cellsOfCurve(fine) : traceLine(o.path), half = (w - 1) / 2, shoulder = o.shoulder ?? 2;
  const warnings = [];
  const crossing = o.crossing || 'bridge';
  const spans = o.bridges === false || crossing !== 'bridge' ? [] : bridgeSpans(T, cells, half, warnings);
  const ford = { stones: 0 };
  const quay = { cells: 0 };
  const spanOf = i => spans.find(sp => i >= sp.a && i <= sp.b);
  // per-segment slope: o.runs[k] overrides the kind's run on the k-th leg of the path
  const runs = o.runs ? cells.seg.map(k => o.runs[k] || run) : run;
  // junctions: centreline cells already paved by an earlier road keep its level (and so does the
  // first / last cell when the road ends against one), so the two roads meet without a step
  const RS = o.roadSet || new Map(), fixed = cells.map(([x, z]) => RS.has(key3(x, 0, z)) ? RS.get(key3(x, 0, z)) : null);
  for (const end of [0, cells.length - 1]) if (fixed[end] == null) {
    const [x, z] = cells[end]; let best = null, bd = 99;
    for (let a = -half - 2; a <= half + 2; a++) for (let b = -half - 2; b <= half + 2; b++) { const k = key3(Math.round(x + a), 0, Math.round(z + b)); if (RS.has(k) && Math.hypot(a, b) < bd) { bd = Math.hypot(a, b); best = RS.get(k); } }
    if (best != null) fixed[end] = best;
  }
  // 石堤: the road runs on an embankment one block above the water (the old quay code graded it on the river bed)
  const floors = crossing === 'causeway' ? bridgeSpans(T, cells, half, [], false).map(sp => ({ ...sp, deck: sp.top + 1 })) : spans;
  const lv = gradeLine(T, cells, runs, 1, floors, fixed.some(v => v != null) ? fixed : null);
  const occupied = o.occupied || new Set(), roadSet = o.roadSet || new Map();
  // nearest centreline point per cell in the corridor
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const [x, z] of cells) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  const pad = Math.ceil(half + shoulder + 1);
  const road = [], blend = [];
  // distances are measured to the true curve (dense float points) when there is one, so the width
  // stays even round bends; a bucket grid keeps the search local
  const ref = fine ? fine.map((f, i) => [f.x, f.z, cells.fineCell[i]]) : cells.map(([x, z], i) => [x, z, i]);
  const bucket = new Map(), BK = 4;
  for (const r of ref) { const k = Math.floor(r[0] / BK) + ',' + Math.floor(r[1] / BK); (bucket.get(k) || bucket.set(k, []).get(k)).push(r); }
  const nb = Math.ceil(pad / BK) + 1;
  for (let x = bx0 - pad; x <= bx1 + pad; x++) for (let z = bz0 - pad; z <= bz1 + pad; z++) {
    if (!T.inside(x, z)) continue;
    let bi = 0, bd = Infinity;
    const gx = Math.floor(x / BK), gz = Math.floor(z / BK);
    for (let a = -nb; a <= nb; a++) for (let b = -nb; b <= nb; b++) { const L = bucket.get((gx + a) + ',' + (gz + b)); if (L) for (const r of L) { const d = Math.hypot(r[0] - x, r[1] - z); if (d < bd) { bd = d; bi = r[2]; } } }
    const tol = fine ? 0.45 : 0.01;                 // a float curve rarely sits on cell centres
    if (bd <= half + tol) road.push([x, z, bi, bd]);
    else if (bd <= half + shoulder + 0.5 + tol) blend.push([x, z, bi, bd]);
  }
  const mat = (x, z, d, i = 0) => {
    const u = patchNoise(x, 0, z, deriveSeed(seed, 'road'), 'road', 2), h = _h(seed, 'cell', x, z);
    const edge = d > half - 0.6, inner = d > half - 1.6;
    if (kind.pattern === 'setts') {
      if (edge && w >= 3) return 'minecraft:' + kind.kerb;
      if (inner && w >= 5) return 'minecraft:' + kind.drain;
      if (i % 4 === 0) return 'minecraft:' + kind.band;
      return 'minecraft:' + (h < 0.06 ? kind.cracked : kind.body);
    }
    if (kind.pattern === 'herring') {
      if (edge && w >= 3) return 'minecraft:' + kind.kerb;
      return 'minecraft:' + ((Math.floor((x + 2 * z) / 2) & 1) ? kind.a : kind.b);
    }
    if (kind.pattern === 'plank') return edge && w >= 3 ? B(kind.beam, { axis: 'y' }) : 'minecraft:' + kind.board;
    if (kind.rut && d < 0.6 && w >= 3) return 'minecraft:' + pickU(u, [['grass_block[snowy=false]', 3], ['coarse_dirt', 1]]);
    return 'minecraft:' + pickU(u, edge && w > 3 ? kind.edge : kind.centre);
  };
  const bridge = { spans: spans.length, length: 0, piers: 0 }, onBridge = new Set();
  const BS = BRIDGE_STYLES[o.bridge] ? o.bridge : (kind.bridge || 'stone'), VS = BRIDGE_STYLES[o.viaduct_style] ? o.viaduct_style : BS;
  const bw = o.bridge_wood || 'spruce';
  const PIER = 'minecraft:stone_bricks', DECK = ['stone_bricks', 'stone_bricks', 'cracked_stone_bricks', 'mossy_stone_bricks'];
  const quayXZ = new Set(), walls = [], fences = [], deck = new Map(), roadXZ = new Set(road.map(([x, z]) => x + ',' + z));
  const styleOf = sp => BRIDGE_STYLES[sp.vi ? VS : BS], styleKey = sp => sp.vi ? VS : BS;
  const pierAt = (sp, i) => { const P = styleOf(sp).pier, mid = P >> 1; return sp.vi ? i % P === mid : sp.b - sp.a >= P && (i - sp.a) % P === mid && i < sp.b - 1; };
  // distance (along the road) to the nearest pier of the span, for arch profiles and braces
  const pierDist = (sp, i) => { const P = styleOf(sp).pier, mid = P >> 1; const k = sp.vi ? ((i - mid) % P + P) % P : ((i - sp.a - mid) % P + P) % P; return Math.min(k, P - k); };
  // o.fill = { mode: 'earth' | 'viaduct', limit }: deeper fills than `limit` become a viaduct over the ground
  // o.cut  = { mode: 'slope' | 'wall', limit }: deeper cuts than `limit` get retaining walls instead of slopes
  const fillM = o.fill || { mode: 'earth' }, cutM = o.cut || { mode: 'slope' };
  const orig = (x, z) => T.orig[T.idx(x, z)];
  const VI = { vi: true };
  const viaduct = (x, z, i) => fillM.mode === 'viaduct' && lv[i] - orig(x, z) > (fillM.limit ?? 4);
  const deepCut = (x, z, i) => cutM.mode === 'wall' && orig(x, z) - lv[i] > (cutM.limit ?? 3);
  const via = { cells: 0 }, retain = { cells: 0, height: 0 };
  for (const [x, z, i, d] of road) {
    if (roadSet.has(key3(x, 0, z))) continue;
    const y = lv[i], sp = spanOf(i) || (viaduct(x, z, i) ? VI : null);
    if (sp && T.H(x, z) < y - 1) {
      if (sp === VI) via.cells++;
      // bridge / viaduct deck; the river or ground underneath stays as it was
      const st = styleKey(sp), u = patchNoise(x, 0, z, deriveSeed(seed, 'deck'), 'deck', 2), edgeC = d > half - 0.6;
      const wooden = st === 'timber' || st === 'mixed';
      T.S.set(x, y, z, wooden ? (edgeC ? B(`stripped_${bw}_log`, { axis: 'y' }) : 'minecraft:' + bw + '_planks') : 'minecraft:' + pickU(u, DECK.map(m => [m, 1])));
      for (let k = 1; k <= 4; k++) T.S.del ? T.S.del(x, y + k, z) : T.S.set(x, y + k, z, null);
      const pd = pierDist(sp, i), ground = T.H(x, z);
      if (pierAt(sp, i)) {
        // pier: stone, or a timber trestle (two log posts at the road edges, braces between)
        for (let yy = ground + 1; yy < y; yy++) {
          if (st === 'timber') { if (edgeC || d < 0.6) T.S.set(x, yy, z, B(`${bw}_log`, { axis: 'y' })); else if ((yy - ground) % 3 === 0) T.S.set(x, yy, z, B(`${bw}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false })); }
          else T.S.set(x, yy, z, PIER);
        }
        if (st === 'mixed') T.S.set(x, y - 1, z, B(`${bw}_log`, { axis: 'y' }));   // timber cap on the stone pier
        bridge.piers++;
      } else if (st === 'arch') {
        // semicircular arch between piers: spandrel fill hangs down further near the piers
        const P = styleOf(sp).pier, r = P / 2, drop = Math.max(0, Math.round(r - Math.sqrt(Math.max(0, r * r - (r - pd) * (r - pd))))) ;
        for (let k = 1; k <= drop && y - k > ground; k++) T.S.set(x, y - k, z, 'minecraft:stone_bricks');
        const yb = y - drop - 1; if (yb > ground) T.S.set(x, yb, z, 'minecraft:stone_brick_slab[type=top,waterlogged=false]');
      } else if (st === 'timber' || st === 'mixed') {
        // a beam under the boards; knee braces next to the piers
        T.S.set(x, y - 1, z, edgeC ? B(`stripped_${bw}_log`, { axis: 'y' }) : B(`${bw}_slab`, { type: 'top', waterlogged: false }));
        if (pd === 1 && y - 2 > ground && edgeC) T.S.set(x, y - 2, z, B(`${bw}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false }));
      } else if (pd === 1) T.S.set(x, y - 1, z, 'minecraft:stone_brick_slab[type=top,waterlogged=false]');
      deck.set(x + ',' + z, [y, BRIDGE_STYLES[st].rail]);
      onBridge.add(x + ',' + z); occupied.add(x + ',' + z);
    } else if (crossing === 'ford' && T.water[T.idx(x, z)]) {
      // 踏石过水: stepping stones at the water surface along the centre, every other cell; the rest stays water
      if (d < 1.1 && (i & 1) === 0) { const wt = waterTop(T, x, z); T.S.set(x, wt, z, 'minecraft:' + ((_h(seed, 'ford', x, z) < 0.3) ? 'mossy_cobblestone' : 'cobblestone')); roadSet.set(key3(x, 0, z), wt); ford.stones++; }
      continue;
    } else if (T.water[T.idx(x, z)]) {
      // road over the water's edge: a stone quay from the river bed up to the road surface
      const u = n => patchNoise(x, n, z, deriveSeed(seed, 'quay'), 'quay', 2);
      T.setGround(x, z, y, mat(x, z, d, i));
      for (let yy = T.orig[T.idx(x, z)] + 1; yy < y; yy++) T.S.set(x, yy, z, 'minecraft:' + pickU(u(yy), [['stone_bricks', 5], ['mossy_stone_bricks', 3], ['cobblestone', 1]]));
      quayXZ.add(x + ',' + z); quay.cells++;
    } else T.setGround(x, z, y, mat(x, z, d, i));
    roadSet.set(key3(x, 0, z), y);
  }
  // parapet on every deck cell that borders open air (8-neighbourhood, so diagonal edges stay closed)
  for (const [k, [y, rail]] of deck) {
    const [x, z] = k.split(',').map(Number); let edge = false;
    for (let a = -1; a <= 1 && !edge; a++) for (let b = -1; b <= 1; b++) { const q = (x + a) + ',' + (z + b); if (!deck.has(q) && !roadXZ.has(q)) { edge = true; break; } }
    if (!edge) continue;
    if (rail === 'fence') { T.S.set(x, y + 1, z, B(`${bw}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false })); fences.push([x, y + 1, z]); }
    else { T.S.set(x, y + 1, z, 'minecraft:stone_brick_wall'); walls.push([x, y + 1, z]); }
  }
  // fence rails join their neighbours
  for (const [x, y, z] of fences) {
    const c = {}, isF = (a, b) => /_fence\b|_fence\[/.test(T.S.get(a, y, b) || '') || /_log\[|_planks/.test(T.S.get(a, y, b) || '');
    for (const [dname, dx, dz] of [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]) c[dname] = isF(x + dx, z + dz);
    T.S.set(x, y, z, B(`${bw}_fence`, { ...c, waterlogged: false }));
  }
  bridge.length = spans.reduce((n, sp) => n + sp.b - sp.a + 1, 0);
  bridge.piers = Math.round(bridge.piers / Math.max(1, w));
  for (const [x, z, i, d] of blend) {
    if (roadSet.has(key3(x, 0, z)) || occupied.has(x + ',' + z)) continue;
    if ((spanOf(i) || viaduct(x, z, i)) && T.H(x, z) < lv[i] - 1) continue;
    if (T.water[T.idx(x, z)]) continue;
    if (deepCut(x, z, i)) {
      // retaining wall right at the road edge; the hillside behind it stays as it was
      let touch = false; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (roadXZ.has((x + a) + ',' + (z + b))) touch = true;
      if (touch) {
        const top = orig(x, z), u = n => patchNoise(x, n, z, deriveSeed(seed, 'retain'), 'retain', 2);
        for (let yy = lv[i] + 1; yy <= top; yy++) T.S.set(x, yy, z, 'minecraft:' + pickU(u(yy), [['stone_bricks', 5], ['mossy_stone_bricks', 2], ['cracked_stone_bricks', 1], ['cobblestone', 1]]));
        T.S.set(x, top + 1, z, 'minecraft:stone_brick_wall'); walls.push([x, top + 1, z]);
        occupied.add(x + ',' + z); retain.cells++; retain.height = Math.max(retain.height, top - lv[i]);
      }
      continue;
    }
    const t = (d - half) / (shoulder + 0.5), o0 = T.orig[T.idx(x, z)];
    T.setGround(x, z, Math.round(lv[i] + (o0 - lv[i]) * t));
  }
  // low wall along the quay edge where the road meets open water
  for (const k of quayXZ) {
    const [x, z] = k.split(',').map(Number), y = roadSet.get(key3(x, 0, z));
    let edge = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = (x + a) + ',' + (z + b); if (!roadXZ.has(q) && T.inside(x + a, z + b) && T.water[T.idx(x + a, z + b)]) edge = true; }
    if (edge && !T.S.get(x, y + 1, z)) { T.S.set(x, y + 1, z, 'minecraft:stone_brick_wall'); walls.push([x, y + 1, z]); occupied.add(k); }
  }
  // parapet walls join up with their neighbours (posts only at ends and corners)
  for (const [x, y, z] of walls) {
    const c = {}, isW = (a, b) => (T.S.get(a, y, b) || '').startsWith('minecraft:stone_brick_wall');
    for (const [d, dx, dz] of [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]) c[d] = isW(x + dx, z + dz) ? 'low' : 'none';
    const straight = (c.east !== 'none' && c.west !== 'none' && c.north === 'none' && c.south === 'none') || (c.north !== 'none' && c.south !== 'none' && c.east === 'none' && c.west === 'none');
    T.S.set(x, y, z, B('stone_brick_wall', { east: c.east, north: c.north, south: c.south, up: straight ? 'false' : 'true', waterlogged: 'false', west: c.west }));
  }
  // half-step slabs where the road climbs one level, on the lower side
  if (kind.slab) for (const [x, z, i] of road) {
    if (onBridge.has(x + ',' + z)) continue;
    const up = (lv[i + 1] ?? lv[i]) > lv[i] || (lv[i - 1] ?? lv[i]) > lv[i];
    const st = T.S.get(x, lv[i], z) || '', id = st.split('[')[0].replace('minecraft:', '');
    if (up && kind.slabs[id]) T.S.set(x, lv[i] + 1, z, B(kind.slabs[id], { type: 'bottom', waterlogged: false }));
  }
  // props along the sides
  const props = { lamp: 0, tree: 0 }, placed = o.placed || new Set();
  const normal = i => { const a = cells[Math.max(0, i - 2)], b = cells[Math.min(cells.length - 1, i + 2)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  const faceQ = (dx, dz) => Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 0 : 2) : (dz > 0 ? 1 : 3);
  const free = (x, z, r = 0) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (!T.inside(x + a, z + b) || roadSet.has(key3(x + a, 0, z + b)) || occupied.has((x + a) + ',' + (z + b))) return false; } return true; };
  if (o.lamps !== false) {
    const sp = (o.lamps && o.lamps.spacing) || 12, style = (o.lamps && o.lamps.style) || 'arm';
    let side = 1;
    for (let i = Math.floor(sp / 2); i < cells.length; i += sp) {
      const [nx, nz] = normal(i), off = half + 1;
      const x = Math.round(cells[i][0] + nx * off * side), z = Math.round(cells[i][1] + nz * off * side);
      if (!free(x, z) || T.water[T.idx(x, z)] || Math.abs(T.H(x, z) - lv[i]) > 2) { side = -side; continue; }
      const lp = lampPost({ style, height: 3, seed: seed + i, wood: o.wood, stone: o.stone });
      placeProp(T.S, lp, x, T.H(x, z) + 1, z, faceQ(-nx * side, -nz * side), { placed });
      occupied.add(x + ',' + z); props.lamp++; side = -side;
    }
  }
  if (o.trees) {
    const sp = o.trees.spacing || 9, rng = new PyRandom(deriveSeed(seed, 'street-trees'));
    for (let i = 3; i < cells.length; i += sp) for (const side of [1, -1]) {
      if (rng.random() < 0.3) continue;
      const [nx, nz] = normal(i), off = half + 3 + rng.randint(0, 1);
      const x = Math.round(cells[i][0] + nx * off * side), z = Math.round(cells[i][1] + nz * off * side);
      if (!free(x, z, 1) || T.water[T.idx(x, z)] || T.slope(x, z) > 2) continue;
      const tr = tree({ species: rng.choice(o.trees.species || ['oak', 'oak', 'birch']), size: rng.choice(['s', 'm', 'm']), seed: seed * 100 + i });
      T.setGround(x, z, T.H(x, z), 'minecraft:grass_block[snowy=false]');
      placeProp(T.S, tr, x, T.H(x, z) + 1, z, 0, { placed, ifEmpty: true });
      occupied.add(x + ',' + z); props.tree++;
    }
  }
  const steps = lv.reduce((n, v, i) => n + (i && v !== lv[i - 1] ? 1 : 0), 0);
  bridge.style = BRIDGE_STYLES[BS].label; bridge.viaductStyle = BRIDGE_STYLES[VS].label;
  return { cells, levels: lv, road, props, steps, bridge, viaduct: via.cells, retain, quay: quay.cells, warnings, rise: Math.max(...lv) - Math.min(...lv), length: cells.length, width: w, kind: kind.label };
}
