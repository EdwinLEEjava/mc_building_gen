
// ---------------------------------------------------------------------------------------------
// Parts for the other styles (German / Italian / Spanish). World coordinates throughout.
// ---------------------------------------------------------------------------------------------
// An octagonal spire on (cx, y0, cz): base radius R0, height H.
//   open  — Cologne: first an open octagonal stage (tall arches between eight corner piers, a gablet over each
//           cardinal face, a small pinnacle on every corner), then the pierced spire: eight ribs with crockets every
//           second row, solid bands every few rows, otherwise open faces with one mullion in the middle of each face
//   solid — a plain needle with crockets on the ribs
// mats: { frame, stairs, wall, slab } ; tip: block on the very top (e.g. gold for Milan's Madonnina)
function gothicSpire(S, mats, cx, y0, cz, R0, H, mode, mine, tip, drum = 0) {
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const st = (f, h = 'bottom') => B(mats.stairs, { facing: f, half: h, shape: 'straight', waterlogged: false });
  const post = () => B(mats.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' });
  const rod = () => B('end_rod', { facing: 'up' });
  const M = r => Math.round(r * 1.42);
  const oct = (dx, dz, r) => Math.max(Math.abs(dx), Math.abs(dz)) <= r && Math.abs(dx) + Math.abs(dz) <= M(r);
  const ringOf = r => { const c = []; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (oct(dx, dz, r) && !oct(dx, dz, r - 1)) c.push([dx, dz]); return c; };
  const isRib = (dx, dz, r) => { const ad = Math.abs(dx), az = Math.abs(dz), k = M(r) - r; return r <= 1 || (ad === r && az === k) || (az === r && ad === k); };
  const isMid = (dx, dz, r) => { const ad = Math.abs(dx), az = Math.abs(dz); return (ad === r && az === 0) || (az === r && ad === 0) || (ad + az === M(r) && Math.abs(ad - az) <= 1); };
  const crocket = (dx, dz, y) => { const ox = Math.sign(dx), oz = Math.sign(dz);
    if (ox && !S.has(cx + dx + ox, y, cz + dz)) put(cx + dx + ox, y, cz + dz, st(ox > 0 ? 'west' : 'east'));
    else if (oz && !S.has(cx + dx, y, cz + dz + oz)) put(cx + dx, y, cz + dz + oz, st(oz > 0 ? 'north' : 'south')); };
  let yb = y0;
  if (mode === 'open' && drum > 0) {                          // the open octagonal stage
    for (let i = 0; i < drum; i++) for (const [dx, dz] of ringOf(R0)) {
      const y = y0 + i, solid = i === 0 || i >= drum - 2 || isRib(dx, dz, R0);
      if (solid) put(cx + dx, y, cz + dz, B(mats.frame)); else if (isMid(dx, dz, R0) && i < drum - 3) put(cx + dx, y, cz + dz, post());
    }
    for (const [dx, dz] of ringOf(R0)) if (isRib(dx, dz, R0)) { put(cx + dx, y0 + drum, cz + dz, B(mats.frame)); put(cx + dx, y0 + drum + 1, cz + dz, post()); put(cx + dx, y0 + drum + 2, cz + dz, rod()); }   // corner pinnacles
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // a gablet over each cardinal face
      const k = M(R0) - R0;
      for (let t = -k; t <= k; t++) { const h = k - Math.abs(t); for (let j = 0; j <= h; j++) { const x = cx + (ux ? ux * R0 : t), z = cz + (uz ? uz * R0 : t); put(x, y0 + drum + j, z, j === h ? st(ux > 0 ? 'west' : ux < 0 ? 'east' : uz > 0 ? 'north' : 'south') : B(mats.frame)); } }
      put(cx + ux * R0, y0 + drum + k + 1, cz + uz * R0, rod());
    }
    for (let dx = -R0; dx <= R0; dx++) for (let dz = -R0; dz <= R0; dz++) if (oct(dx, dz, R0 - 1)) put(cx + dx, y0 + drum - 1, cz + dz, B(mats.slab, { type: 'top', waterlogged: false }));   // floor of the spire
    yb = y0 + drum; R0 = Math.max(2, R0 - 1);
  }
  let rPrev = -1;
  for (let i = 0; i < H; i++) {
    const y = yb + i, r = Math.max(0, Math.round(R0 * (1 - i / H))), step = rPrev > r, rp = rPrev; rPrev = r;
    if (step) for (const [dx, dz] of ringOf(rp)) if (!oct(dx, dz, r - 1)) put(cx + dx, y, cz + dz, B(mats.frame));   // a ledge where it steps in, joining ring to ring
    if (r === 0) { put(cx, y, cz, i < H - 2 ? B(mats.frame) : post()); continue; }
    const band = mode === 'open' && (i % 6 === 0 || i < 1 || step);
    for (const [dx, dz] of ringOf(r)) {
      const rib = isRib(dx, dz, r);
      if (mode === 'open' && !rib && !band) { if (isMid(dx, dz, r)) put(cx + dx, y, cz + dz, post()); continue; }   // open tracery: one mullion per face
      put(cx + dx, y, cz + dz, B(mats.frame));
      if (rib && i % 2 === 1) crocket(dx, dz, y);
    }
    if (mode !== 'open') for (let dx = -r + 1; dx <= r - 1; dx++) for (let dz = -r + 1; dz <= r - 1; dz++) if (oct(dx, dz, r - 1)) put(cx + dx, y, cz + dz, B(mats.frame));
  }
  const yt = yb + H;
  if (tip) { put(cx, yt, cz, B(tip)); put(cx, yt + 1, cz, rod()); return yt + 2; }
  put(cx, yt, cz, post()); put(cx, yt + 1, cz, rod());
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(cx + a, yt, cz + b, B('end_rod', { facing: a > 0 ? 'east' : a < 0 ? 'west' : b > 0 ? 'south' : 'north' }));   // a cross-shaped finial
  return yt + 2;
}
// Milan's crossing (tiburio): an octagonal drum with lancets and a pinnacle on every corner, a gallery, a second, smaller
// open stage, then a slender open needle with the golden statue on top
function gothicLantern(S, mats, cx, y0, cz, R, Hd, Hs, mine, pane) {
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const M = r => Math.round(r * 1.42);
  const oct = (dx, dz, r) => Math.max(Math.abs(dx), Math.abs(dz)) <= r && Math.abs(dx) + Math.abs(dz) <= M(r);
  const post = () => B(mats.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' });
  for (let i = 0; i < Hd; i++) for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    if (!oct(dx, dz, R)) continue;
    const ring = !oct(dx, dz, R - 1), y = y0 + i;
    if (!ring) { if (i === Hd - 1) put(cx + dx, y, cz + dz, B(mats.frame)); continue; }
    const win = i >= 2 && i <= Hd - 3 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) && (Math.abs(dx) === R || Math.abs(dz) === R);
    put(cx + dx, y, cz + dz, win ? pane(cx + dx, y, cz + dz, Math.abs(dx) === R ? 'z' : 'x') : B(mats.frame));
  }
  const yt = y0 + Hd;
  for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) if (oct(dx, dz, R + 1) && !oct(dx, dz, R)) put(cx + dx, yt - 1, cz + dz, B(mats.slab, { type: 'top', waterlogged: false }));   // cornice
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (oct(dx, dz, R) && !oct(dx, dz, R - 1)) {
    const ad = Math.abs(dx), az = Math.abs(dz), k = M(R) - R, corner = (ad === R && az === k) || (az === R && ad === k);
    if (corner) { for (let j = 0; j < 4; j++) put(cx + dx, yt + j, cz + dz, j < 2 ? B(mats.frame) : post()); put(cx + dx, yt + 4, cz + dz, B('end_rod', { facing: 'up' })); }   // corner pinnacles
    else if ((dx + dz) % 2 === 0) put(cx + dx, yt, cz + dz, post());   // gallery parapet
  }
  const R2 = Math.max(2, R - 3);                             // the second, open stage
  for (let i = 0; i < 6; i++) for (let dx = -R2; dx <= R2; dx++) for (let dz = -R2; dz <= R2; dz++) {
    if (!oct(dx, dz, R2) || oct(dx, dz, R2 - 1)) continue;
    const ad = Math.abs(dx), az = Math.abs(dz), k = M(R2) - R2, corner = (ad === R2 && az === k) || (az === R2 && ad === k);
    if (i === 0 || i >= 4 || corner) put(cx + dx, yt + i, cz + dz, B(mats.frame));
  }
  for (let dx = -R2; dx <= R2; dx++) for (let dz = -R2; dz <= R2; dz++) if (oct(dx, dz, R2 - 1)) { put(cx + dx, yt, cz + dz, B(mats.frame)); put(cx + dx, yt + 5, cz + dz, B(mats.frame)); }
  return gothicSpire(S, mats, cx, yt + 6, cz, 2, Hs, 'open', mine, 'gold_block');
}
// A screen front (Italian / Spanish): no towers; the front follows the section — a gable (or a flat parapet) over the
// nave, lower slopes over the aisles — divided by tall buttress piers that rise above the edge and end in pinnacles.
// A portal in every strip, a big traceried window over each. Frame: u = world z, d outward = -x (as the west front).
function gothicScreen(S, P, o) {
  const { hw, NA, AW, edge, NT, IT, OT, ridge, flat } = P;
  const mine = new Set();
  const K = gothicKit(S, o, (u, v, d) => [-d, v, u], GOTHIC_FRONT_DIR, 'z', mine);
  const { setD, ATT, put, st, FST } = K;
  const piers = [hw + 1]; if (NA === 2) piers.push(hw + AW + 1); piers.push(edge + 1);
  const isPier = au => piers.some(c => Math.abs(au - c) <= 1);
  const U = edge + 2, us = []; for (let u = -U; u <= U; u++) us.push(u);
  const topAt = au => {                                                   // the front's top edge over each strip
    if (au <= hw) return flat ? NT + 3 : NT + 3 + Math.round((hw + 0.5 - au) * (ridge - NT) / (hw + 0.5));
    if (au <= hw + AW) return flat ? IT + 3 : IT + 3 + Math.round((hw + AW + 0.5 - au) * 0.5);
    return flat ? OT + 3 : OT + 3 + Math.round((edge + 0.5 - au) * 0.5);
  };
  for (const u of us) { const au = Math.abs(u); const t = isPier(au) ? topAt(Math.max(0, au - 2)) + 4 : topAt(au); for (let v = 0; v <= t; v++) setD(u, v, isPier(au) ? (v < t * 0.4 ? 3 : v < t * 0.75 ? 2 : 1) : 0, isPier(au) ? 'frame' : 'infill'); }
  // strips: centre (nave), inner aisles, outer aisles
  const strips = [[0, hw - 1]]; for (const s of [-1, 1]) { strips.push([s * (hw + 2 + ((AW - 3) >> 1)), (AW - 3) >> 1]); if (NA === 2) strips.push([s * (hw + AW + 2 + ((edge - hw - AW - 3) >> 1)), (edge - hw - AW - 3) >> 1]); }
  let portals = 0, wins = 0;
  for (const [uc, half] of strips) {
    if (half < 1) continue;
    const w = Math.max(3, (2 * half - 1) | 1), hs = Math.max(4, Math.round(w * 0.75)), ord = Math.max(1, Math.min(4, (w - 3) >> 1));
    const ptop = gothicArchTop(w, hs) + (w >> 1) + 4;
    K.portal(uc, w, hs, ord, 2, au => isPier(Math.abs(au)), Math.min(ptop, topAt(Math.abs(uc)) - 6)); portals++;
    const v0 = Math.min(ptop, topAt(Math.abs(uc)) - 6) + 2, lw = Math.max(3, Math.min(9, (2 * half - 1) | 1)), lhs = topAt(Math.abs(uc)) - 4 - Math.floor(Math.sqrt(3) * lw / 2);
    if (lhs - v0 >= 4) { K.lancet(uc, lw, v0, lhs, lw >= 7 ? 2 : 1, 0, topAt(Math.abs(uc)) - 1); wins++; }
  }
  K.fill();
  for (const u of us) {                                                   // the top edge: crockets on slopes, a parapet on flats
    const au = Math.abs(u); if (isPier(au)) continue;
    const t = topAt(au), tn = topAt(Math.abs(u) + 1);
    if (flat || t === tn) put(u, t + 1, 0, au % 2 ? K.post() : B(o.slab, { type: 'bottom', waterlogged: false }));
    else if (au % 2 === 1) put(u, t + 1, 0, st(FST, u < 0 ? 'south' : 'north'));
  }
  for (const f of ATT) f();
  for (const c of piers) for (const s of [-1, 1]) {
    const u = s * c, t = topAt(Math.max(0, c - 2)) + 4;
    for (let v = 6; v + 4 < t - 4; v += 9) { for (let y = v; y < v + 4; y++) put(u, y, 1, 'minecraft:air'); K.statue(u, v, 0); put(u, v + 4, 1, st(FST, 'east', 'top')); }
    K.pinnacle(u, t + 1, 1, 4, true);
  }
  if (!flat) { const t = topAt(0); put(0, t + 1, 0, K.post()); put(0, t + 2, 0, K.post()); put(0, t + 3, 0, B('end_rod', { facing: 'up' })); }
  return { mine, statues: K.statues, pins: K.pins, portals, windows: wins, width: 2 * U + 1 };
}
// Seville's Giralda: a square brick shaft with a lattice (sebka) of raised posts on its upper part, a belfry with arches,
// then two stepped stages and a small cap with a weathervane. (x0, z0) = the shaft's corner, n = width.
function gothicCampanile(S, o, x0, z0, n, H, mine) {
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const brick = o.brick || 'bricks', trim = o.frame;
  const shaft = Math.round(H * 0.66), bel = Math.round(H * 0.12);
  const ring = (x, z, a, w) => x === a || z === a || x === a + w - 1 || z === a + w - 1;
  for (let y = 0; y < shaft; y++) for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const x = x0 + i, z = z0 + k, edge = i === 0 || k === 0 || i === n - 1 || k === n - 1;
    if (!edge) { if (y === 0 || y % 12 === 0) put(x, y, z, B(brick)); continue; }
    const corner = (i === 0 || i === n - 1) && (k === 0 || k === n - 1);
    put(x, y, z, B(corner || y === 0 ? trim : brick));
    // the lattice: a diamond net of brick posts standing out from the upper two-thirds of each face
    if (!corner && y > shaft * 0.35 && y < shaft - 2) {
      const u = i === 0 || i === n - 1 ? k : i, ox = i === 0 ? -1 : i === n - 1 ? 1 : 0, oz = k === 0 ? -1 : k === n - 1 ? 1 : 0;
      if (u >= 2 && u <= n - 3 && ((u + y) % 4 === 0 || (u - y + 400) % 4 === 0)) put(x + ox, y, z + oz, B(o.brickWall || 'brick_wall', { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' }));
      if (u === (n >> 1) && y % 9 === 4) { put(x, y, z, 'minecraft:air'); put(x, y + 1, z, 'minecraft:air'); }   // small windows up the middle
    }
  }
  for (let y = shaft; y < shaft + bel; y++) for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    if (!ring(x0 + i, z0 + k, x0, n) || !ring(i, k, 0, n)) continue;
    const u = i === 0 || i === n - 1 ? k : i, arch = u >= 2 && u <= n - 3 && u !== (n >> 1) && y >= shaft + 1 && y <= shaft + bel - 3;
    if (!arch) put(x0 + i, y, z0 + k, B(trim));
  }
  for (let i = -1; i <= n; i++) for (let k = -1; k <= n; k++) if (i === -1 || k === -1 || i === n || k === n) { put(x0 + i, shaft + bel, z0 + k, B(o.slab, { type: 'top', waterlogged: false })); if ((i + k) % 2 === 0) put(x0 + i, shaft + bel + 1, z0 + k, B(o.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' })); }
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) put(x0 + i, shaft + bel, z0 + k, B(trim));
  put(x0 + (n >> 1), shaft + 1, z0 + (n >> 1), B('bell', { attachment: 'floor', facing: 'north', powered: false }));
  // stepped stages
  let y = shaft + bel + 1, w = n - 2, a = 1;
  for (const hh of [Math.round(H * 0.09), Math.round(H * 0.07)]) {
    if (w < 3) break;
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) for (let k = 0; k < w; k++) {
      const e = i === 0 || k === 0 || i === w - 1 || k === w - 1; if (!e) continue;
      const mid = (i === (w >> 1) || k === (w >> 1)) && j >= 1 && j <= hh - 2;
      if (!mid) put(x0 + a + i, y + j, z0 + a + k, B(trim));
    }
    for (let i = 0; i < w; i++) for (let k = 0; k < w; k++) put(x0 + a + i, y + hh, z0 + a + k, B(trim));
    y += hh + 1; w -= 2; a += 1;
  }
  const cx = x0 + (n >> 1), cz = z0 + (n >> 1);
  put(cx, y, cz, B(trim)); put(cx, y + 1, cz, B('gold_block')); put(cx, y + 2, cz, B('lightning_rod', { facing: 'up', powered: false, waterlogged: false }));
  return y + 3;
}
// The court of oranges: a low arcaded wall round a gravel court, rows of small trees, a fountain in the middle.
function gothicCourt(S, o, x0, x1, z0, z1, mine) {
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const leaves = B('azalea_leaves', { distance: 1, persistent: true, waterlogged: false });
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const e = x === x0 || x === x1 || z === z0 || z === z1;
    put(x, 0, z, B(e ? o.frame : (x + z) % 2 ? 'smooth_sandstone' : 'cut_sandstone'));
    if (!e) continue;
    const along = z === z0 || z === z1 ? x - x0 : z - z0;
    const door = (x === ((x0 + x1) >> 1) && (z === z0 || z === z1)) || (z === ((z0 + z1) >> 1) && x === x0);
    for (let y = 1; y <= 4; y++) { if (door && y <= 3) continue; put(x, y, z, B(along % 3 === 0 || y === 4 ? o.frame : y === 3 ? o.frame : 'minecraft:air' === '' ? '' : o.frame)); }
    if (along % 3 !== 0 && !door) { put(x, 1, z, 'minecraft:air'); put(x, 2, z, 'minecraft:air'); }     // an open arcade
    put(x, 5, z, (x + z) % 2 ? B(o.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' }) : B(o.slab, { type: 'bottom', waterlogged: false }));
  }
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  for (let x = x0 + 3; x <= x1 - 3; x += 4) for (let z = z0 + 3; z <= z1 - 3; z += 4) {
    if (Math.abs(x - cx) <= 2 && Math.abs(z - cz) <= 2) continue;
    put(x, 1, z, B('oak_log', { axis: 'y' })); put(x, 2, z, B('oak_log', { axis: 'y' }));
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { put(x + a, 3, z + b, leaves); if (!a || !b) put(x + a, 2, z + b, a || b ? leaves : B('oak_log', { axis: 'y' })); }
    put(x, 4, z, leaves);
  }
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(cx + a, 1, cz + b, a || b ? B(o.frame) : B('water', { level: 0 }));   // a basin with one source in the middle
  put(cx, 0, cz, B(o.frame));
}
// A square tower over the crossing (Romanesque; English Gothic, e.g. Lincoln, Salisbury). Four faces built with the
// facade kit (so windows follow the building's arch shape): corner piers, two windows on each face above the roofs,
// a cornice and an open parapet. With spireH > 0 an octagonal stone spire stands inside the parapet.
// x0..x1 × -hw..hw: the crossing square; v0: where the tower walls start (on the nave wall top); vWin: lowest sill
// (above the ridge); v1: the tower top. Returns the highest y used.
function gothicCrossingTower(S, o, x0, x1, hw, v0, vWin, v1, spireH, mine) {
  const faces = [
    [(u, v, d) => [u, v, hw + d], { in: 'north', out: 'south', un: 'west', up: 'east' }, 'x', x0, x1],
    [(u, v, d) => [u, v, -(hw + d)], { in: 'south', out: 'north', un: 'west', up: 'east' }, 'x', x0, x1],
    [(u, v, d) => [x1 + d, v, u], { in: 'west', out: 'east', un: 'north', up: 'south' }, 'z', -hw, hw],
    [(u, v, d) => [x0 - d, v, u], { in: 'east', out: 'west', un: 'north', up: 'south' }, 'z', -hw, hw],
  ];
  const n = x1 - x0 + 1, w = Math.max(3, Math.min(5, ((n - 5) >> 1) | 1)), AT0 = gothicArchTop(w, 0), hs = v1 - 3 - AT0;
  for (const [W, dir, ax, a0, a1] of faces) {
    const K = gothicKit(S, { ...o, thick: 1, backMax: -1, clear: false }, W, dir, ax, mine);
    const us = []; for (let u = a0; u <= a1; u++) us.push(u);
    const corner = u => u <= a0 + 1 || u >= a1 - 1;
    for (let v = v0; v <= v1; v++) for (const u of us) K.setD(u, v, corner(u) ? 1 : 0, corner(u) ? 'frame' : 'infill');
    const mid = (a0 + a1) >> 1, q = (a1 - a0) / 4, ucs = n >= 21 ? [Math.round(a0 + q), Math.round(a1 - q)] : [mid];   // two windows only where they leave solid corners
    if (hs - vWin >= 3) for (const uc of ucs) K.lancet(uc, w, vWin, hs, 1, 0, v1 - 1);
    K.fill();
    const rows = [vWin - 1, v1]; rows.parapet = [v1];
    K.courses(rows, us, () => false);
    for (const f of K.ATT) f();
  }
  for (let x = x0 + 1; x < x1; x++) for (let z = -hw + 1; z < hw; z++) { S.set(x, v1, z, B(o.frame)); mine.add(x + ',' + v1 + ',' + z); }   // the roof of the tower
  let top = v1 + 2;
  if (spireH > 0) top = gothicSpire(S, { frame: o.frame, stairs: o.stairs, slab: o.slab, wall: o.wall }, (x0 + x1) >> 1, v1 + 1, 0, Math.max(2, hw - 2), spireH, 'solid', mine, null);
  return top;
}
