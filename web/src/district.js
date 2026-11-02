// ---------------------------------------------------------------------------------------------
// Selections (选区) and the automatic district planner (自动生成布局).
//
// A selection is a list of shapes combined in order, like Photoshop: every shape is a polygon in
// continuous ground coordinates (a cell (x, z) is inside when its centre (x + .5, z + .5) is), with an
// op — 'add' (添加), 'sub' (减去) or 'and' (交叉). Rectangles and ellipses are turned into polygons
// when drawn; the lasso, polygon lasso and magnetic lasso give polygons directly. zoneMask() turns a
// zone (with or without shapes) into a cell mask; old zones without shapes are plain rectangles.
//
// planDistrict(): landmark first, then roads, then the blocks come by themselves — the roads are
// ordinary road layers (the user can edit every one of them afterwards) and townRoads() lines both
// sides with houses as usual, kept inside the selection. Plan types follow the classification of
// medieval town plans: organic growth along a main street, grid (bastide), radial (radio-concentric)
// and linear (one long street with back lanes).
// ---------------------------------------------------------------------------------------------
const SEL_SHAPES = { rect: '矩形', ellipse: '椭圆', lasso: '自由套索', poly: '多边形套索', magnetic: '磁性套索' };
const SEL_OPS = { new: '新选区', add: '添加到选区', sub: '从选区减去', and: '与选区交叉' };
const DISTRICT_STYLES = {
  organic: { label: '自然生长', note: '一条顺着地势弯曲的主街，支路从主街两侧分出，像从村子慢慢长成的老镇' },
  grid: { label: '网格型', note: '两条主街十字相交，其余街道与它们平行，切成方正的街块（中世纪新建城镇 bastide 的做法）' },
  radial: { label: '放射型', note: '街道从中心广场向外放射，外面再绕一圈或几圈环路' },
  linear: { label: '沿街型', note: '一条长主街贯穿全区，两侧各一条后巷，中间几条横巷相连' },
};
// spacing: distance between parallel streets (two rows of houses back to back need about 27)
const DISTRICT_DENSITY = {
  sparse: { label: '疏', spacing: 42, gap: [4, 8], plot: [13, 17], spokes: 4, plaza: [15, 13], branch: 1.25 },
  normal: { label: '中', spacing: 34, gap: null, spokes: 6, plaza: [13, 11], branch: 1 },
  dense: { label: '密', spacing: 27, gap: [0, 1], plot: [9, 12], spokes: 8, plaza: [11, 9], branch: 0.8 },
};
// scale of the selection (buildable land cells): a hamlet gets a well and one street, a town the full plan
const DISTRICT_TIERS = { hamlet: { label: '小村', max: 2500, lm: 'plaza' }, village: { label: '村庄', max: 6000, lm: 'chapel' }, town: { label: '镇', max: Infinity, lm: 'church' } };
const HOUSE_SIZES = {
  auto: { label: '自动（按规模，中心大外围小）' },
  small: { label: '小（窄、一到两层）', plot: [9, 11], depth: [6, 7], floors: [1, 1, 2] },
  medium: { label: '中', plot: [11, 15], depth: [7, 9], floors: [1, 2, 2, 2, 3] },
  large: { label: '大（宽、二到三层）', plot: [13, 17], depth: [8, 10], floors: [2, 2, 3] },
};
const DISTRICT_LANDMARKS = { auto: '自动（按选区大小）', church: '教区教堂 + 广场', chapel: '小礼拜堂 + 广场', plaza: '集市广场（水井）', none: '不放地标' };

function inPoly(P, x, z) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// shape helpers: a / b are the two corner cells of a drag (inclusive)
function rectPoly(a, b) { const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]) + 1, z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]) + 1; return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
function ellipsePoly(a, b, n = 64) {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]) + 1, z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]) + 1;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2, rz = (z1 - z0) / 2, out = [];
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; out.push([cx + Math.cos(t) * rx, cz + Math.sin(t) * rz]); }
  return out;
}
const _maskCache = new WeakMap();
function zoneMask(zn) {
  if (_maskCache.has(zn)) return _maskCache.get(zn);
  const sh = zn.shapes;
  let M;
  if (!sh || !sh.length) {
    const x0 = Math.min(zn.x0, zn.x1), x1 = Math.max(zn.x0, zn.x1), z0 = Math.min(zn.z0, zn.z1), z1 = Math.max(zn.z0, zn.z1);
    M = { x0, z0, x1, z1, count: (x1 - x0 + 1) * (z1 - z0 + 1), rect: true, has: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 };
  } else M = shapesMask(sh);
  _maskCache.set(zn, M);
  return M;
}
function shapesMask(sh) {
  let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
  for (const s of sh) if (s.op !== 'sub' && s.op !== 'and') for (const [x, z] of s.pts) { bx0 = Math.min(bx0, Math.floor(x)); bx1 = Math.max(bx1, Math.ceil(x)); bz0 = Math.min(bz0, Math.floor(z)); bz1 = Math.max(bz1, Math.ceil(z)); }
  if (!isFinite(bx0)) return { x0: 0, z0: 0, x1: -1, z1: -1, count: 0, has: () => false };
  const W = bx1 - bx0 + 1, L = bz1 - bz0 + 1, m = new Uint8Array(W * L);
  for (const s of sh) {
    if (s.pts.length < 3) continue;
    let sx0 = Infinity, sx1 = -Infinity, sz0 = Infinity, sz1 = -Infinity;
    for (const [x, z] of s.pts) { sx0 = Math.min(sx0, x); sx1 = Math.max(sx1, x); sz0 = Math.min(sz0, z); sz1 = Math.max(sz1, z); }
    if (s.op === 'and') { for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) { const i = x + z * W; if (m[i] && !inPoly(s.pts, bx0 + x + 0.5, bz0 + z + 0.5)) m[i] = 0; } continue; }
    const v = s.op === 'sub' ? 0 : 1;
    for (let z = Math.max(0, Math.floor(sz0) - bz0); z <= Math.min(L - 1, Math.ceil(sz1) - bz0); z++)
      for (let x = Math.max(0, Math.floor(sx0) - bx0); x <= Math.min(W - 1, Math.ceil(sx1) - bx0); x++)
        if (inPoly(s.pts, bx0 + x + 0.5, bz0 + z + 0.5)) m[x + z * W] = v;
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, count = 0;
  for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) if (m[x + z * W]) { count++; x0 = Math.min(x0, x + bx0); x1 = Math.max(x1, x + bx0); z0 = Math.min(z0, z + bz0); z1 = Math.max(z1, z + bz0); }
  if (!count) return { x0: 0, z0: 0, x1: -1, z1: -1, count: 0, has: () => false };
  return { x0, z0, x1, z1, count, has: (x, z) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1 && m[(x - bx0) + (z - bz0) * W] === 1 };
}
// cells on the outline of a mask (a 4-neighbour outside) — for drawing the selection
function maskOutline(M) {
  const out = [];
  for (let x = M.x0; x <= M.x1; x++) for (let z = M.z0; z <= M.z1; z++)
    if (M.has(x, z) && (!M.has(x + 1, z) || !M.has(x - 1, z) || !M.has(x, z + 1) || !M.has(x, z - 1))) out.push([x, z]);
  return out;
}

