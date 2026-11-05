// ---------------------------------------------------------------------------------------------
// Towers that stand anywhere (not only as the twin west towers of the Gothic front), and their roofs.
// Romanesque churches put their towers at the west (one broad westwork tower), at the crossing (often octagonal) and
// in pairs beside the choir (Speyer, Worms, Mainz); their roofs are low pyramids or Rhenish helms (four gables with a
// diamond-faced roof between them) rather than Gothic spires. World coordinates; mine collects what we wrote.
// ---------------------------------------------------------------------------------------------
const TOWER_ROOFS = { helm: '莱茵式菱形屋顶（四面山墙）', pyramid: '四坡尖顶', spire: '石尖塔', flat: '平顶 + 栏杆' };
// a square (or oblong) tower x0..x1 × z0..z1 from v0 to v1: four faces built with the facade kit (corner pilasters,
// a window on each face per storey above vWin, string courses, a Lombard band under each course when o.lombard)
function towerShaft(S, o, x0, x1, z0, z1, v0, vWin, v1, mine) {
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  const faces = [
    [(u, v, d) => [u, v, z1 + d], { in: 'north', out: 'south', un: 'west', up: 'east' }, 'x', x0, x1],
    [(u, v, d) => [u, v, z0 - d], { in: 'south', out: 'north', un: 'west', up: 'east' }, 'x', x0, x1],
    [(u, v, d) => [x1 + d, v, u], { in: 'west', out: 'east', un: 'north', up: 'south' }, 'z', z0, z1],
    [(u, v, d) => [x0 - d, v, u], { in: 'east', out: 'west', un: 'north', up: 'south' }, 'z', z0, z1],
  ];
  const storey = 9, rows = []; for (let v = vWin - 1; v < v1 - 3; v += storey) rows.push(v);
  rows.push(v1); rows.parapet = [];
  let nw = 0;
  for (const [W, dir, ax, a0, a1] of faces) {
    const K = gothicKit(S, { ...o, thick: 1, backMax: -1, clear: false }, W, dir, ax, mine);
    const us = []; for (let u = a0; u <= a1; u++) us.push(u);
    const corner = u => u <= a0 + 1 || u >= a1 - 1, n = a1 - a0 + 1;
    for (let v = v0; v <= v1; v++) for (const u of us) K.setD(u, v, corner(u) ? 1 : 0, v <= v0 + 1 ? 'frame' : corner(u) ? 'frame' : 'infill');
    const w = n >= 11 ? 5 : 3, mid = (a0 + a1) >> 1, ucs = n >= 15 ? [mid - (n >> 2), mid + (n >> 2)] : [mid];
    for (const v of rows.slice(0, -1)) {                            // one window (or a pair) per storey
      const top = Math.min(v + storey - 1, v1 - 1), hs = top - 1 - gothicArchTop(w, 0);
      if (hs - (v + 2) >= 2) for (const uc of ucs) { K.lancet(uc, w, v + 2, hs, 1, 0, top); nw++; }
    }
    K.fill();
    K.courses(rows, us, () => false);
    if (o.lombard) for (const v of rows) K.lombard(us, v - 1, u => corner(u));
    for (const f of K.ATT) f();
  }
  for (let x = x0 + 1; x < x1; x++) for (let z = z0 + 1; z < z1; z++) { S.set(x, v1, z, B(o.frame)); mine.add(x + ',' + v1 + ',' + z); }
  return { cx, cz, windows: nw };
}
// a roof on a square tower top at y0 over x0..x1 × z0..z1. kind: helm | pyramid | spire | flat. m: { block, stairs, slab, wall }
function towerRoof(S, m, o, x0, x1, z0, z1, y0, kind, mine) {
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const st = (f, h = 'bottom') => B(m.stairs, { facing: f, half: h, shape: 'straight', waterlogged: false });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.min(x1 - x0, z1 - z0) / 2;
  let top = y0;
  if (kind === 'flat') {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) put(x, y0 + 1, z, (x + z) % 2 ? B(o.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' }) : B(o.frame));
    return y0 + 2;
  }
  if (kind === 'spire') return gothicSpire(S, { frame: o.frame, stairs: o.stairs, slab: o.slab, wall: o.wall }, Math.round(cx), y0 + 1, Math.round(cz), Math.max(2, Math.floor(r) - 1), Math.round(r * 6), 'solid', mine, null);
  if (kind === 'pyramid') {                         // steep square pyramid: stairs on the slopes, blocks on the hips
    const k = 2;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const dx = x - cx, dz = z - cz, e = Math.max(Math.abs(dx), Math.abs(dz)), h = y0 + 1 + Math.round(k * (r - e));
      for (let y = y0 + 1; y < h; y++) put(x, y, z, B(m.block));
      const hip = Math.abs(Math.abs(dx) - Math.abs(dz)) < 0.6;
      put(x, h, z, hip || e < 0.6 ? B(m.block) : st(Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south')));
      top = Math.max(top, h);
    }
    put(Math.round(cx), top + 1, Math.round(cz), B(o.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' }));
    put(Math.round(cx), top + 2, Math.round(cz), B('lightning_rod', { facing: 'up', powered: false, waterlogged: false }));
    return top + 3;
  }
  // Rhenish helm: a gable on each face (wall), the roof between them diamond-faced: its height falls with |dx| + |dz|,
  // so the gable peaks sit at the face middles and the eaves at the corners
  const k = 1.4;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const dx = x - cx, dz = z - cz, h = y0 + 1 + Math.round(k * (2 * r - Math.abs(dx) - Math.abs(dz)));
    const face = x === x0 || x === x1 || z === z0 || z === z1;
    for (let y = y0 + 1; y < h; y++) put(x, y, z, face ? B(o.frame) : B(m.block));
    put(x, h, z, face ? B(o.frame) : B(m.block));
    if (!face) put(x, h + 1, z, B(m.slab, { type: 'bottom', waterlogged: false }));
    top = Math.max(top, h + 1);
  }
  for (const [x, z] of [[Math.round(cx), z0], [Math.round(cx), z1], [x0, Math.round(cz)], [x1, Math.round(cz)]]) {   // a cross-shaped finial on each gable peak
    const h = y0 + 1 + Math.round(k * (2 * r - Math.abs(x - cx) - Math.abs(z - cz)));
    put(x, h + 1, z, B(o.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' }));
  }
  put(Math.round(cx), top + 1, Math.round(cz), B('lightning_rod', { facing: 'up', powered: false, waterlogged: false }));
  return top + 2;
}
// an octagonal tower over the crossing (Speyer, Worms): eight walls of radius R from v0 to v1, a round-headed window on
// the four main faces, a Lombard band, an octagonal pyramid roof. Returns the top.
function octagonTower(S, o, m, cx, cz, R, v0, v1, mine, pane) {
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const M = r => Math.round(r * 1.42), oct = (dx, dz, r) => Math.max(Math.abs(dx), Math.abs(dz)) <= r && Math.abs(dx) + Math.abs(dz) <= M(r);
  const st = (f, h = 'bottom') => B(o.stairs, { facing: f, half: h, shape: 'straight', waterlogged: false });
  const wTop = v1 - 3, wBot = Math.max(v0 + 2, wTop - 6);
  for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) {
    if (!oct(dx, dz, R) || oct(dx, dz, R - 1)) continue;
    const x = cx + dx, z = cz + dz, axial = (dx === 0 && Math.abs(dz) === R) || (dz === 0 && Math.abs(dx) === R) || (Math.abs(dx) <= 1 && Math.abs(dz) === R) || (Math.abs(dz) <= 1 && Math.abs(dx) === R);
    for (let y = v0; y <= v1; y++) {
      const win = axial && y >= wBot && y <= wTop - (Math.abs(dx) + Math.abs(dz) > R ? 1 : 0);   // the side lights stop a row lower: a round head
      put(x, y, z, win ? pane(x, y, z, Math.abs(dz) === R ? 'x' : 'z') : B(o.frame));
    }
    const ox = Math.sign(dx) * (Math.abs(dx) === R ? 1 : 0), oz = Math.sign(dz) * (Math.abs(dz) === R ? 1 : 0);   // a cornice all round
    if ((ox || oz) && !S.has(x + ox, v1, z + oz)) put(x + ox, v1, z + oz, st(ox > 0 ? 'west' : ox < 0 ? 'east' : oz > 0 ? 'north' : 'south', 'top'));
  }
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (oct(dx, dz, R - 1)) put(cx + dx, v1, cz + dz, B(o.frame));
  return gothicSpire(S, { frame: m.block, stairs: m.stairs, slab: m.slab, wall: o.wall }, cx, v1 + 1, cz, R, Math.round(R * 1.6), 'solid', mine, null);
}
