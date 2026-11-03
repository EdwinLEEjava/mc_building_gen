// ---------------------------------------------------------------------------------------------
// Gothic facades (精细立面). A face has its own frame: u across, v up (= y), d depth: 0 = the wall plane,
// + outward, - inward. Every cell (u, v) has a front-surface depth D(u, v) and a role (frame / infill / niche /
// door / glass / void). A cell is filled from its own depth back to the deepest of its neighbours (so recesses
// get side walls), then edges are moulded automatically: the top edge of anything standing proud becomes a
// sloped stair (weathering), the underside an upside-down stair (arch rims, cornices). Fixed parts go on last:
// statues, pinnacles, crockets, finials. The same kit builds the west front and the towers' outer sides.
// Layout follows the cathedral: the centre strip is the nave, the tower strips stand over the aisles, with a
// buttress pier between them and one outside each tower. Storey heights come from the strip widths, so any
// nave / aisle width gives a consistent front; parts that do not fit shrink (fewer arch orders) or drop.
// gothicFrontLayout(...) runs first so the cathedral can raise its towers to the facade's tower top.
// ---------------------------------------------------------------------------------------------
function gothicArchIn(du, v, w, v0, hs) {           // inside a pointed (equilateral) arch: width w, springing at hs
  const a = w / 2, x = Math.abs(du);
  if (x > a - 0.5 || v < v0) return false;
  if (v <= hs) return true;
  return v + 0.5 <= hs + Math.sqrt(Math.max(0, w * w - (x + a) * (x + a))) + 0.35;
}
const gothicArchTop = (w, hs) => hs + Math.floor(Math.sqrt(3) * w / 2);
// facade materials per wall style (frame, stairs, slab, wall post, statue head, capital, niche back)
const GOTHIC_FACADE_MATS = {
  white: { frame: 'polished_diorite', stairs: 'polished_diorite_stairs', slab: 'polished_diorite_slab', wall: 'diorite_wall', head: 'calcite', capital: 'chiseled_stone_bricks', niche: 'smooth_stone' },
  stone: { frame: 'stone_bricks', stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', wall: 'stone_brick_wall', head: 'polished_andesite', capital: 'chiseled_stone_bricks', niche: 'cracked_stone_bricks' },
  rough: { frame: 'stone_bricks', stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', wall: 'cobblestone_wall', head: 'polished_andesite', capital: 'chiseled_stone_bricks', niche: 'mossy_cobblestone' },
  sandstone: { frame: 'smooth_sandstone', stairs: 'smooth_sandstone_stairs', slab: 'smooth_sandstone_slab', wall: 'sandstone_wall', head: 'chiseled_sandstone', capital: 'chiseled_sandstone', niche: 'sandstone' },
  marble: { frame: 'quartz_block', stairs: 'quartz_stairs', slab: 'quartz_slab', wall: 'diorite_wall', head: 'calcite', capital: 'chiseled_quartz_block', niche: 'smooth_quartz' },
  warm: { frame: 'cut_sandstone', stairs: 'sandstone_stairs', slab: 'cut_sandstone_slab', wall: 'sandstone_wall', head: 'chiseled_sandstone', capital: 'chiseled_sandstone', niche: 'smooth_sandstone' },
  dark: { frame: 'polished_deepslate', stairs: 'polished_deepslate_stairs', slab: 'polished_deepslate_slab', wall: 'polished_deepslate_wall', head: 'deepslate_tiles', capital: 'chiseled_deepslate', niche: 'deepslate_tiles' },
};
function gothicFrontLayout({ hw, edge, NT, ridge, TT }) {
  const cw = hw, b1 = hw + 1, b2 = edge + 1, t0 = hw + 4, t1 = edge, th = (t1 - t0) >> 1, tc = t0 + th, U = edge + 3;
  const odd = n => n | 1;
  const wc = odd(2 * cw - 1), oc = Math.max(1, Math.min(6, (wc - 5) >> 1)), hc = Math.max(5, Math.round(wc * 0.6));
  const ws = odd(Math.max(5, 2 * th - 1)), os = Math.max(1, Math.min(4, (ws - 3) >> 1)), hsS = Math.max(4, Math.round(ws * 0.8));
  const H_PORT = Math.max(gothicArchTop(wc, hc), gothicArchTop(ws, hsS)) - 2;
  const H_GAL = H_PORT + 6, Rr = Math.max(2, cw - 2.4), vc = Math.round(H_GAL + Rr + 4), H_ROSE = Math.round(vc + Rr + 3);
  const H_KING = H_ROSE + 9, gh = Math.round((cw + 0.5) * 1.35), gBase = Math.max(H_KING, ridge + 2 - gh);
  const top = Math.max(TT, gBase + gh + 16, H_KING + 30);
  return { cw, b1, b2, t0, t1, th, tc, U, wc, oc, hc, ws, os, hsS, H_PORT, H_GAL, Rr, vc, H_ROSE, H_KING, gh, gBase, top };
}
// the kit: one face. W(u, v, d) -> [x, y, z]; dir = world facings for inward / outward / -u / +u; ax = pane axis
function gothicKit(S, o, W, dir, ax, mine) {
  const FST = o.stairs;
  const st = (m, f, half = 'bottom') => B(m, { facing: f, half, shape: 'straight', waterlogged: false });
  const post = () => B(o.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none' });
  const rod = () => B('end_rod', { facing: 'up' });
  const put = (u, v, d, s) => { const [x, y, z] = W(u, v, d); S.set(x, y, z, s); mine.add(x + ',' + y + ',' + z); };
  const D = new Map(), R = new Map(), HOLE = new Map(), LOCK = new Set(), ATT = [];
  const k2 = (u, v) => u + ',' + v;
  const getD = (u, v) => D.get(k2(u, v));
  const setD = (u, v, d, role, lock) => { const k = k2(u, v); if (LOCK.has(k) && !lock) return; D.set(k, d); R.set(k, role); if (lock) LOCK.add(k); };
  const K = { st, post, rod, put, D, R, HOLE, ATT, k2, getD, setD, FST, dir, statues: 0, pins: 0 };
  K.statue = (u, v, d) => { if (o.statues === false) return; put(u, v, d, post()); put(u, v + 1, d, post()); put(u, v + 2, d, B(o.head)); K.statues++; };
  K.fill = () => {
    for (const [k, d] of D) {
      const [u, v] = k.split(',').map(Number), role = R.get(k), hole = HOLE.get(k);
      if (hole === 'void') { for (let dd = Math.max(d, 1); dd >= -5; dd--) put(u, v, dd, 'minecraft:air'); continue; }   // open right through (also through the tower wall behind)
      if (o.clear !== false) for (let dd = d + 1; dd <= d + 6; dd++) { const [x, y, z] = W(u, v, dd); if (S.has(x, y, z)) S.set(x, y, z, null); }   // clear what the building left in front of this cell (roof ends, old walls)
      let back = Math.min(d - (o.thick ?? 2), o.backMax ?? -3);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = getD(u + a, v + b); if (n !== undefined && n < back) back = n; }
      for (let dd = back; dd <= d; dd++) {
        let s;
        if (hole === 'glass') { if (dd === d) s = o.pane(...W(u, v, dd), ax); else if (dd === d - 1) s = B(o.dark || 'gray_concrete'); else continue; }   // pane, a dark block right behind it (reads as a window, stays joined)
        else if (hole === 'door') s = dd === d ? B(o.door) : B(o.doorBack);
        else s = role === 'infill' ? o.infill(...W(u, v, dd)) : role === 'niche' ? B(o.niche) : role === 'checker' ? B(((u + v) & 1) ? o.checkA || o.frame : o.checkB || o.niche) : B(o.frame);
        put(u, v, dd, s);
      }
    }
    for (const [k, d] of D) {                         // automatic mouldings
      const [u, v] = k.split(',').map(Number); if (HOLE.has(k)) continue;
      const up = getD(u, v + 1), dn = getD(u, v - 1);
      if (up === undefined || up < d) { if (!HOLE.has(k2(u, v + 1))) put(u, v, d, st(FST, dir.in)); }
      else if (v > 1 && dn !== undefined && dn < d && !HOLE.has(k2(u, v - 1))) put(u, v, d, st(FST, dir.in, 'top'));
    }
  };
  K.courses = (rows, us, skip) => { for (const v of rows) for (const u of us) {   // string courses, open parapets on the listed rows
    const d = getD(u, v); if (d === undefined || skip(u) || HOLE.has(k2(u, v))) continue;
    put(u, v, d + 1, st(FST, dir.in, 'top'));
    if (rows.parapet.includes(v)) put(u, v + 1, d + 1, Math.abs(u) % 2 ? post() : B(o.slab, { type: 'bottom', waterlogged: false }));
  } };
  K.pinnacle = (u, v, d, h, big) => {                // square shaft (pierced) -> corner pinnacles + stair cap -> needle with crockets -> finial
    if (o.pinnacles === false) return;
    // it must stand on something: under every cell of its foot, carry a stone column down to the nearest block (at most
    // 6); a big one that cannot be carried becomes a small one; a small one that cannot is left out
    const solidAt = (a, y, b) => { const t = S.get(...W(u + a, y, d + b)); return !!t && t !== 'minecraft:air' && !/_slab\[.*type=bottom/.test(t); };   // a bottom slab is only half a block: it leaves a gap
    const footOk = rr => { for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) { let y = v - 1, k = 0; while (k < 7 && !solidAt(a, y, b)) { y--; k++; } if (k >= 7) return false; } return true; };
    if (big && !footOk(1)) big = false;
    if (!big && !footOk(0)) return;
    { const rr = big ? 1 : 0; for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) for (let y = v - 1; !solidAt(a, y, b); y--) put(u + a, y, d + b, B(o.frame)); }
    const r = big ? 1 : 0; K.pins++;
    for (let y = 0; y < h; y++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      const open = r && (!a !== !b) && y >= 1 && y <= h - 2 && h >= 4;
      put(u + a, v + y, d + b, open ? 'minecraft:air' : B(o.frame));
    }
    let y = v + h;
    const fac = (a, b) => b > 0 ? dir.in : b < 0 ? dir.out : a > 0 ? dir.un : dir.up;
    if (r) {
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { put(u + a, y, d + b, post()); put(u + a, y + 1, d + b, rod()); }
      for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) put(u + a, y, d + b, st(FST, fac(a, b)));
      put(u, y, d, B(o.frame)); y++;
    }
    const n = big ? 5 : 2;
    for (let i = 0; i < n; i++) put(u, y + i, d, big && i === 0 ? B(o.frame) : post());
    put(u, y + n, d, rod());
  };
  K.lancet = (uc, w, v0, hs, orders, base, vMax = Infinity, free = false) => {   // free: the gablet may rise above the wall (into the eaves)     // paired lancets under an oculus, splayed reveals, a gablet on top
    const IN = gothicArchIn, AT = gothicArchTop;
    for (let v = v0; v <= AT(w, hs) + 1; v++) for (let du = -(w >> 1); du <= w >> 1; du++) for (let k = 0; k <= orders; k++) if (IN(du, v, w - 2 * k, v0, hs)) setD(uc + du, v, base - 1 - k, 'frame');
    const iw = w - 2 * orders, dIn = base - 1 - orders, ia = iw >> 1;
    for (let v = v0; v <= AT(iw, hs); v++) for (let du = -ia; du <= ia; du++) {
      if (!IN(du, v, iw, v0, hs)) continue;
      const two = ia >= 2, sub = du < 0 ? -1 : 1, sd = du - sub * (ia + 1) / 2;
      const inSub = two ? (ia >= 4 ? du !== 0 && IN(sd, v, ia, v0 + 1, hs - 3) : v >= v0 + 1 && (du !== 0 || v > hs + ia)) : v <= hs;   // with no room for an oculus: Y-tracery, one mullion that stops below the head
      const rr = Math.hypot(du, v - (hs + 4)), oc = ia >= 4 && rr >= 1.6 && rr <= 3.2;   // an oculus only where a real ring fits (glass ring round a stone hub; smaller ones read as a cross)
      if (inSub || oc) { setD(uc + du, v, dIn - 1, 'glass'); HOLE.set(k2(uc + du, v), 'glass'); }
    }
    const gb = AT(w, hs) - 1, a = w >> 1;
    for (let v = gb; v <= Math.min(gb + a + 2, vMax); v++) for (let du = -a; du <= a; du++) if (v <= gb + a + 2 - Math.round(Math.abs(du) * (a + 2) / a) && (free || getD(uc + du, v) !== undefined) && !HOLE.has(k2(uc + du, v))) setD(uc + du, v, Math.max(getD(uc + du, v) ?? base + 1, base + 1), 'frame');
    if (gb + a + 4 <= vMax) ATT.push(() => { put(uc, gb + a + 3, base + 1, post()); put(uc, gb + a + 4, base + 1, rod()); });
  };
  K.portal = (uc, w, hs, orders, base, isBut, vMax = Infinity) => {   // vMax: the gable and its finial stay below this row
    const a = w >> 1, top = gothicArchTop(w, hs), gTop = Math.max(top + 1, Math.min(top + a + 6, vMax - 3));
    for (let v = 0; v <= gTop; v++) for (let du = -a - 1; du <= a + 1; du++) {
      const u = uc + du, au = Math.abs(du);
      if (isBut(Math.abs(u), u)) continue;
      const inGable = v >= hs && v <= gTop - Math.round(au * (gTop - hs) / (a + 1));
      if (gothicArchIn(du, v, w + 2, 0, hs) || inGable) setD(u, v, base, 'frame', inGable && v > top);
      for (let k = 0; k <= orders; k++) if (gothicArchIn(du, v, w - 2 * k, 0, hs)) setD(u, v, base - 1 - k, k === orders ? 'infill' : 'frame');
    }
    const iw = w - 2 * orders, ia = iw >> 1, dIn = base - 1 - orders;
    for (let v = 1; v <= hs - 1; v++) for (let du = -ia + 1; du <= ia - 1; du++) {
      if (du === 0 && ia >= 2) setD(uc, v, dIn + 1, 'frame'); else { setD(uc + du, v, dIn, 'door'); HOLE.set(k2(uc + du, v), 'door'); }
    }
    if (ia >= 2) { const tc2 = hs + Math.floor((gothicArchTop(iw, hs) - hs) / 2); for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) { const r = Math.hypot(du, dv); if ((r <= 2.3 && r > 1.2) || r < 0.5) setD(uc + du, tc2 + dv, dIn + 1, 'frame'); } }
    ATT.push(() => {
      for (let k = 0; k < orders; k++) for (const s of [-1, 1]) {      // jamb shafts with capitals
        const u = uc + s * (((w - 2 * k) / 2 - 0.5) | 0), d = base - 1 - k;
        for (let v = 1; v < hs - 1; v++) put(u, v, d, post());
        put(u, hs - 1, d, B(o.capital)); if (k % 2 === 0 && hs > 6) put(u, 5, d, B(o.head));
      }
      for (let du = -a - 1; du <= a + 1; du++) {                        // crockets up the gable, finial on top
        const au = Math.abs(du), v = gTop - Math.round(au * (gTop - hs) / (a + 1));
        if (au % 2 === 1 && au <= a) put(uc + du, v + 1, base, st(FST, du < 0 ? dir.up : dir.un));
      }
      put(uc, gTop + 1, base, post()); put(uc, gTop + 2, base, post()); put(uc, gTop + 3, base, rod());
    });
    if (a >= 4 && top + 5 <= gTop) for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) if (Math.abs(du) + Math.abs(dv) <= 1) setD(uc + du, top + 3 + dv, base - 1, du || dv ? 'niche' : 'frame', true);
  };
  K.belfry = (uc, wb, ob, v0, hs, skip) => {         // tall open belfry lancet with reveals
    const IN = gothicArchIn, AT = gothicArchTop, wo = wb + 2 * ob;
    for (let v = v0; v <= AT(wo, hs); v++) for (let du = -(wo >> 1); du <= wo >> 1; du++) for (let k = 0; k <= ob; k++) if (IN(du, v, wo - 2 * k, v0, hs) && !skip(uc + du)) setD(uc + du, v, -1 - k, 'frame');
    for (let v = v0 + 1; v <= AT(wb, hs); v++) for (let du = -(wb >> 1); du <= wb >> 1; du++) if (IN(du, v, wb, v0 + 1, hs) && (du !== 0 || wb < 5)) HOLE.set(k2(uc + du, v), 'void');
  };
  K.panels = (us, v0, v1, skip) => {               // blind tracery: narrow recessed upright strips on plain wall, a band every 9 rows
    for (let v = v0; v <= v1; v++) for (const u of us) {
      if (skip(u) || (v - v0) % 9 === 0 || ((u % 2) + 2) % 2) continue;
      const k = k2(u, v), d = D.get(k);
      if (d === undefined || R.get(k) !== 'infill' || HOLE.has(k) || getD(u - 1, v) !== d || getD(u + 1, v) !== d) continue;
      setD(u, v, d - 1, 'niche');
    }
  };
  K.kings = (v0, v1, us, base, skip) => {            // a row of statue niches
    if (o.kings === false) return;
    for (let v = v0 + 1; v <= v1 - 1; v++) for (const u of us) {
      if (skip(u)) continue; const au = Math.abs(u);
      if (v >= v0 + 2 && v <= v0 + 5 && au % 3 !== 0) { setD(u, v, base(u) - 1, 'niche'); if (au % 3 === 1 && v === v0 + 2) ATT.push(() => K.statue(u, v, base(u) - 1)); }
      else if (v === v0 + 6 && au % 3 === 2) setD(u, v, base(u) - 1, 'niche');
    }
  };
  return K;
}
const GOTHIC_FRONT_DIR = { in: 'east', out: 'west', un: 'north', up: 'south' };
function gothicFront(S, L, o) {
  const { cw, b1, b2, th, tc, U, H_PORT, H_GAL, H_ROSE, H_KING, gh, gBase, top: H_TOWER } = L;
  const mine = new Set();
  const K = gothicKit(S, o, (u, v, d) => [-d, v, u], GOTHIC_FRONT_DIR, 'z', mine);
  const { st, post, rod, put, HOLE, ATT, k2, getD, setD, FST } = K;
  const sym = f => { for (let u = -U; u <= U; u++) f(u, Math.abs(u)); };
  const us = []; for (let u = -U; u <= U; u++) us.push(u);
  const isBut = au => (au >= b1 && au <= b1 + 2) || (au >= b2 && au <= b2 + 2);
  const butMid = [b1 + 1, b2 + 1];
  const butD = v => v <= H_PORT ? 5 : v <= H_ROSE ? 4 : v < H_KING ? 3 : 2;
  const inTower = au => au > cw;
  const base0 = au => inTower(au) ? 0 : -1;
  const AT = gothicArchTop, IN = gothicArchIn;

  // 1. wall planes and buttress piers (each stage steps back one block)
  for (let v = 0; v <= H_TOWER; v++) sym((u, au) => {
    if (v >= H_KING && !inTower(au)) return;
    if (isBut(au)) setD(u, v, butD(v), 'frame'); else setD(u, v, base0(au), 'infill');
  });
  // 2. portals: arch rim standing proud, orders stepping in, doors, a steep gable (locked so later storeys keep it)
  const portal = (uc, w, hs, orders, base) => K.portal(uc, w, hs, orders, base, isBut, H_GAL);   // gables end under the gallery, clear of the rose
  const capO = n => Math.max(1, Math.min(n, o.orders || 6));
  portal(0, L.wc, L.hc, capO(L.oc), 2);
  for (const s of [-1, 1]) portal(s * tc, L.ws, L.hsS, capO(L.os), 2);
  // 3. blind arcade with statues over the portals
  for (let v = H_PORT + 1; v <= H_GAL; v++) sym((u, au) => {
    if (isBut(au) || getD(u, v) > 0) return;
    const base = base0(au), m = (au + 1) % 4;
    if (v >= H_PORT + 2 && v <= H_GAL - 1 && m !== 0 && (v < H_GAL - 1 || m === 2)) { setD(u, v, base - 1, 'niche'); if (m === 2 && v === H_PORT + 2) ATT.push(() => K.statue(u, v, base - 1)); }
  });
  // 4. rose storey: rose in a deep pointed frame between the towers; paired lancets with a gablet on each tower
  {
    const w = 2 * cw + 1, v0 = H_GAL + 1, Rr = L.Rr, Ri = Math.ceil(Rr) + 1;
    const hs = o.rose === false ? Math.max(v0 + 5, H_ROSE - 1 - Math.floor(Math.sqrt(3) * (w - 4) / 2)) : L.vc - 2;   // without a rose the frame (and its window) fills the whole storey
    for (let v = v0; v <= H_ROSE; v++) for (let du = -cw; du <= cw; du++) for (let k = 0; k < 3; k++) if (IN(du, v, w - 2 * k, v0, hs)) setD(du, v, -2 - k, k === 2 ? 'infill' : 'frame');
    const spokes = Rr >= 5 ? 12 : Rr >= 3.5 ? 8 : 6;
    if (o.rose === false) K.lancet(0, Math.min(2 * cw - 3, 11) | 1, v0 + 1, hs, 2, -2, H_ROSE);   // no rose: a tall traceried window instead
    else for (let du = -Ri; du <= Ri; du++) for (let dv = -Ri; dv <= Ri; dv++) {
      const r = Math.hypot(du, dv); if (r > Rr + 0.5) continue;
      const ang = Math.atan2(dv, du), sp = Math.abs((((ang / (2 * Math.PI / spokes)) % 1) + 1) % 1 - 0.5);
      const solid = r < 1.3 || (Rr >= 4 && r > Rr * 0.48 && r < Rr * 0.48 + 1) || r > Rr - 0.5 || (sp > 0.42 && r > 1.3);
      if (solid) setD(du, L.vc + dv, -4, 'frame'); else { setD(du, L.vc + dv, -5, 'glass'); HOLE.set(k2(du, L.vc + dv), 'glass'); }
    }
  }
  const wl = Math.max(3, Math.min(9, (2 * th - 1) | 1));
  for (const s of [-1, 1]) K.lancet(s * tc, wl, H_GAL + 2, H_ROSE - 8, wl >= 7 ? 2 : 1, 0, H_ROSE);
  // 5. gallery of kings
  K.kings(H_ROSE, H_KING, us, u => base0(Math.abs(u)), u => isBut(Math.abs(u)));
  // 6. above: a gable between the towers (high enough to hide the nave roof), belfry openings on the towers
  for (let v = H_KING; v <= gBase + gh; v++) for (let u = -cw; u <= cw; u++) if (v <= gBase || v - gBase <= Math.round((cw + 0.5 - Math.abs(u)) * gh / (cw + 0.5))) setD(u, v, -1, 'infill');
  for (let v = H_KING + 1; v <= gBase - 1; v++) for (let u = -cw + 1; u <= cw - 1; u++) if ((u + cw) % 3 !== 0 && v <= gBase - 2) setD(u, v, -2, 'niche');   // blind arcade under the gable
  ATT.push(() => { for (let u = -cw; u <= cw; u++) if (Math.abs(u) % 2 === 1) { const v = gBase + Math.round((cw + 0.5 - Math.abs(u)) * gh / (cw + 0.5)); put(u, v + 1, -1, st(FST, u < 0 ? 'south' : 'north')); } });   // crockets up the gable
  const gr = Math.max(1.5, Math.min(3.3, cw / 3)), gvc = gBase + Math.round(gh * 0.4);
  for (let du = -5; du <= 5; du++) for (let dv = -5; dv <= 5; dv++) { const r = Math.hypot(du, dv); if (r <= gr + 1) { if (r > gr || r < 1) setD(du, gvc + dv, -2, 'frame'); else { setD(du, gvc + dv, -3, 'glass'); HOLE.set(k2(du, gvc + dv), 'glass'); } } }   // a glass ring round a stone hub (a small filled disc reads as a cross)
  const bel = th >= 6 ? [tc - 3, tc + 3] : [tc];
  const wb = th >= 6 ? 5 : Math.max(3, Math.min(5, (2 * th - 3) | 1)), ob = 2 * th + 1 - wb >= 4 ? 2 : 1;
  for (const s of [-1, 1]) for (const uc of bel) K.belfry(s * uc, wb, ob, H_KING + 3, H_TOWER - 10, u => isBut(Math.abs(u)));
  for (let v = H_KING + 1; v <= H_TOWER - 1; v++) for (const s of [-1, 1]) for (const au of [cw + 4, L.t1]) if (getD(s * au, v) === 0) setD(s * au, v, 1, 'frame');   // corner shafts
  if (o.forest) K.panels(us, H_PORT + 2, H_TOWER - 2, u => isBut(Math.abs(u)));
  // 7. fill, mouldings, string courses, fixed parts
  K.fill();
  const rows = [H_PORT + 1, H_GAL, H_ROSE + 1, H_KING - 1, H_TOWER]; rows.parapet = [H_GAL, H_KING - 1, H_TOWER];
  K.courses(rows, us, u => isBut(Math.abs(u)));
  for (const f of ATT) f();
  // 8. pinnacles: on every buttress set-back, a big one on each buttress top, a cluster on each tower
  sym((u, au) => {
    if (!butMid.includes(au)) return;
    for (const [v0, v1] of [[2, H_PORT - 2], [H_PORT + 3, H_ROSE - 3], [H_KING + 2, H_TOWER - 4]]) for (let v = v0 + 2; v + 4 < v1; v += 10) {
      const d = butD(v); for (let y = v; y < v + 4; y++) put(u, y, d, 'minecraft:air'); K.statue(u, v, d - 1); put(u, v + 4, d, st(FST, 'east', 'top'));
    }
    for (const v of [H_PORT + 1, H_ROSE + 1, H_KING]) { const d = butD(v) + 1; if (getD(u, v - 1) === d) { K.pinnacle(u - Math.sign(u), v, d, 2, false); K.pinnacle(u + Math.sign(u), v, d, 2, false); } }
    K.pinnacle(u, H_TOWER + 1, 0, 5, true);
  });
  if (o.towerTop !== 'openwork') for (const s of [-1, 1]) { K.pinnacle(s * tc, H_TOWER + 1, -3, Math.max(5, th + 3), true); if (th >= 4) { K.pinnacle(s * (tc - 3), H_TOWER + 1, -6, 4, false); K.pinnacle(s * (tc + 3), H_TOWER + 1, -6, 4, false); } }
  put(0, gBase + gh + 1, -1, post()); put(0, gBase + gh + 2, -1, post()); put(0, gBase + gh + 3, -1, rod());
  return { mine, statues: K.statues, pins: K.pins, width: 2 * U + 1 };
}
// a tower's outer side (north or south): the same storeys as the front, a buttress at the back corner,
// a lancet in the rose storey, a band of niches, an open belfry. Face plane z = s * zf, u = world x.
function gothicTowerSide(S, L, o, s, zf, x0, x1, mine) {
  const { H_PORT, H_GAL, H_ROSE, H_KING, top: H_TOWER } = L;
  const dir = s > 0 ? { in: 'north', out: 'south', un: 'west', up: 'east' } : { in: 'south', out: 'north', un: 'west', up: 'east' };
  const K = gothicKit(S, o, (u, v, d) => [u, v, s * (zf + d)], dir, 'x', mine);
  const { setD, getD, ATT } = K;
  const bu0 = x1 - 2, isBut = u => u >= bu0, butD = v => v <= H_PORT ? 4 : v <= H_ROSE ? 3 : v < H_KING ? 2 : 1;
  const us = []; for (let u = x0; u <= x1; u++) us.push(u);
  for (let v = 0; v <= H_TOWER; v++) for (const u of us) setD(u, v, isBut(u) ? butD(v) : 0, isBut(u) ? 'frame' : 'infill');
  const cu = (x0 + bu0 - 1) >> 1, room = bu0 - x0;            // centre and width of the plain part
  for (let v = H_PORT + 2; v <= H_GAL - 1; v++) for (const u of us) if (!isBut(u) && (u - x0) % 4 !== 3 && (v < H_GAL - 1 || (u - x0) % 4 === 1)) { setD(u, v, -1, 'niche'); if ((u - x0) % 4 === 1 && v === H_PORT + 2) ATT.push(() => K.statue(u, v, -1)); }
  const wl = Math.max(3, Math.min(7, (room - 2) | 1));
  if (room >= 5) K.lancet(cu, wl, H_GAL + 2, H_ROSE - 8, wl >= 7 ? 2 : 1, 0, H_ROSE);
  K.kings(H_ROSE, H_KING, us, () => 0, isBut);
  const wb = Math.max(3, Math.min(5, (room - 4) | 1));
  if (room >= 5) K.belfry(cu, wb, room - wb >= 4 ? 2 : 1, H_KING + 3, H_TOWER - 10, isBut);
  if (o.forest) K.panels(us, H_GAL + 1, H_TOWER - 2, isBut);
  K.fill();
  const rows = [H_PORT + 1, H_GAL, H_ROSE + 1, H_KING - 1, H_TOWER]; rows.parapet = [H_GAL, H_KING - 1, H_TOWER];
  K.courses(rows, us, isBut);
  for (const f of ATT) f();
  K.pinnacle(x1 - 1, H_TOWER + 1, 1, 5, true);
  for (const v of [H_PORT + 1, H_ROSE + 1, H_KING]) { const d = butD(v) + 1; if (getD(x1 - 1, v - 1) === d) K.pinnacle(x1 - 1, v, d, 2, false); }
  return { statues: K.statues, pins: K.pins };
}
// facade blocks left floating (not joined to the ground through faces) are removed and counted; should be 0
function gothicDropFloating(S, mine) {
  const seen = new Set(), q = [];
  for (const k of S.blocks.keys()) if (k.split(',')[1] === '0') { seen.add(k); q.push(k); }
  while (q.length) { const [x, y, z] = q.pop().split(',').map(Number); for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = (x + a) + ',' + (y + b) + ',' + (z + c); if (!seen.has(k) && S.blocks.has(k)) { seen.add(k); q.push(k); } } }
  let n = 0; for (const k of mine) if (S.blocks.has(k) && !seen.has(k)) { S.blocks.delete(k); n++; }
  return n;
}
// an aisle's outer wall (north or south side of nave and choir): a plinth, a sill course, a pier with a set-back
// on every bay line (where the flying buttresses stand), a lancet with reveals in every bay, a cornice and an
// open parapet in front of the lean-to roof. Thin: only one block behind the wall plane is touched.
function gothicSideWall(S, o, s, zf, x0, x1, bay, vTop, mine, vBase = 0) {   // vBase > 0: an upper wall (clerestory) standing on a roof
  const dir = s > 0 ? { in: 'north', out: 'south', un: 'west', up: 'east' } : { in: 'south', out: 'north', un: 'west', up: 'east' };
  const K = gothicKit(S, { ...o, thick: 2, backMax: -2 }, (u, v, d) => [u, v, s * (zf + d)], dir, 'x', mine);   // walls 3 thick: room for deep reveals
  const { setD, ATT } = K;
  const pier = u => ((u % bay) + bay) % bay === 0, shoulder = u => pier(u - 1) || pier(u + 1);
  const us = []; for (let u = x0; u <= x1; u++) us.push(u);
  const set = vBase ? -1 : vTop - 3, sill = vBase ? vBase + 3 : o.forest ? Math.max(3, Math.min(7, vTop - 9)) : 3;   // Cologne: windows start higher, a chequered dado below them
  for (let v = vBase; v <= vTop; v++) for (const u of us) {
    if (pier(u)) setD(u, v, v < set ? 2 : 1, 'frame');
    else if (shoulder(u)) setD(u, v, v < set ? 1 : 0, 'frame');
    else setD(u, v, !vBase && v <= 1 ? 1 : 0, !vBase && v <= 1 ? 'frame' : !vBase && o.forest && v >= 2 && v < sill - 1 ? 'checker' : 'infill');
  }
  const free = bay - 3, w = Math.max(1, Math.min(5, (free - 1) | 1)), ord = w >= 3 ? 1 : 0, hs = Math.max(vBase + 5, vTop - 4 - (w >> 1));
  let nw = 0;
  for (let xb = Math.ceil(x0 / bay) * bay - bay; xb <= x1; xb += bay) {
    const xm = xb + (bay >> 1); if (xm - (w >> 1) - ord < x0 || xm + (w >> 1) + ord > x1) continue;
    if (hs - vBase >= 5) { K.lancet(xm, w + 2 * ord, sill, hs, ord, 0, vBase || o.forest ? vTop + 6 : vTop - 1, !!vBase || !!o.forest); nw++; }   // a gablet (wimperg) over each window, up through the eaves (aisles too in the pinnacle-forest styles)   // clerestory: a gablet (wimperg) over each window, up through the eaves
  }
  if (o.forest && !vBase) K.panels(us, sill, vTop - 1, u => pier(u) || shoulder(u));
  K.fill();
  const rows = [vBase + 2, vTop]; rows.parapet = [vTop];
  K.courses(rows, us, u => pier(u));
  for (const f of ATT) f();
  if (vBase) for (const u of us) if (pier(u)) K.pinnacle(u, vTop + 1, 1, 2, false);   // eaves pinnacles over the flyers' landings
  if (o.forest) for (const u of us) if (shoulder(u) && us.includes(u)) K.pinnacle(u, vTop + 1, vBase ? 0 : 1, vBase ? 2 : 3, false);   // pinnacle forest: one more on each side of every pier
  if (o.forest && !vBase) for (const u of us) if (pier(u)) K.pinnacle(u, vTop + 1, 2, 2, false);
  return { windows: nw };
}
// a transept front (north or south end): corner piers, a portal with a gable, a band of statue niches, up to vTop
function gothicTransept(S, o, s, zf, x0, x1, vTop, mine, wallTop = vTop, apex = 0) {
  const dir = s > 0 ? { in: 'north', out: 'south', un: 'west', up: 'east' } : { in: 'south', out: 'north', un: 'west', up: 'east' };
  const K = gothicKit(S, o, (u, v, d) => [u, v, s * (zf + d)], dir, 'x', mine);
  const { setD } = K;
  const isBut = (au, u) => u <= x0 + 1 || u >= x1 - 1;
  const us = []; for (let u = x0; u <= x1; u++) us.push(u);
  for (let v = 0; v <= wallTop; v++) for (const u of us) if (v <= vTop || isBut(0, u)) setD(u, v, isBut(0, u) ? (v < vTop - 6 ? 3 : v <= vTop ? 2 : 1) : 0, isBut(0, u) ? 'frame' : 'infill');
  const xm = (x0 + x1) >> 1, room = x1 - x0 - 3, w = Math.max(5, Math.min(11, (room - 2) | 1)), ord = Math.max(1, Math.min(4, (w - 3) >> 1));
  K.portal(xm, w, Math.round(w * 0.7), ord, 2, isBut);
  const vb = gothicArchTop(w, Math.round(w * 0.7)) + (w >> 1) + 8;
  if (o.bigWindow) {                                 // Cologne: no rose; one tall traceried window filling the front, a wimperg over it
    const wl = Math.max(5, Math.min(13, (room - 2) | 1)), v0 = vb - 4, hs = (apex || wallTop) - 7 - Math.floor(Math.sqrt(3) * wl / 2);   // the window rises into the gable
    if (hs - v0 >= 6) K.lancet(xm, wl, v0, hs, 2, 0, (apex || wallTop) - 2, true);
  } else if (vb + 7 <= vTop) K.kings(vb, vb + 8, us, () => 0, u => isBut(0, u));
  K.fill();
  const rows = [vb, vTop]; rows.parapet = [];
  K.courses(rows, us, u => isBut(0, u));
  for (const f of K.ATT) f();
  for (const u of [x0, x1]) { K.pinnacle(u + (u === x0 ? 1 : -1), vTop + 1, 3, 2, false); K.pinnacle(u + (u === x0 ? 1 : -1), wallTop + 1, 1, 4, true); }
  if (apex) K.pinnacle(xm, apex + 1, 0, 3, false);   // a slim finial: the gable's peak is a single block wide
  return { statues: K.statues };
}
// a single big pinnacle at world (x, y, z) (on flying-buttress piers, round the east end)
function gothicPinnacleAt(S, o, x, y, z, h, big, mine) {
  const K = gothicKit(S, o, (u, v, d) => [-d, v, u], GOTHIC_FRONT_DIR, 'z', mine);
  K.pinnacle(z, y, -x, h, big);
}
// a short plain wall (transept east / west sides): plinth, sill course, cornice with an open parapet. Face plane x = xf.
function gothicShortWall(S, o, sx, xf, z0, z1, vTop, mine) {
  const dir = sx < 0 ? { in: 'east', out: 'west', un: 'north', up: 'south' } : { in: 'west', out: 'east', un: 'north', up: 'south' };
  const K = gothicKit(S, { ...o, thick: 1, backMax: -1 }, (u, v, d) => [xf + sx * d, v, u], dir, 'z', mine);
  const us = []; for (let u = Math.min(z0, z1); u <= Math.max(z0, z1); u++) us.push(u);
  for (let v = 0; v <= vTop; v++) for (const u of us) K.setD(u, v, v <= 1 ? 1 : 0, v <= 1 ? 'frame' : 'infill');
  K.fill();
  const rows = [2, vTop]; rows.parapet = [vTop];
  K.courses(rows, us, () => false);
}
// a flying buttress (single): a pier outside the aisle wall, 3 wide, stepping in twice, crowned by a pinnacle of the
// pier's own width; an arch whose top is a straight sloping coping and whose underside is a curve, thick at the pier and
// thin at the wall, landing on the clerestory pilaster. z0 = the aisle wall plane, zw = the clerestory face (+1).
function gothicFlyer(S, o, s, xb, z0, yp, zw, yw, RH, mine, zMid = null) {   // zMid: an intermediate pier (between two aisles) carrying its own pinnacle
  const put = (x, y, z, b) => { S.set(x, y, z, b); mine.add(x + ',' + y + ',' + z); };
  const st = (m, f, h = 'bottom') => B(m, { facing: f, half: h, shape: 'straight', waterlogged: false });
  const IN = s > 0 ? 'north' : 'south', OUT = s > 0 ? 'south' : 'north';
  const y1 = Math.round(yp * 0.45), y2 = Math.round(yp * 0.75);
  for (let y = 0; y <= yp; y++) for (let dx = -1; dx <= 1; dx++) {
    const deep = y <= y1 ? 5 : y <= y2 ? 4 : 3;
    for (let k = 1; k <= deep; k++) put(xb + dx, y, s * (z0 + k), B(y === 0 ? o.plinth || o.frame : o.frame));
    if (y === y1 + 1 || y === y2 + 1) put(xb + dx, y, s * (z0 + deep + 1), st(o.stairs, IN));   // weathering on each set-back
  }
  gothicPinnacleAt(S, o, xb, yp + 1, s * (z0 + 2), 3, true, mine);
  const span = Math.max(1, z0 - zw), ys = yp - Math.max(3, Math.round(span * 0.6));
  let prevTop = null;
  for (let a = z0; a >= zw; a--) {
    const t = (z0 - a) / span, z = s * a;
    let top = Math.round(yp + (yw - yp) * t), bot = Math.round(ys + (yw - 1 - ys) * Math.sin(t * Math.PI / 2));
    const rh = RH.get(xb + ',' + z); if (rh !== undefined) bot = Math.max(bot, Math.ceil(rh));
    if (prevTop !== null && bot > prevTop) bot = prevTop;      // stay joined to the previous column
    if (top < bot + 1) top = bot + 1;
    for (let y = bot; y <= top; y++) if (!/pane/.test(S.get(xb, y, z) || '')) put(xb, y, z, B(o.frame));
    put(xb, top, z, st(o.stairs, IN));                          // the coping slopes up toward the wall
    if (top - bot >= 2) put(xb, bot, z, st(o.stairs, OUT, 'top'));   // the underside curve
    prevTop = top;
    if (zMid !== null && a === zMid) {          // the intermediate pier: a column from the roof up into the arch, a pinnacle on the coping
      const r0 = rh !== undefined ? Math.ceil(rh) : 1;
      for (let y = r0; y < bot; y++) put(xb, y, z, B(o.frame));
      gothicPinnacleAt(S, o, xb, top + 1, z, 3, false, mine);
    }
  }
}