// ---- magnetic lasso (Intelligent Scissors / live-wire, Mortensen & Barrett 1995): the cheapest path
// between the last anchor and the cursor, where crossing a strong edge is cheap. Edges on a terrain are
// height steps (slopes, cliffs), shorelines and the edge of an existing road.
function edgeCost(top, wet, W, L, road) {
  const c = new Float32Array(W * L);
  for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
    const i = x + z * W, h = top[i];
    let g = 0, w = 0, r = 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, nz = z + b; if (nx < 0 || nz < 0 || nx >= W || nz >= L) continue;
      const j = nx + nz * W;
      if (h >= 0 && top[j] >= 0) g = Math.max(g, Math.abs(top[j] - h));
      if (wet && wet[j] !== wet[i]) w = 1;
      if (road && road[j] !== road[i]) r = 1;
    }
    c[i] = 0.08 + 1 / (1 + 1.6 * Math.min(g, 4) + 5 * w + 4 * r);
  }
  return c;
}
function liveWire(cost, W, L, a, b, margin = 24) {
  const x0 = Math.max(0, Math.min(a[0], b[0]) - margin), x1 = Math.min(W - 1, Math.max(a[0], b[0]) + margin);
  const z0 = Math.max(0, Math.min(a[1], b[1]) - margin), z1 = Math.min(L - 1, Math.max(a[1], b[1]) + margin);
  const w = x1 - x0 + 1, l = z1 - z0 + 1, n = w * l;
  const inW = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  if (!inW(a[0], a[1]) || !inW(b[0], b[1])) return [a, b];
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const hk = [], hv = [];
  const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
  const pop = () => { const v = hv[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l2 = 2 * i + 1, r2 = l2 + 1; let m = i; if (l2 < hk.length && hk[l2] < hk[m]) m = l2; if (r2 < hk.length && hk[r2] < hk[m]) m = r2; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return v; };
  const li = (x, z) => (x - x0) + (z - z0) * w, s = li(a[0], a[1]), t = li(b[0], b[1]);
  dist[s] = 0; push(0, s);
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (hk.length) {
    const i = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break;
    const x = x0 + i % w, z = z0 + ((i / w) | 0), ci = cost[x + z * W];
    for (const [dx, dz] of N8) {
      const nx = x + dx, nz = z + dz; if (!inW(nx, nz)) continue;
      const j = li(nx, nz); if (done[j]) continue;
      const d = dist[i] + (ci + cost[nx + nz * W]) * 0.5 * (dx && dz ? 1.4142 : 1);
      if (d < dist[j]) { dist[j] = d; prev[j] = i; push(d, j); }
    }
  }
  if (prev[t] < 0 && s !== t) return [a, b];
  const path = []; for (let i = t; i >= 0; i = i === s ? -1 : prev[i]) path.push([x0 + i % w, z0 + ((i / w) | 0)]);
  return path.reverse();
}

// ---- the planner. G: { x0, z0, x1, z1, H(x, z), wet(x, z) } (a Terrain works through districtGrid)
function districtGrid(T) { return { x0: T.x0, z0: T.z0, x1: T.x1, z1: T.z1, H: (x, z) => T.H(x, z), wet: (x, z) => !!T.water[T.idx(x, z)] }; }
const _churchFp = new Map();
function churchFootprint(kind, seed, q) {     // [w, d] of the building's ground floor after q quarter turns
  const key = kind + ':' + seed;
  if (!_churchFp.has(key)) { const b = church({ kind, seed }).S.blocks; _churchFp.set(key, b); }
  const r = rotQuarter(_churchFp.get(key), q);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const k of r.keys()) { const [x, y, z] = unkey(k); if (y !== 0) continue; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return [x1 - x0 + 1, z1 - z0 + 1];
}

function planDistrict(G, zn, o = {}) {
  const seed = (o.seed ?? zn.seed ?? 1) | 0, rng = new PyRandom(deriveSeed(seed, 'district'));
  const style = DISTRICT_STYLES[o.style || zn.style] ? (o.style || zn.style) : 'organic';
  const dk = DISTRICT_DENSITY[o.density || zn.density] ? (o.density || zn.density) : 'normal', Dn = DISTRICT_DENSITY[dk];
  const lmAsk = DISTRICT_LANDMARKS[o.landmark || zn.landmark] ? (o.landmark || zn.landmark) : 'auto';
  const hsKey = HOUSE_SIZES[o.house || zn.house] ? (o.house || zn.house) : 'auto';
  const id = zn.id, M = zoneMask(zn), report = [];
  const inG = (x, z) => x >= G.x0 && x <= G.x1 && z >= G.z0 && z <= G.z1;
  const ok = (x, z) => inG(x, z) && M.has(x, z);
  const land = (x, z) => ok(x, z) && !G.wet(x, z);
  const cells = []; for (let x = M.x0; x <= M.x1; x++) for (let z = M.z0; z <= M.z1; z++) if (land(x, z)) cells.push([x, z]);
  if (cells.length < 700) return { ok: false, roads: [], zones: [], report: [`选区里可建的陆地只有 ${cells.length} 格，太少（至少约 30×30），没有生成布局`] };
  // distance (in cells) to the selection edge or to water
  const bx0 = M.x0 - 1, bz0 = M.z0 - 1, bw = M.x1 - M.x0 + 3, bl = M.z1 - M.z0 + 3, D = new Int16Array(bw * bl).fill(-1), q = [];
  for (let z = 0; z < bl; z++) for (let x = 0; x < bw; x++) if (!land(bx0 + x, bz0 + z)) { D[x + z * bw] = 0; q.push(x + z * bw); }
  for (let i = 0; i < q.length; i++) { const c = q[i], x = c % bw, z = (c / bw) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, nz = z + b; if (nx < 0 || nz < 0 || nx >= bw || nz >= bl) continue; const n = nx + nz * bw; if (D[n] < 0) { D[n] = D[c] + 1; q.push(n); } } }
  const Dat = (x, z) => { const a = x - bx0, b = z - bz0; return a < 0 || b < 0 || a >= bw || b >= bl ? 0 : D[a + b * bw]; };
  // centroid and long axis
  let mx = 0, mz = 0; for (const [x, z] of cells) { mx += x; mz += z; } mx /= cells.length; mz /= cells.length;
  let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of cells) { sxx += (x - mx) ** 2; szz += (z - mz) ** 2; sxz += (x - mx) * (z - mz); }
  let th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  { const deg = th * 180 / Math.PI, sn = Math.round(deg / 90) * 90; if (Math.abs(deg - sn) < 12) th = sn * Math.PI / 180; }
  const U = [Math.cos(th), Math.sin(th)], V = [-Math.sin(th), Math.cos(th)];
  const lam1 = (sxx + szz) / 2 + Math.sqrt(((sxx - szz) / 2) ** 2 + sxz ** 2), lam2 = (sxx + szz) / 2 - Math.sqrt(((sxx - szz) / 2) ** 2 + sxz ** 2);
  const elong = Math.sqrt(Math.max(1, lam1) / Math.max(1, lam2)), size = Math.sqrt(cells.length);
  let hMin = Infinity, hMax = -Infinity; for (const [x, z] of cells) { const h = G.H(x, z); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
  const tier = cells.length < DISTRICT_TIERS.hamlet.max ? 'hamlet' : cells.length < DISTRICT_TIERS.village.max ? 'village' : 'town', TI = DISTRICT_TIERS[tier];
  const lmKind = lmAsk === 'auto' ? TI.lm : lmAsk;
  report.push(`布局：${DISTRICT_STYLES[style].label} · 密度${Dn.label} · 种子 ${seed}；可建陆地 ${cells.length} 格 → 规模：${TI.label}，长轴 ${Math.round(((th * 180 / Math.PI) + 360) % 180)}°`);
  if (tier !== 'town' && style !== 'organic') report.push(`${TI.label}规模下${DISTRICT_STYLES[style].label}只保留${tier === 'hamlet' ? '主干' : '主要'}街道`);
  // house sizes: auto = small in a hamlet, medium elsewhere, bigger near the square and smaller at the edge
  const HS = HOUSE_SIZES[hsKey === 'auto' ? (tier === 'hamlet' ? 'small' : 'medium') : hsKey];
  const plotOf = () => { const p = HS.plot.slice(); if (dk === 'dense') { p[0] = Math.max(9, p[0] - 2); p[1] = Math.max(p[0], p[1] - 2); } if (dk === 'sparse') { p[0] += 1; p[1] += 1; } return p; };

  // ---- 1. landmark (and its square) first ----
  const zones = [], blocks = [];        // blocks: rectangles roads must keep out of [x0, z0, x1, z1]
  const pz = tier === 'hamlet' ? [9, 9] : Dn.plaza;
  const [pw0, pl0] = lmKind === 'none' ? [0, 0] : lmKind === 'plaza' ? [pz[0] + 2, pz[0] + 2] : pz;
  const alongX = Math.abs(U[0]) >= Math.abs(U[1]), pw = alongX ? pw0 : pl0, pl = alongX ? pl0 : pw0;
  const flat = (x, z, r) => { let lo = Infinity, hi = -Infinity; for (let a = -r; a <= r; a += 2) for (let b = -r; b <= r; b += 2) { if (!land(x + a, z + b)) return 99; const h = G.H(x + a, z + b); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
  const need = lmKind === 'none' ? 4 : Math.ceil(Math.max(pw, pl) / 2) + 2;
  const cand = [];
  for (const [x, z] of cells) {
    if ((x + z) % 2) continue;
    const d = Dat(x, z); if (d < need) continue;
    const fl = flat(x, z, Math.max(3, need - 2)); if (fl > 12) continue;
    const s = -Math.hypot(x - mx, z - mz) / size * 1.6 - fl / 5 + (lmKind === 'church' || lmKind === 'chapel' ? 0.5 * (G.H(x, z) - hMin) / Math.max(1, hMax - hMin) : 0) + rng.random() * 0.45;
    cand.push({ x, z, s });
  }
  cand.sort((a, b) => b.s - a.s);
  let hub = cand.length ? cand[0] : { x: Math.round(mx), z: Math.round(mz) }, plaza = null, lm = null;
  if (!land(hub.x, hub.z)) { let b = null, bd = 1e9; for (const [x, z] of cells) { const d = Math.hypot(x - mx, z - mz) - Dat(x, z) * 2; if (d < bd) { bd = d; b = { x, z }; } } hub = b; }
  const plazaAt = h => ({ kind: 'plaza', district: id, x0: h.x - (pw >> 1), z0: h.z - (pl >> 1), x1: h.x - (pw >> 1) + pw - 1, z1: h.z - (pl >> 1) + pl - 1 });
  const rectLand = (x0, z0, x1, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (!land(x, z)) return false; return true; };
  if (lmKind === 'church' || lmKind === 'chapel') {
    const FACE = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let best = null;
    // a parish church that does not fit falls back to a chapel
    for (const kind of lmKind === 'chapel' ? ['chapel'] : ['parish', 'chapel']) { if (best) break;
    for (const h of cand.slice(0, 24)) {
      const P = plazaAt(h);
      for (let f = 0; f < 4; f++) {
        // the church stands on side s of the square, its west door (front = q + 3) facing back toward it
        const [sx, sz] = FACE[f], qq = ((((f + 2) % 4) - 3) % 4 + 4) % 4, [fw, fd] = churchFootprint(kind, seed, qq);
        const half = sx ? pw / 2 : pl / 2, depth = sx ? fw : fd, dist = half + 8 + depth / 2;
        const cx = h.x + 0.5 + sx * dist, cz = h.z + 0.5 + sz * dist;
        const x0 = Math.round(cx - fw / 2), z0 = Math.round(cz - fd / 2), x1 = x0 + fw - 1, z1 = z0 + fd - 1;
        if (!rectLand(x0 - 2, z0 - 2, x1 + 2, z1 + 2)) continue;
        // the forecourt between door and square
        const fx0 = sx > 0 ? P.x1 + 1 : sx < 0 ? x1 + 1 : x0, fx1 = sx > 0 ? x0 - 1 : sx < 0 ? P.x0 - 1 : x1;
        const fz0 = sz > 0 ? P.z1 + 1 : sz < 0 ? z1 + 1 : z0, fz1 = sz > 0 ? z0 - 1 : sz < 0 ? P.z0 - 1 : z1;
        if (!rectLand(Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1))) continue;
        let lo = Infinity, hi = -Infinity; for (let x = x0; x <= x1; x += 2) for (let z = z0; z <= z1; z += 2) { const v = G.H(x, z); lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const axisBonus = Math.abs(sx * U[0] + sz * U[1]) > 0.7 ? 0.6 : 0;             // at the end of the main street
        const s = h.s - (hi - lo) / 6 + axisBonus + 0.4 * (lo - hMin) / Math.max(1, hMax - hMin) + rng.random() * 0.3;
        if (!best || s > best.s) best = { s, h, P, q: qq, cx, cz, rect: [x0, z0, x1, z1], fore: [Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1)], kind, fw, fd };
      }
    }
    }
    if (best) {
      hub = best.h; plaza = best.P;
      lm = { kind: 'landmark', district: id, x0: best.rect[0], z0: best.rect[1], x1: best.rect[2], z1: best.rect[3], item: { type: 'church', kind: best.kind, seed, cx: best.cx, cz: best.cz, q: best.q, level: null } };
      blocks.push([best.rect[0] - 2, best.rect[1] - 2, best.rect[2] + 2, best.rect[3] + 2], best.fore);
      report.push(`地标：${best.kind === 'chapel' ? '小礼拜堂' : '教区教堂'}（${best.fw}×${best.fd}），正门朝广场；广场 ${pw}×${pl}` + (best.kind === 'chapel' && lmKind === 'church' ? '（放不下教区教堂，改用小礼拜堂）' : ''));
    } else {
      const [fw, fd] = churchFootprint('chapel', seed, 0);
      report.push(`⚠ 地标：选区里找不到放得下${lmKind === 'chapel' ? '小礼拜堂' : '教堂'}的平地，只放广场（小礼拜堂连广场约需 ${fw + pw + 22}×${Math.max(fd, pl) + 10} 格的较平陆地）`);
    }
  }
  if (!plaza && lmKind !== 'none' && rectLand(hub.x - (pw >> 1), hub.z - (pl >> 1), hub.x - (pw >> 1) + pw - 1, hub.z - (pl >> 1) + pl - 1)) { plaza = plazaAt(hub); if (lmKind === 'plaza') report.push(`地标：集市广场 ${pw}×${pl}，中心水井`); }
  if (lm) zones.push(lm);
  if (plaza) zones.push(plaza);

  // ---- 2. roads ----
  const BM = 5;      // road centre lines keep this far off: half a 5-wide road plus junction corner arcs
  const blocked = (x, z) => blocks.some(r => x >= r[0] - BM && x <= r[2] + BM && z >= r[1] - BM && z <= r[3] + BM);
  const good = (x, z) => land(x, z) && !blocked(x, z);
  const roads = [], runCells = [], taken = new Map();      // taken: cell -> road index (for spacing / joining in organic growth)
  const markTaken = (cellsR, k, r = 2) => { for (const [x, z] of cellsR) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const kk = (x + a) + ',' + (z + b); if (!taken.has(kk)) taken.set(kk, k); } };
  const sec = dk === 'sparse' ? 'gravel' : 'cobble', lane = 'lane';
  const W5 = { main: 5, cobble: 3, gravel: 3, lane: 3, brick: 5 };
  const lampOf = kind => kind === 'main' || kind === 'cobble' || kind === 'brick' ? 'arm' : dk === 'dense' ? 'post' : 'none';
  // cells along a polyline (continuous points), split into runs of buildable cells; water up to `bridge`
  // cells long is crossed (the road builder makes a bridge there)
  const runsOf = (pts, bridge = 0) => {
    const seq = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * 2));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) { const x = Math.floor(ax + (bx - ax) * k / n), z = Math.floor(az + (bz - az) * k / n), l = seq[seq.length - 1]; if (!l || l[0] !== x || l[1] !== z) seq.push([x, z]); }
    }
    const runs = []; let cur = [], wetRun = [];
    const flush = () => { if (cur.length) runs.push(cur); cur = []; wetRun = []; };
    for (const c of seq) {
      if (good(c[0], c[1])) { if (wetRun.length) { cur.push(...wetRun); wetRun = []; } cur.push(c); continue; }
      if (bridge && cur.length && ok(c[0], c[1]) && !blocked(c[0], c[1]) && G.wet(c[0], c[1]) && wetRun.length < bridge) { wetRun.push(c); continue; }
      flush();
    }
    flush();
    return runs;
  };
  const lenOf = run => { let l = 0; for (let i = 1; i < run.length; i++) l += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]); return l; };
  // a straight line drawn over a ravine or a steep bank would be built as a tall viaduct / deep cut with
  // retaining walls: cut the run there (the connecting step then finds a gentler way round)
  const splitRough = (run, width = 5) => {
    const side = Math.floor(width / 2) + 1;
    const H = run.map(([x, z]) => G.H(x, z)), n = run.length, out = []; let cur = [];
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0; for (let k = Math.max(0, i - 7); k <= Math.min(n - 1, i + 7); k++) { s += H[k]; c++; }
      const dev = H[i] - s / c, a0 = Math.max(0, i - 6), a1 = Math.min(n - 1, i + 6), steep = Math.abs(H[Math.min(n - 1, i + 3)] - H[Math.max(0, i - 3)]) > 4 || (a1 - a0 >= 8 && Math.abs(H[a1] - H[a0]) / (a1 - a0) > 0.42);
      const wet = G.wet(run[i][0], run[i][1]);
      // across the road: a cliff or drop right at the road edge (a road along the foot of a bank)
      const p0 = run[Math.max(0, i - 2)], p1 = run[Math.min(n - 1, i + 2)], tl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, nx = -(p1[1] - p0[1]) / tl, nz = (p1[0] - p0[0]) / tl;
      let cross = false;
      for (const sd of [-1, 1]) { const x = Math.round(run[i][0] + nx * side * sd), z = Math.round(run[i][1] + nz * side * sd); if (inG(x, z) && !G.wet(x, z) && Math.abs(G.H(x, z) - H[i]) > 3) cross = true; }
      if (!wet && (dev < -4 || dev > 3 || steep || cross)) { if (cur.length) out.push(cur); cur = []; } else cur.push(run[i]);
    }
    if (cur.length) out.push(cur);
    return out;
  };
  let roughCut = 0;
  const addRoad = (run, kind, name, curved, minLen = 14, keep = false) => {
    if (!keep && run && run.length > 2) { const parts = splitRough(run, W5[kind] || 3); if (parts.length !== 1 || parts[0].length !== run.length) { roughCut++; let last = null; for (const p of parts) last = addRoad(p, kind, name, curved, minLen, true) || last; return last; } }
    if (!run || run.length < 2 || lenOf(run) < minLen) return null;
    const step = curved ? (keep === 'dense' ? 4 : 9) : 1e9, pick = [run[0]];
    if (curved) for (let i = step; i < run.length - 4; i += step) pick.push(run[i]);
    pick.push(run[run.length - 1]);
    const rd = { name, pts: pick.map(([x, z]) => [x, G.H(x, z), z]), kind, width: W5[kind] || 3, curve: curved ? 'smooth' : 'straight', radius: 10, district: id, lamp: lampOf(kind) };
    if (Dn.gap) rd.gap = Dn.gap.slice();
    rd.plot = plotOf(); rd.depth = HS.depth.slice(); rd.floors = HS.floors.slice();
    if (hsKey === 'auto' && tier !== 'hamlet') rd.core = [hub.x, hub.z, Math.round(eR)];
    runCells.push(run);
    roads.push(rd); markTaken(run, roads.length - 1, Math.max(2, Math.round(Dn.spacing * 0.3)));
    return rd;
  };
  const line = (c, dir, ext = 2000) => [[c[0] - dir[0] * ext, c[1] - dir[1] * ext], [c[0] + dir[0] * ext, c[1] + dir[1] * ext]];
  const hc = [hub.x + 0.5, hub.z + 0.5], S = Dn.spacing;
  // farthest selection extent from the hub along / across the axes
  let eU = 0, eV = 0, eR = 0; for (const [x, z] of cells) { const dx = x + 0.5 - hc[0], dz = z + 0.5 - hc[1]; eU = Math.max(eU, Math.abs(dx * U[0] + dz * U[1])); eV = Math.max(eV, Math.abs(dx * V[0] + dz * V[1])); eR = Math.max(eR, Math.hypot(dx, dz)); }
  let nMain = 0, nSec = 0;
  const jit = () => (rng.random() - 0.5) * S * 0.24;
  if (style === 'grid') {
    for (const [A, P, e] of [[U, V, eV], [V, U, eU]]) {
      const J = tier === 'hamlet' ? 0 : tier === 'village' ? Math.min(1, Math.floor(e / S)) : Math.floor(e / S);
      for (let j = -J; j <= J; j++) {
        const off = j * S + (j ? jit() : 0), c = [hc[0] + P[0] * off, hc[1] + P[1] * off];
        if (j && rng.random() < 0.12 && Math.abs(j) > 1) continue;            // a few streets left out: blocks of different sizes
        for (const run of runsOf(line(c, A), j ? 0 : 12)) if (addRoad(run, j ? sec : 'main', j ? `街道` : '主街', false)) j ? nSec++ : nMain++;
      }
    }
  } else if (style === 'radial') {
    const n = tier === 'hamlet' ? 3 : tier === 'village' ? Math.min(4, Dn.spokes) : Dn.spokes, a0 = th + rng.random() * 0.4 - 0.2;
    const halfAlong = (dx, dz) => plaza ? Math.min(Math.abs(dx) > 1e-6 ? (pw / 2) / Math.abs(dx) : 1e9, Math.abs(dz) > 1e-6 ? (pl / 2) / Math.abs(dz) : 1e9) - 1 : 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * Math.PI * 2 / n + (rng.random() - 0.5) * 0.18, d = [Math.cos(a), Math.sin(a)], r0 = Math.max(0, halfAlong(d[0], d[1]));
      const runs = runsOf([[hc[0] + d[0] * r0, hc[1] + d[1] * r0], [hc[0] + d[0] * (eR + 4), hc[1] + d[1] * (eR + 4)]], i % 2 ? 0 : 12);
      const first = runs[0]; if (first && Math.hypot(first[0][0] + 0.5 - hc[0], first[0][1] + 0.5 - hc[1]) <= r0 + 4 && addRoad(first, i % 2 && n > 4 ? sec : 'main', '放射街', false)) i % 2 && n > 4 ? nSec++ : nMain++;
    }
    const r1 = (plaza ? Math.max(pw, pl) / 2 : 4) + S * 0.85;
    for (let r = r1, k = 0; tier !== 'hamlet' && r < eR - 6 && !(tier === 'village' && k >= 1); r += S, k++) {
      const N = Math.max(24, Math.ceil(Math.PI * 2 * r / 3)), ring = [];
      for (let i = 0; i <= N; i++) { const t = a0 + i / N * Math.PI * 2; ring.push([hc[0] + Math.cos(t) * r, hc[1] + Math.sin(t) * r]); }
      const runs = runsOf(ring, 0);
      let goodLen = 0; for (const run of runs) goodLen += lenOf(run);
      if (goodLen < Math.PI * 2 * r * 0.25) break;
      // a ring that closes on itself: the last run wraps into the first
      if (runs.length > 1) { const f = runs[0], l = runs[runs.length - 1]; if (Math.hypot(f[0][0] - l[l.length - 1][0], f[0][1] - l[l.length - 1][1]) <= 1.5) { runs[0] = l.concat(f); runs.pop(); } }
      for (const run of runs) {
        const closed = Math.hypot(run[0][0] - run[run.length - 1][0], run[0][1] - run[run.length - 1][1]) <= 1.5;
        const parts = closed ? [run.slice(0, run.length >> 1), run.slice((run.length >> 1) - 1)] : [run];
        for (const p of parts) if (addRoad(p, k ? lane : sec, '环路', true)) nSec++;
      }
    }
  } else if (style === 'linear') {
    for (const run of runsOf(line(hc, U), 12)) if (addRoad(run, 'main', '主街', false)) nMain++;
    const back = S * 0.95;
    for (const s of tier === 'hamlet' ? [] : [-1, 1]) { const c = [hc[0] + V[0] * back * s, hc[1] + V[1] * back * s]; for (const run of runsOf(line(c, U), 0)) if (addRoad(run, lane, '后巷', false, 24)) nSec++; }
    const J = tier === 'hamlet' ? -1 : Math.floor(eU / (S * 2));
    for (let j = -J; j <= J; j++) {
      if (!j && plaza) continue;
      const c = [hc[0] + U[0] * (j * S * 2 + jit()), hc[1] + U[1] * (j * S * 2 + jit())];
      for (const run of runsOf([[c[0] - V[0] * back, c[1] - V[1] * back], [c[0] + V[0] * back, c[1] + V[1] * back]], 0)) if (addRoad(run, lane, '横巷', false, 10)) nSec++;
    }
  } else {        // organic: a main street that follows the ground, branches growing off it
    const walk = (p, ang, maxLen, own, allowWet) => {
      const pts = [p], stepL = 5; let a = ang, len = 0, wetN = 0;
      while (len < maxLen) {
        let best = null;
        for (const t of [-0.42, -0.21, 0, 0.21, 0.42]) {
          const na = a + t, q2 = [pts[pts.length - 1][0] + Math.cos(na) * stepL, pts[pts.length - 1][1] + Math.sin(na) * stepL], x = Math.floor(q2[0]), z = Math.floor(q2[1]);
          const isWet = ok(x, z) && !blocked(x, z) && G.wet(x, z);
          if (!good(x, z) && !(allowWet && isWet && wetN < 2)) continue;
          const [px, pz] = pts[pts.length - 1].map(Math.floor);
          const dh = Math.abs(G.H(x, z) - (inG(px, pz) ? G.H(px, pz) : G.H(x, z)));
          const s = dh * 1.4 + Math.abs(t) * 1.2 + Math.abs(((na - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 1.6 + rng.random() * 0.9 + (isWet ? 2 : 0);
          if (!best || s < best.s) best = { s, q2, na, isWet };
        }
        if (!best) break;
        pts.push(best.q2); a = best.na; len += stepL; wetN = best.isWet ? wetN + 1 : 0;
        const k2 = Math.floor(best.q2[0]) + ',' + Math.floor(best.q2[1]);
        if (len > 10 && taken.has(k2) && taken.get(k2) !== own) break;          // reached another street: join it
      }
      return pts;
    };
    const hubP = [hc[0], hc[1]];
    const fwd = walk(hubP, th, eR * 2, -1, true), bwd = walk(hubP, th + Math.PI, eR * 2, -1, true);
    const mainPts = bwd.slice().reverse().concat(fwd.slice(1));
    const mains = runsOf(mainPts, 12).sort((p, q2) => q2.length - p.length);
    const mainRun = mains[0];
    if (mainRun && addRoad(mainRun, 'main', '主街', true)) nMain++;
    if (mainRun) {
      // branches every ~spacing along the main street, alternating sides (sometimes both)
      const dist = [0]; for (let i = 1; i < mainRun.length; i++) dist.push(dist[i - 1] + Math.hypot(mainRun[i][0] - mainRun[i - 1][0], mainRun[i][1] - mainRun[i - 1][1]));
      const Lm = dist[dist.length - 1], gaps = S * Dn.branch;
      let side = rng.random() < 0.5 ? 1 : -1, d0 = gaps * (0.5 + rng.random() * 0.4);
      const branchesAt = [];
      for (let d = d0; d < Lm - 8; d += gaps * (0.75 + rng.random() * 0.5)) {
        let i = 0; while (i < mainRun.length - 1 && dist[i] < d) i++;
        const a = mainRun[Math.max(0, i - 3)], b = mainRun[Math.min(mainRun.length - 1, i + 3)], tang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (plaza && mainRun[i][0] >= plaza.x0 - 2 && mainRun[i][0] <= plaza.x1 + 2 && mainRun[i][1] >= plaza.z0 - 2 && mainRun[i][1] <= plaza.z1 + 2) continue;
        for (const sd of rng.random() < 0.35 ? [1, -1] : [side]) branchesAt.push({ p: [mainRun[i][0] + 0.5, mainRun[i][1] + 0.5], ang: tang + sd * (Math.PI / 2 + (rng.random() - 0.5) * 0.7) });
        side = -side;
      }
      const sub = [];
      const maxBr = tier === 'hamlet' ? 2 : tier === 'village' ? 5 : 99;
      for (const br of branchesAt.slice(0, maxBr)) {
        const pts = walk(br.p, br.ang, (S * 1.2 + rng.random() * S * 1.6) * Dn.branch, roads.length, false);
        const run = runsOf(pts, 0)[0];
        const rd = run && addRoad(run, sec, '支路', true, 16);
        if (rd) { nSec++; if (run.length > 30 && rng.random() < 0.55) sub.push({ run, k: roads.length - 1 }); }
      }
      for (const { run } of tier === 'hamlet' ? [] : sub) {         // a lane off the middle of a long branch
        const i = run.length >> 1, a = run[Math.max(0, i - 3)], b = run[Math.min(run.length - 1, i + 3)], tang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const pts = walk([run[i][0] + 0.5, run[i][1] + 0.5], tang + (rng.random() < 0.5 ? 1 : -1) * Math.PI / 2, S * (0.8 + rng.random() * 0.8), roads.length, false);
        const r2 = runsOf(pts, 0)[0]; if (r2 && addRoad(r2, lane, '小巷', true, 14)) nSec++;
      }
    }
  }
  // ---- 3. every road reachable from every other one (directly, through others or across the square):
  // pieces that are cut off get a connecting lane along the easiest ground; pieces nothing can reach are dropped
  {
    const par = new Map(), find = i => { if (!par.has(i)) par.set(i, i); const p = par.get(i); if (p === i) return i; const r = find(p); par.set(i, r); return r; }, uni = (a, b) => { par.set(find(a), find(b)); };
    const PZ = -100;
    const near = new Map();
    const touch = (x, z, k) => { const kk = x + ',' + z; if (near.has(kk)) uni(near.get(kk), k); else near.set(kk, k); };
    runCells.forEach((run, k) => { const r = Math.floor(roads[k].width / 2); for (const [x, z] of run) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) touch(x + a, z + b, k); });
    if (plaza) for (let x = plaza.x0 - 1; x <= plaza.x1 + 1; x++) for (let z = plaza.z0 - 1; z <= plaza.z1 + 1; z++) touch(x, z, PZ);
    const comps = () => { const m = new Map(), ids = roads.map((_, i) => i); if (plaza) ids.push(PZ); for (const i of ids) { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r).push(i); } return [...m.values()]; };
    const sizeOf = c => c.reduce((s, i) => s + (i === PZ ? 1e6 : lenOf(runCells[i])), 0);
    let joined = 0, dropped = 0;
    for (let guard = 0; guard < 40; guard++) {
      const cs = comps(); if (cs.length <= 1) break;
      cs.sort((a, b) => sizeOf(b) - sizeOf(a));
      const main = new Set(cs[0]), owner = new Map();
      runCells.forEach((run, k) => { if (!main.has(k)) for (const [x, z] of run) owner.set(x + ',' + z, k); });
      // multi-source Dijkstra from the main network toward any other piece
      const dist = new Float64Array(bw * bl).fill(Infinity), prev = new Int32Array(bw * bl).fill(-1), hk = [], hv = [];
      const li = (x, z) => (x - bx0) + (z - bz0) * bw;
      const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
      const pop = () => { const v = hv[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l2 = 2 * i + 1, r2 = l2 + 1; let m = i; if (l2 < hk.length && hk[l2] < hk[m]) m = l2; if (r2 < hk.length && hk[r2] < hk[m]) m = r2; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return v; };
      const src = [];
      for (const k of cs[0]) { if (k === PZ) { for (let x = plaza.x0; x <= plaza.x1; x++) for (let z = plaza.z0; z <= plaza.z1; z++) src.push([x, z]); } else src.push(...runCells[k]); }
      for (const [x, z] of src) { const i = li(x, z); if (i >= 0 && i < dist.length && dist[i] > 0) { dist[i] = 0; push(0, i); } }
      const pass = (x, z) => ok(x, z) && !blocked(x, z);
      const roughAt = (x, z) => { const h = G.H(x, z); let m = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const X = x + a, Z = z + b; if (inG(X, Z) && !G.wet(X, Z)) m = Math.max(m, Math.abs(G.H(X, Z) - h)); } return m; };
      let hit = -1;
      while (hk.length) {
        const i = pop(), x = bx0 + i % bw, z = bz0 + ((i / bw) | 0);
        if (owner.has(x + ',' + z)) { hit = i; break; }
        const h0 = G.H(x, z);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = x + dx, nz = z + dz; if (!pass(nx, nz)) continue;
          const j = li(nx, nz), dh = Math.abs(G.H(nx, nz) - h0), c = (dx && dz ? 1.41 : 1) * (1 + 2.5 * dh + (dh >= 2 ? dh * dh * 4 : 0) + (roughAt(nx, nz) > 3 ? 25 : 0)) + (G.wet(nx, nz) ? 6 : 0), d = dist[i] + c;
          if (d < dist[j]) { dist[j] = d; prev[j] = i; push(d, j); }
        }
      }
      if (hit < 0) {               // the rest cannot be reached: drop those pieces
        const gone = new Set(); for (const c of cs.slice(1)) for (const k of c) if (k !== PZ) gone.add(k);
        dropped += gone.size;
        for (const k of [...gone].sort((a, b) => b - a)) { roads.splice(k, 1); runCells.splice(k, 1); }
        break;
      }
      const path = []; for (let i = hit; i >= 0; i = prev[i]) path.push([bx0 + i % bw, bz0 + ((i / bw) | 0)]);
      path.reverse();
      const target = owner.get(path[path.length - 1].join(','));
      const kindC = roads[target].kind === 'main' ? sec : lane;
      if (path.length >= 2 && addRoad(path, kindC, '连接路', path.length > 6, 0, 'dense')) { const nk = roads.length - 1; uni(nk, target); uni(nk, cs[0][0]); joined++; }
      else uni(target, cs[0][0]);              // already touching (a cell apart)
    }
    if (roughCut) report.push(`地形：${roughCut} 条路在深谷或陡坎处断开改走缓坡，避免高架和高挡土墙`);
    if (joined) report.push(`连通：补了 ${joined} 条连接路，所有道路互相连通`);
    else if (!dropped) report.push('连通：所有道路互相连通');
    if (dropped) report.push(`⚠ 连通：${dropped} 段路被水或地标隔开、接不上，已去掉`);
  }
  roads.forEach((rd, i) => { rd.name = `${rd.name} ${i + 1}`; });
  report.push(`道路：主街 ${nMain} 条、其他 ${nSec} 条（都可以在道路图层里逐条修改）`);
  if (!roads.length) report.push('⚠ 选区太窄或被水、地标占满，没有铺出道路');
  return { ok: true, roads, zones, report, hub: [hub.x, hub.z], theta: th };
}
