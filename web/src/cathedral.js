// ---------------------------------------------------------------------------------------------
// Cathedral (主教座堂). Long axis along x like the church: the west front stands at x = 0, the east end
// (chevet) at the far +x end; north is -z. The plan is a raster of zones, each with its own wall top:
//   H  the high body: nave, crossing, transept, choir and apse (one height; gable roofs whose ridges cross)
//   I  inner aisles (with a tribune gallery storey), O outer aisles, C radiating chapels (lean-to roofs)
//   T  the two west towers, standing over the first aisle bays
// A wall rises wherever a cell has a lower or empty neighbour, from that neighbour's top to its own, so the
// clerestory over the aisles and the tribune wall over the outer aisles come out of one rule. Below an inside
// step the wall opens as an arcade: piers on the bay lines, arches between.
// French preset after Notre-Dame de Paris (128 × 48 m, vault 33 m, towers 69 m, flèche 96 m); the defaults are
// that building at about 0.8 block per metre. Every size can be set on its own.
// ---------------------------------------------------------------------------------------------
const CATHEDRAL_STYLES = { french: '法式（兰斯 / 巴黎圣母院）', german: '德式（科隆）', italian: '意式（米兰）', spanish: '西班牙（塞维利亚）' };
// a style = a set of starting values; every value can still be changed afterwards (the panel copies them in when the style changes)
const CATHEDRAL_PRESETS = {
  french: { pinnacle_forest: false, facade: 'detailed', tower_top: 'flat', crossing: 'fleche', roof_style: 'pitched', campanile: false, court: false },
  german: { pinnacle_forest: true, rose: false, kings: false, roof: 'stone', facade: 'detailed', tower_top: 'openwork', crossing: 'turret', roof_style: 'pitched', campanile: false, court: false, nave_bays: 10, width: 15, aisle_width: 6, arcade_height: 15, gallery_height: 4, clerestory_height: 15, transept_depth: 4, chapels: 7, roof_pitch: 'steep', walls: 'warm', fleche_height: 30 },
  italian: { pinnacle_forest: true, facade: 'screen', tower_top: 'none', crossing: 'lantern', roof_style: 'pitched', campanile: false, court: false, nave_bays: 9, width: 19, aisle_width: 6, arcade_height: 16, gallery_height: 0, clerestory_height: 8, transept_depth: 4, east_end: 'apse', roof_pitch: 'normal', walls: 'marble', roof: 'stone', fleche_height: 30 },
  spanish: { pinnacle_forest: false, facade: 'screen', tower_top: 'none', crossing: 'cimborio', roof_style: 'terrace', campanile: true, court: true, nave_bays: 9, width: 17, aisle_width: 7, arcade_height: 15, gallery_height: 0, clerestory_height: 10, transept_depth: 0, east_end: 'flat', walls: 'warm', roof: 'stone' },
};
const CATHEDRAL_TOWER_TOPS = { flat: '平顶 + 尖塔群（兰斯）', openwork: '镂空尖塔（科隆）', none: '无塔' };
const CATHEDRAL_CROSSINGS = { fleche: '细尖塔（巴黎）', turret: '铜绿小尖塔（科隆）', lantern: '八角采光塔 + 金像（米兰）', cimborio: '抬高的方形采光塔（塞维利亚）', none: '无' };
const CATHEDRAL_ROOF_STYLES = { pitched: '坡屋顶', terrace: '平台屋顶（带栏杆）' };
// white marble (Milan); cathedral only
const CATHEDRAL_MARBLE = { label: '白大理石', mix: [['calcite', 4], ['quartz_block', 2], ['diorite', 1]], plinth: 'polished_diorite', set: 'stone' };
// warm yellow sandstone (as Reims / Cologne in the references); cathedral only, so the church's palettes stay as they were
const CATHEDRAL_WARM = { label: '暖黄砂岩', mix: [['smooth_sandstone', 4], ['sandstone', 3], ['cut_sandstone', 2]], plinth: 'cut_sandstone', set: 'sandstone' };
const CATHEDRAL_FACADES = { detailed: '精细双塔立面（扶壁、多层拱门、雕像、尖塔群）', screen: '屏风立面（无塔，米兰 / 塞维利亚）', simple: '简单（旧版平立面）' };
const CATHEDRAL_EAST = { chevet: '回廊 + 放射小礼拜堂', apse: '半圆后殿', flat: '平直东端' };
const CATHEDRAL_DEFAULT = {
  style: 'french', facade: 'detailed', nave_bays: 9, bay: 8, width: 17, aisles: 2, aisle_width: 6, transept: true, transept_depth: 2, choir_bays: 4,
  east_end: 'chevet', chapels: 5, chapel_depth: 4, arcade_height: 12, gallery_height: 6, clerestory_height: 13, facade_extra: 2, tower_rise: 24,
  rose: true, kings: true, statues: true, portal_orders: 6, flying_buttresses: true, pinnacles: true, fleche: true, fleche_height: 50, roof_pitch: 'medium',
  walls: 'white', roof: 'slate', glass: 'colored', interior: false, seed: 1,
};
// the French preset's sizes at 1 block per metre; the panel's 比例 multiplies these (bay counts stay)
const CATHEDRAL_BASE = { bay: 8, width: 17, aisle_width: 6, transept_depth: 2, chapel_depth: 4, arcade_height: 12, gallery_height: 6, clerestory_height: 13, facade_extra: 2, tower_rise: 24, fleche_height: 50 };   // 1.0 = the defaults (wide enough nave and aisles for the detailed front)
const CATHEDRAL_RANGES = {
  nave_bays: [3, 14], bay: [4, 10], width: [7, 21], aisle_width: [3, 7], transept_depth: [0, 10], choir_bays: [1, 10], chapels: [0, 9], chapel_depth: [2, 6],
  portal_orders: [1, 6], arcade_height: [5, 16], gallery_height: [0, 12], clerestory_height: [4, 16], facade_extra: [1, 12], tower_rise: [8, 60], fleche_height: [10, 90],
};
function cathedral(o = {}) {
  const p = { ...CATHEDRAL_DEFAULT, ...(CATHEDRAL_PRESETS[o.style] || {}), ...o };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const report = [], adjust = [];
  const R = {};
  for (const [k, [a, b]] of Object.entries(CATHEDRAL_RANGES)) {
    R[k] = cl(p[k] | 0, a, b);
    if (o[k] !== undefined && R[k] !== (o[k] | 0)) adjust.push({ key: k, got: R[k], why: `允许范围 ${a}–${b}` });
  }
  const bay = R.bay, NB = R.nave_bays, CB = R.choir_bays;
  const W = R.width | 1, hw = W >> 1;
  if (W !== R.width) adjust.push({ key: 'width', got: W, why: '中殿宽必须是奇数，屋脊和中门才能落在正中一格' });
  const NA = (p.aisles | 0) === 1 ? 1 : 2, AW = R.aisle_width, edge = hw + NA * AW;
  const AH = R.arcade_height, GH = R.gallery_height, CH = R.clerestory_height;
  const lean = n => (n - 1) >> 1;                       // rise of a lean-to roof n cells deep (half a block per cell)
  const IT = AH + GH, OT = AH;                          // wall tops of the inner aisle (with its gallery) and the outer aisle
  const IRT = IT + 1 + lean(AW);                        // top of the inner aisle roof where it meets the nave wall
  const NT = IRT + CH;                                  // nave wall top
  const PR = ROOF_PITCHES[p.roof_pitch] || ROOF_PITCHES.medium, pitch = PR.r;
  const ridge = NT + 1 + Math.round(pitch * hw);
  const FT = ridge + R.facade_extra;
  const detailed = (p.facade || 'detailed') !== 'simple', screen = p.facade === 'screen', terrace = p.roof_style === 'terrace';
  const towers = !screen && p.tower_top !== 'none';
  const GL = detailed && !screen ? gothicFrontLayout({ hw, edge: hw + NA * AW, NT, ridge, TT: FT + R.tower_rise }) : null;
  const TT = GL ? GL.top : FT + R.tower_rise;
  const hasT = !!p.transept, tdep = hasT ? R.transept_depth : 0;
  const xN = NB * bay - 1, xc0 = hasT ? xN + 1 : 0, xc1 = hasT ? xN + W : -1, xcm = xc0 + hw;
  const xE = (hasT ? xc1 : xN) + CB * bay;
  const east = CATHEDRAL_EAST[p.east_end] ? p.east_end : 'chevet';
  const nch = east === 'chevet' ? R.chapels : 0, cd = R.chapel_depth, CT = Math.max(4, p.pinnacle_forest ? OT : OT - 2);   // Cologne's chapels rise as high as the aisles
  const TWD = edge - hw, TL = towers ? Math.min(TWD, Math.max(4, xN + 1 - bay)) : 0;   // towers: as wide as the aisles, as long as that (or shorter on a short nave)
  if (towers && TL < TWD) report.push(`西塔：中殿太短，塔身沿长轴缩为 ${TL} 格`);
  const seed = p.seed || 1;
  const S = new Structure();
  // ---- materials (the same slots as the church) ----
  const matRep = [], MS = resolveMats(CHURCH_MAT_SLOTS, p.mats, matRep);
  const WM0 = p.walls === 'warm' ? CATHEDRAL_WARM : p.walls === 'marble' ? CATHEDRAL_MARBLE : CHURCH_WALLS[p.walls] || CHURCH_WALLS.white, RM0 = CHURCH_ROOFS[p.roof] || CHURCH_ROOFS.slate;
  const SM0 = FOUNTAIN_MATERIALS[WM0.set] || FOUNTAIN_MATERIALS.stone;
  const WM = { ...WM0, ...(MS.wall ? { mix: MS.wall.mix } : {}), ...(MS.plinth ? { plinth: MS.plinth.block } : {}) };
  const RM = MS.roof ? { ...RM0, stairs: MS.roof.stairs, slab: MS.roof.slab, block: MS.roof.block } : RM0;
  const SM = { ...SM0, ...(MS.stone ? { block: MS.stone.block, stairs: MS.stone.stairs, slab: MS.stone.slab, wall: MS.stone.wall || SM0.wall, accent: MS.stone.accent } : {}), ...(MS.accent ? { accent: MS.accent.block } : {}) };
  const FL = MS.floor ? [MS.floor.mix[0][0], (MS.floor.mix[1] || MS.floor.mix[0])[0]] : ['polished_andesite', 'stone_bricks'];
  const WD = { door: 'dark_oak_door', stairs: 'spruce_stairs', planks: 'spruce_planks', ...(MS.wood || {}) };
  const TRIM = B(MS.trim ? MS.trim.block : WALL_TRIM[p.walls] || 'polished_andesite');
  const wallB = (x, y, z) => B(pickU(patchNoise(x, y, z, deriveSeed(seed, 'cath-wall'), 'cw', 2), WM.mix));
  const stair = (m, f, half = 'bottom') => B(m, { facing: f, half, shape: 'straight', waterlogged: false });
  const slab = (m, type = 'bottom') => B(m, { type, waterlogged: false });
  const post = (c = {}) => B(SM.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none', ...c });
  const AIR = 'minecraft:air';
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIR = (dx, dz) => dx > 0 ? 'east' : dx < 0 ? 'west' : dz > 0 ? 'south' : 'north';

  // ---- zones ----
  const H = 1, I = 2, O = 3, C = 4, T = 5, TOP = [-1, NT, IT, OT, CT, TT];
  const zoneOf = (x, z) => {
    const az = Math.abs(z);
    if (x < 0) return 0;
    if (x <= xE) {
      if (towers && x < TL && az > hw && az <= edge) return T;
      if (az <= hw) return H;
      if (hasT && x >= xc0 && x <= xc1 && az <= edge + tdep) return H;
      if (az <= hw + AW) return I;
      if (az <= edge) return O;
      return 0;
    }
    if (east === 'flat') return 0;
    const r = Math.hypot(x - xE, z);
    if (r <= hw + 0.5) return H;
    if (east === 'apse') return 0;
    if (r <= hw + AW + 0.5) return I;
    if (NA === 2 && r <= edge + 0.5) return O;
    if (nch && r <= edge + cd + 0.5) {
      const a = Math.atan2(z, x - xE);
      for (let k = 0; k < nch; k++) { const ak = -Math.PI / 2 + Math.PI * (k + 0.5) / nch; if (Math.abs(a - ak) * r <= 2.2) return C; }
    }
    return 0;
  };
  const X0 = -2, X1 = xE + edge + cd + 3, ZM = Math.max(edge + tdep, edge + cd) + 4, NZ = 2 * ZM + 1;
  const ZG = new Int8Array((X1 - X0 + 1) * NZ);
  for (let x = X0; x <= X1; x++) for (let z = -ZM; z <= ZM; z++) ZG[(x - X0) * NZ + z + ZM] = zoneOf(x, z);
  const zone = (x, z) => x >= X0 && x <= X1 && z >= -ZM && z <= ZM ? ZG[(x - X0) * NZ + z + ZM] : 0;
  const top = (x, z) => TOP[zone(x, z)];
  const cells = []; for (let x = X0; x <= X1; x++) for (let z = -ZM; z <= ZM; z++) if (zone(x, z)) cells.push([x, z]);

  // ---- floor, walls, arcades ----
  const isPier = (x, z, along) => {
    if (x > xE) { const r = Math.hypot(x - xE, z), a = Math.atan2(z, x - xE), st = bay / Math.max(1, r), f = a / st; return Math.abs(f - Math.round(f)) * bay < 0.6; }
    return (along === 'x' ? x : z + ZM) % bay === 0;
  };
  const border = new Set(), arc = [];
  for (const [x, z] of cells) {
    const zc = zone(x, z), t = TOP[zc];
    let lo = Infinity, out = false;
    for (const [dx, dz] of N8) { const n = zone(x + dx, z + dz); if (!n) { out = true; lo = -1; } else if (TOP[n] < lo) lo = TOP[n]; }
    S.set(x, 0, z, out ? B(WM.plinth) : B((x + z) & 1 ? FL[0] : FL[1]));
    if (lo >= t) continue;
    border.add(x + ',' + z);
    for (let y = Math.max(1, lo + 1); y <= t; y++) S.set(x, y, z, wallB(x, y, z));
    if (!out) arc.push([x, z, lo]);
  }
  for (const [x, z, lo] of arc) {                       // the opening under an inside step
    let d = null;
    for (const [dx, dz] of N4) if (top(x + dx, z + dz) === lo && zone(x + dx, z + dz)) { d = [dx, dz]; break; }
    if (!d) { for (let y = 1; y <= lo; y++) S.set(x, y, z, B(SM.block)); continue; }   // inner corner: a solid pier
    const along = d[1] ? 'x' : 'z';
    if (isPier(x, z, along)) { for (let y = 1; y <= lo; y++) S.set(x, y, z, B(SM.block)); continue; }
    const levels = zone(x, z) === H && lo === IT && GH > 0 ? [AH, lo] : [lo];
    for (const L of levels) {
      S.set(x, L, z, wallB(x, L, z));
      for (const s of [-1, 1]) {
        const [px, pz] = along === 'x' ? [x + s, z] : [x, z + s];
        if (zone(px, pz) === zone(x, z) && isPier(px, pz, along) && L - 1 >= 2) S.set(x, L - 1, z, stair(SM.stairs, DIR(px - x, pz - z), 'top'));
      }
    }
  }
  if (GH > 0) for (const [x, z] of cells) if (zone(x, z) === I && !border.has(x + ',' + z)) S.set(x, AH, z, B(WD.planks));   // tribune floor

  // ---- roofs ----
  const RH = new Map();                                 // roof surface per cell, for the flyers' clearance
  const dH = (x, z) => {
    let d = 0; const az = Math.abs(z);
    if (x <= xE && az <= hw) d = hw + 1 - az;
    if (hasT && x >= xc0 && x <= xc1) d = Math.max(d, hw + 1 - Math.abs(x - xcm));
    if (x > xE) d = Math.max(d, Math.min(hw + 1, Math.round(hw + 1.5 - Math.hypot(x - xE, z))));
    return Math.max(1, d);
  };
  const hH = (x, z) => NT + 1 + Math.round(pitch * (dH(x, z) - 1));
  for (const [x, z] of cells) {
    if (zone(x, z) !== H) continue;
    if (terrace) { S.set(x, NT + 1, z, border.has(x + ',' + z) ? (x + z) % 2 ? post() : B(SM.block) : slab(SM.slab)); RH.set(x + ',' + z, NT + 2); continue; }   // a walkable terrace behind a balustrade
    const h = hH(x, z);
    let up = null, uh = h, low = Infinity;
    for (const [dx, dz] of N4) {
      if (zone(x + dx, z + dz) !== H) continue;
      const nh = hH(x + dx, z + dz);
      if (nh > uh) { uh = nh; up = [dx, dz]; }
      low = Math.min(low, nh);
    }
    if (border.has(x + ',' + z)) for (let y = NT + 1; y < h; y++) S.set(x, y, z, wallB(x, y, z));    // gable ends
    else for (let y = Math.max(NT + 1, low); y < h; y++) S.set(x, y, z, B(RM.block));   // from the lowest neighbour's level, so the steps of a steep cone stay joined
    S.set(x, h, z, up ? stair(RM.stairs, DIR(...up)) : slab(RM.slab));
    RH.set(x + ',' + z, h + 1);
  }
  // lean-to roofs: half a block up per cell from the low edge
  const E = new Map(), q = [];
  for (const [x, z] of cells) {
    const zc = zone(x, z); if (zc !== I && zc !== O && zc !== C) continue;
    if (N4.some(([dx, dz]) => (x > xE || !dx) && top(x + dx, z + dz) < TOP[zc])) { E.set(x + ',' + z, 1); q.push([x, z]); }   // slopes start at the side walls (not at the west or east ends)
  }
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i], e = E.get(x + ',' + z);
    for (const [dx, dz] of N4) { const k = (x + dx) + ',' + (z + dz), zn = zone(x + dx, z + dz), zc = zone(x, z); if ((zn === zc || (zn && zn !== H && zn !== T && zc !== C && zn !== C && TOP[zn] === TOP[zc])) && !E.has(k)) { E.set(k, e + 1); q.push([x + dx, z + dz]); } }   // aisles of equal height share one slope
  }
  for (const [x, z] of cells) {
    const e = E.get(x + ',' + z); if (!e) continue;
    if (terrace) { const y = TOP[zone(x, z)] + 1, edgeC = N4.some(([dx, dz]) => top(x + dx, z + dz) < TOP[zone(x, z)]); S.set(x, y, z, edgeC ? ((x + z) % 2 ? post() : B(SM.block)) : slab(SM.slab)); RH.set(x + ',' + z, y + 1); continue; }
    const y = TOP[zone(x, z)] + 1 + ((e - 1) >> 1), tp = (e - 1) & 1 ? 'top' : 'bottom';
    S.set(x, y, z, slab(RM.slab, tp)); RH.set(x + ',' + z, y + 1);
  }
  // towers: belfry floor, flat top behind a battlement
  const towerC = s => [Math.floor((TL - 1) / 2), s * (hw + 1 + ((TWD - 1) >> 1))];
  for (const [x, z] of cells) {
    if (zone(x, z) !== T) continue;
    if (!border.has(x + ',' + z)) { S.set(x, TT, z, B(WD.planks)); S.set(x, FT, z, B(WD.planks)); }
    else if (!detailed && N8.some(([dx, dz]) => !zone(x + dx, z + dz) || top(x + dx, z + dz) < TT) && (x + z) % 2 === 0) S.set(x, TT + 1, z, wallB(x, TT + 1, z));
  }

  // ---- west front (simple): the wall between the towers rises to FT ----
  const KY = Math.max(AH + 1, 10), GY = FT - 5;
  if (!detailed) {
  for (let z = -hw; z <= hw; z++) {
    for (let y = 1; y <= FT; y++) S.set(0, y, z, wallB(0, y, z));
    if ((z + hw) % 2 === 0) S.set(0, FT + 1, z, wallB(0, FT + 1, z));
  }
  // portals: three doors, a tympanum, a stepped hood standing proud of the wall
  const portal = z0 => {
    for (let u = -1; u <= 1; u++) {
      const z = z0 + u, hinge = u < 0 ? 'left' : 'right';
      S.set(0, 1, z, B(WD.door, { facing: 'west', half: 'lower', hinge, open: false, powered: false }));
      S.set(0, 2, z, B(WD.door, { facing: 'west', half: 'upper', hinge, open: false, powered: false }));
      S.set(0, 3, z, TRIM); S.set(0, 4, z, B(SM.accent)); S.set(0, 5, z, B(SM.accent));
      S.set(-1, 0, z, stair(SM.stairs, 'east'));
    }
    S.set(0, 6, z0 - 1, stair(SM.stairs, 'north', 'top')); S.set(0, 6, z0 + 1, stair(SM.stairs, 'south', 'top')); S.set(0, 6, z0, B(SM.accent));
    for (const s of [-1, 1]) { for (let y = 1; y <= 5; y++) S.set(-1, y, z0 + 2 * s, post()); S.set(-1, 6, z0 + 2 * s, B(SM.block)); S.set(-1, 7, z0 + s, stair(SM.stairs, s < 0 ? 'south' : 'north')); }
    S.set(-1, 8, z0, B(SM.block)); S.set(-1, 9, z0, slab(SM.slab));
  };
  portal(0);
  const sideZ = s => towerC(s)[1];
  portal(sideZ(-1)); portal(sideZ(1));
  }
  // gallery of kings: a ledge, a row of figures, a cornice, across the whole front
  if (!detailed && p.kings) for (let z = -edge; z <= edge; z++) {
    S.set(-1, KY, z, slab(SM.slab, 'top'));
    if ((z + edge) % 2 === 0) { S.set(-1, KY + 1, z, post()); S.set(-1, KY + 2, z, post()); }
    S.set(-1, KY + 3, z, stair(SM.stairs, 'east'));
  }
  // open gallery high between the towers
  if (!detailed) {
    for (let z = -hw; z <= hw; z++) for (let y = GY; y <= GY + 2; y++) S.set(0, y, z, (z + hw) % 2 ? AIR : post());
    for (let z = -hw; z <= hw; z++) S.set(-1, GY - 1, z, slab(SM.slab, 'top'));
  }

  // ---- glass ----
  const glassColors = MS.glass ? MS.glass.colors : { colored: ['red', 'blue', 'yellow', 'purple', 'lime', 'light_blue'], blue: ['blue', 'light_blue', 'cyan'], amber: ['yellow', 'orange', 'brown'], clear: [null] }[p.glass] || [null];
  const pane = (x, y, z, ax) => {
    const c = glassColors[Math.floor(_h(seed, 'glass', x, y, z) * glassColors.length)];
    return B(c ? `${c}_stained_glass_pane` : 'glass_pane', { east: ax === 'x', north: ax === 'z', south: ax === 'z', waterlogged: false, west: ax === 'x' });
  };
  const isWall = st => !!st && !/stairs|slab|pane|door|wall\b|_wall$|planks|bell|rod/.test(st.replace(/\[.*$/, ''));
  let nw = 0, roses = 0;
  // pointed window in a straight wall: wide = two lights and a mullion under a pane in the point; else one light
  const lancet = (x, z, alongX, y0, y1, wide = true) => {
    if (y1 < y0 + 1) return false;
    const at = (u, y) => alongX ? [x + u, y, z] : [x, y, z + u], ax = alongX ? 'x' : 'z';
    const us = wide ? [-1, 0, 1] : [0];
    for (const u of us) for (let y = y0; y <= y1 + 1; y++) if (!isWall(S.get(...at(u, y)))) return false;
    if (wide) {
      for (let y = y0; y < y1; y++) for (const u of [-1, 1]) S.set(...at(u, y), pane(...at(u, y), ax));
      S.set(...at(0, y1), pane(...at(0, y1), ax));
      for (const u of [-1, 1]) S.set(...at(u, y1), stair(SM.stairs, alongX ? (u < 0 ? 'west' : 'east') : (u < 0 ? 'north' : 'south'), 'top'));
    } else for (let y = y0; y <= y1; y++) S.set(...at(0, y), pane(...at(0, y), ax));
    nw++; return true;
  };
  const rose = (x, z, yc, Rr, alongX) => {
    const at = (u, y) => alongX ? [x + u, y, z] : [x, y, z + u], ax = alongX ? 'x' : 'z';
    for (let du = -Rr - 1; du <= Rr + 1; du++) for (let dy = -Rr - 1; dy <= Rr + 1; dy++) if (du * du + dy * dy <= (Rr + 1) * (Rr + 1) + 1 && !isWall(S.get(...at(du, yc + dy)))) return false;
    for (let du = -Rr - 1; du <= Rr + 1; du++) for (let dy = -Rr - 1; dy <= Rr + 1; dy++) {
      const qq = du * du + dy * dy, k = at(du, yc + dy);
      const rr = Math.sqrt(qq), ang = Math.atan2(dy, du), sp = Math.abs((((ang / (Math.PI / 4)) % 1) + 1) % 1 - 0.5);
      if (qq === 0 || (Rr >= 4 && ((rr > 1.2 && sp > 0.4 && rr < Rr - 0.5) || (rr > Rr * 0.5 && rr < Rr * 0.5 + 1)))) S.set(...k, B(SM.accent));   // hub, eight spokes and an inner ring (four short spokes read as a cross)
      else if (qq <= Rr * Rr + 1) S.set(...k, pane(...k, ax));
      else if (qq <= (Rr + 1) * (Rr + 1) + 1) S.set(...k, TRIM);
    }
    roses++; return true;
  };
  const tryRose = (x, z, alongX, yHi, yLo, Rr) => { for (let yc = yHi; yc >= yLo; yc--) if (rose(x, z, yc, Rr, alongX)) return yc; return null; };
  const inCross = x => hasT && x >= xc0 - 1 && x <= xc1 + 1;
  const bayMids = []; for (let k = 0; k * bay + (bay >> 1) < xE; k++) { const xm = k * bay + (bay >> 1); if (xm > TL + 1 && !inCross(xm)) bayMids.push(xm); }
  for (const s of [-1, 1]) for (const xm of bayMids) {
    lancet(xm, s * edge, true, 2, (NA === 2 ? OT : IT) - 2);                                     // aisle wall
    if (NA === 2 && GH > 0) lancet(xm, s * (hw + AW), true, OT + 2 + lean(AW), IT - 1, false);     // tribune, above the outer aisle roof
    lancet(xm, s * hw, true, IRT + 2, NT - 2);                                                    // clerestory
  }
  if (hasT) for (const s of [-1, 1]) {                   // transept fronts: a rose high in the gable, a tall window under it
    const ze = s * (edge + tdep), Rr = Math.max(2, Math.min(4, hw - 1));
    const yc = p.rose ? tryRose(xcm, ze, true, NT, NT - 6, Rr) : null;
    lancet(xcm, ze, true, 2, (yc ? yc - Rr - 3 : NT - 3));
  }
  if (p.rose && !detailed) {                             // west rose between the kings and the high gallery
    const lo = (p.kings ? KY + 4 : 10), Rr = Math.max(2, Math.min(4, hw - 1, ((GY - lo) >> 1) - 2));
    tryRose(0, 0, false, Math.round((lo + GY) / 2), lo + Rr + 1, Rr);
  }
  // east end: lights round the apse above the ambulatory roof (or low down without one); chapel windows
  for (const [x, z] of cells) {
    if (x <= xE || zone(x, z) !== H || !border.has(x + ',' + z) || (x + z) & 1) continue;
    const ax = Math.abs(z) > x - xE ? 'x' : 'z', y0 = east === 'chevet' ? IRT + 2 : 2;
    let ok = true; for (let y = y0; y <= NT - 1; y++) if (!isWall(S.get(x, y, z))) ok = false;
    if (ok) { for (let y = y0; y <= NT - 2; y++) S.set(x, y, z, pane(x, y, z, ax)); nw++; }
  }
  if (east === 'flat') lancet(xE, 0, false, 2, NT - 3);
  for (let k = 0; k < nch; k++) {
    const a = -Math.PI / 2 + Math.PI * (k + 0.5) / nch, rr = edge + cd, x = xE + Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr);
    if (zone(x, z) !== C) continue;
    const ax = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) ? 'x' : 'z';
    for (let y = 2; y <= CT - 2; y++) if (isWall(S.get(x, y, z))) S.set(x, y, z, pane(x, y, z, ax));
    nw++;
  }

  // ---- flying buttresses: a pier with a pinnacle outside the aisles, an arch of stone up to the clerestory ----
  let nf = 0; const FLY = [];
  if (p.flying_buttresses && !detailed) {   // the detailed cathedral draws its flyers with gothicFlyer (after the walls)
    const yp = Math.max(IRT, OT + 1 + lean(AW)) + 2, yw = NT - 2;
    for (let xb = 0; xb <= xE; xb += bay) {
      if (xb < TL + 1 || inCross(xb)) continue;
      for (const s of [-1, 1]) {
        const z1 = s * (edge + 1), z2 = s * (edge + 2);
        if (zone(xb, z1) || zone(xb, z2) || S.has(xb, 1, z1) || S.has(xb, 1, z2)) continue;
        for (let y = 0; y <= yp; y++) { S.set(xb, y, z1, B(y ? SM.block : WM.plinth)); S.set(xb, y, z2, B(y ? SM.block : WM.plinth)); }
        S.set(xb, yp + 1, z1, stair(SM.stairs, s > 0 ? 'north' : 'south'));
        if (p.pinnacles && detailed) FLY.push([xb, yp + 1, z2]);   // a proper pinnacle goes on later (gothicPinnacleAt)
        else if (p.pinnacles) { S.set(xb, yp + 1, z2, post()); S.set(xb, yp + 2, z2, post()); S.set(xb, yp + 3, z2, post()); }
        else S.set(xb, yp + 1, z2, stair(SM.stairs, s > 0 ? 'north' : 'south'));
        let py = yp;
        for (let a = edge; a >= hw + 1; a--) {
          const t = (edge + 1 - a) / (edge - hw), z = s * a;
          let y = Math.round(yp + (yw - yp) * t);
          const rh = RH.get(xb + ',' + z); if (rh !== undefined) y = Math.max(y, Math.ceil(rh));
          for (let yy = Math.min(py + 1, y); yy <= y; yy++) if (!/pane/.test(S.get(xb, yy, z) || '')) S.set(xb, yy, z, B(SM.block));
          if (y > py && !S.has(xb, py, z)) S.set(xb, py, z, stair(SM.stairs, s > 0 ? 'south' : 'north', 'top'));   // join each step of the arch to the one below it
          py = y;
        }
        nf++;
      }
    }
  }

  // ---- towers: tall belfry openings on every face, a bell ----
  if (!detailed) for (const s of [-1, 1]) {
    const faces = [[[0, s * (hw + 1)], [0, s * edge]], [[TL - 1, s * (hw + 1)], [TL - 1, s * edge]], [[0, s * edge], [TL - 1, s * edge]], [[0, s * (hw + 1)], [TL - 1, s * (hw + 1)]]];
    for (const [[ax0, az0], [ax1, az1]] of faces) {
      const len = Math.max(Math.abs(ax1 - ax0), Math.abs(az1 - az0)) + 1, k = Math.max(1, Math.floor(len / 3));
      for (const u of [k, len - 1 - k]) {
        const x = ax0 === ax1 ? ax0 : Math.min(ax0, ax1) + u, z = az0 === az1 ? az0 : Math.min(az0, az1) + u;
        for (let y = FT + 2; y <= TT - 3; y++) S.set(x, y, z, AIR);
      }
    }
    const [bx, bz] = towerC(s);
    S.set(bx, TT - 1, bz, B('bell', { attachment: 'ceiling', facing: 'north', powered: false }));
    if (p.pinnacles) for (const [cx, cz] of [[0, s * (hw + 1)], [0, s * edge], [TL - 1, s * (hw + 1)], [TL - 1, s * edge]]) { S.set(cx, TT + 1, cz, wallB(cx, TT + 1, cz)); S.set(cx, TT + 2, cz, post()); S.set(cx, TT + 3, cz, post()); }
  }

  // ---- flèche over the crossing: an open drum, then a needle ----
  let fTop = 0;
  const crossing = !p.fleche || !hasT ? 'none' : (CATHEDRAL_CROSSINGS[p.crossing] ? p.crossing : 'fleche');
  if (crossing === 'fleche' || (crossing !== 'none' && !detailed)) {
    const y0 = ridge, Hf = R.fleche_height, n = Hf - 6;
    for (let y = y0; y < y0 + 6; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const corner = dx && dz, mid = !dx && !dz;
      S.set(xcm + dx, y, dz, corner ? post() : mid ? B(RM.block) : (y > y0 && y < y0 + 5 ? AIR : B(RM.block)));
    }
    for (let i = 0; i < n; i++) {
      const y = y0 + 6 + i;
      if (i < n * 0.3) {
        S.set(xcm, y, 0, B(RM.block));
        for (const [dx, dz] of N4) S.set(xcm + dx, y, dz, stair(RM.stairs, DIR(-dx, -dz)));
      } else S.set(xcm, y, 0, post());
    }
    const y = y0 + 6 + n;
    S.set(xcm, y, 0, post({ north: 'low', south: 'low' })); S.set(xcm, y, -1, post({ up: false, south: 'low' })); S.set(xcm, y, 1, post({ up: false, north: 'low' }));
    S.set(xcm, y + 1, 0, post()); S.set(xcm, y + 2, 0, B('lightning_rod', { facing: 'up', powered: false, waterlogged: false }));
    fTop = y + 3;
  }

  // ---- detailed west front ----
  let GF = null;
  if (detailed) {
    const FM = { ...(GOTHIC_FACADE_MATS[p.walls] || GOTHIC_FACADE_MATS.white) };
    if (MS.stone) Object.assign(FM, { frame: MS.stone.block, stairs: MS.stone.stairs, slab: MS.stone.slab, wall: MS.stone.wall || FM.wall });
    const fo = { ...FM, checkA: p.walls === 'warm' ? 'cut_red_sandstone' : FM.frame, checkB: p.walls === 'warm' ? 'smooth_sandstone' : FM.niche, seed, rose: !!p.rose, kings: !!p.kings, statues: p.statues !== false, pinnacles: !!p.pinnacles, forest: !!p.pinnacles && !!p.pinnacle_forest, orders: R.portal_orders, door: WD.door.replace('_door', '_planks'), doorBack: WD.planks,
      infill: (x, y, z) => wallB(x, y, z), pane: (x, y, z, ax) => pane(x, y, z, ax) };
    if (screen) GF = gothicScreen(S, { hw, NA, AW, edge, NT, IT, OT, ridge, flat: terrace }, fo);
    else GF = gothicFront(S, GL, { ...fo, towerTop: p.tower_top });
    let st = GF.statues, pn = GF.pins;
    const XM = { frame: FM.frame, stairs: FM.stairs, slab: FM.slab, wall: FM.wall };
    if (!screen && p.tower_top === 'openwork') for (const s of [-1, 1]) {          // Cologne: an openwork spire on each tower
      const cx = Math.floor((TL - 1) / 2), R0 = Math.max(2, Math.min(GL.th + 1, cx));
      fTop = Math.max(fTop, gothicSpire(S, XM, cx, TT + 1, s * GL.tc, R0, R0 * 10, 'open', GF.mine, null, R0 * 2 + 2));
      for (const [dx, dz] of [[-R0 - 1, -R0 - 1], [-R0 - 1, R0 + 1], [R0 + 1, -R0 - 1], [R0 + 1, R0 + 1]]) { gothicPinnacleAt(S, fo, cx + dx, TT + 1, s * GL.tc + dz, 4, false, GF.mine); pn++; }
    }
    if (crossing === 'turret') fTop = gothicSpire(S, { frame: 'oxidized_cut_copper', stairs: 'oxidized_cut_copper_stairs', slab: 'oxidized_cut_copper_slab', wall: 'prismarine_wall' }, xcm, ridge - 2, 0, 3, R.fleche_height, 'open', GF.mine, null, 7);   // an open copper stage, then the needle
    if (crossing === 'lantern') fTop = gothicLantern(S, XM, xcm, NT + 1, 0, Math.max(3, Math.min(hw - 1, 7)), ridge - NT + 6, R.fleche_height, GF.mine, (x, y, z, ax) => pane(x, y, z, ax));
    if (crossing === 'cimborio') {                       // Seville: the crossing raised as a lit square box with a balustrade
      const h0 = NT + 1, h1 = NT + 9;
      for (let x = xc0; x <= xc1; x++) for (let z = -hw; z <= hw; z++) {
        const e = x === xc0 || x === xc1 || Math.abs(z) === hw;
        if (e) for (let y = h0; y <= h1; y++) { const win = y >= h0 + 2 && y <= h1 - 2 && ((Math.abs(z) === hw && (x - xc0) % 3 === 1) || ((x === xc0 || x === xc1) && (z + hw) % 3 === 1)); S.set(x, y, z, win ? pane(x, y, z, Math.abs(z) === hw ? 'x' : 'z') : B(FM.frame)); GF.mine.add(x + ',' + y + ',' + z); }
        S.set(x, h1 + 1, z, e ? ((x + z) % 2 ? post() : B(FM.frame)) : slab(SM.slab)); GF.mine.add(x + ',' + (h1 + 1) + ',' + z);
      }
      for (const [x, z] of [[xc0, -hw], [xc0, hw], [xc1, -hw], [xc1, hw]]) { gothicPinnacleAt(S, fo, x, h1 + 2, z, 3, false, GF.mine); pn++; }
      fTop = Math.max(fTop, h1 + 6);
    }
    if (p.campanile) {                                    // Seville: the Giralda, free-standing north of the east end
      const n = Math.max(7, Math.round(W * 0.6)) | 1, H2 = Math.round(NT * 2.1), x0 = (hasT ? xc1 + 3 : xE - n - 4), z0 = -(edge + 7 + n);
      fTop = Math.max(fTop, gothicCampanile(S, { ...FM, brick: 'bricks', brickWall: 'brick_wall' }, x0, z0, n, H2, GF.mine));
      report.push(`独立钟楼：${n}×${n}，高 ${H2}`);
    }
    if (p.court) {                                         // Seville: the court of oranges, north of the nave
      const x0 = 2, x1 = Math.max(x0 + 12, (hasT ? xc0 : xE - 16) - 3), z1 = -(edge + 7), z0 = z1 - 22;
      gothicCourt(S, FM, x0, x1, z0, z1, GF.mine);
      report.push(`橘树庭院：${x1 - x0 + 1}×${z1 - z0 + 1}`);
    }
    if (!screen && TL >= 8) for (const s of [-1, 1]) { const r = gothicTowerSide(S, GL, fo, s, edge, 4, TL - 1, GF.mine); st += r.statues; pn += r.pins; }
    // aisle walls of the nave and the choir, and the transept fronts below their roses
    const vSide = NA === 2 ? OT : IT, eastX = east === 'flat' ? xE : xE - 1;
    for (const s of [-1, 1]) {
      gothicSideWall(S, fo, s, edge, TL + 1, hasT ? xc0 - 2 : eastX, bay, vSide, GF.mine);
      if (hasT && xc1 + 2 < eastX) gothicSideWall(S, fo, s, edge, xc1 + 2, eastX, bay, vSide, GF.mine);
      if (hasT && tdep >= 0) { const r = gothicTransept(S, { ...fo, bigWindow: !p.rose }, s, edge + tdep, xc0, xc1, p.rose ? Math.max(8, NT - 2 * Math.max(2, Math.min(4, hw - 1)) - 9) : NT, GF.mine, NT, ridge); st += r.statues;
        if (tdep >= 1) for (const [sx, xf] of [[-1, xc0], [1, xc1]]) gothicShortWall(S, fo, sx, xf, s * (edge + 1), s * (edge + tdep - 1), vSide, GF.mine); }
    }
    // clerestory: piers where the flyers land, a lancet per bay (no clearing: the flyers and aisle roofs are in front)
    const fc = { ...fo, clear: false };
    for (const s of [-1, 1]) {
      gothicSideWall(S, fc, s, hw, TL + 1, hasT ? xc0 - 2 : xE, bay, NT, GF.mine, IRT + 1);
      if (hasT && xc1 + 2 < xE) gothicSideWall(S, fc, s, hw, xc1 + 2, xE, bay, NT, GF.mine, IRT + 1);
    }
    if (p.flying_buttresses) {
      const yp = Math.max(IRT, OT + 1 + lean(AW)) + 2, yw = NT - 2, fl = { ...fo, plinth: WM.plinth, pinnacles: true };
      for (let xb = 0; xb <= xE; xb += bay) {
        if (xb < TL + 1 || inCross(xb)) continue;
        for (const s of [-1, 1]) { if (zone(xb, s * (edge + 1)) || zone(xb, s * (edge + 3))) continue; gothicFlyer(S, fl, s, xb, edge, yp, hw + 1, yw, RH, GF.mine, fo.forest && NA === 2 ? hw + AW : null); nf++; pn++; }
      }
    }
    // east end: a stepped pier with a pinnacle between every two radiating chapels (or round the apse)
    if (east !== 'flat') {
      const rOut = east === 'chevet' ? (NA === 2 ? edge : hw + AW) : hw, nP = east === 'chevet' ? Math.max(2, nch + 1) : 5, top = east === 'chevet' ? (NA === 2 ? OT : IT) : NT;
      for (let k = 0; k < nP; k++) {
        const a = -Math.PI / 2 + Math.PI * k / (nP - 1);
        for (const rr of [rOut + 1, rOut + 2]) {
          const x = xE + Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr);
          if (x <= xE || zone(x, z) || S.has(x, 2, z)) continue;
          const h = rr === rOut + 1 ? top : top - 4;
          for (let y = 0; y <= h; y++) S.set(x, y, z, B(y ? FM.frame : WM.plinth));
          if (rr === rOut + 2) { gothicPinnacleAt(S, fo, x, h + 1, z, 2, false, GF.mine); pn++; }
          else { gothicPinnacleAt(S, fo, x, h + 1, z, 3, true, GF.mine); pn++; }
        }
        if (east !== 'chevet' || !p.flying_buttresses) continue;
        // a flyer from the inner pier up to the apse's high wall, and a pilaster on that wall where it lands
        const y0 = top + 1, y1 = NT - 2; let py = null, pxz = null;
        for (let rr = rOut; rr >= hw + 1; rr--) {
          const x = xE + Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr);
          if (x <= xE) { py = null; pxz = null; continue; }
          let y = Math.round(y0 + (y1 - y0) * (rOut - rr) / Math.max(1, rOut - hw - 1));
          const rh = RH.get(x + ',' + z); if (rh !== undefined) y = Math.max(y, Math.ceil(rh));
          const col = (cx, cz, ya, yb) => { for (let yy = ya; yy <= yb; yy++) if (!/pane/.test(S.get(cx, yy, cz) || '')) { S.set(cx, yy, cz, B(FM.frame)); GF.mine.add(cx + ',' + yy + ',' + cz); } };
          if (pxz && pxz[0] !== x && pxz[1] !== z) col(pxz[0], z, Math.min(py, y), Math.max(py, y));   // a diagonal step: fill the corner so the arch stays joined
          col(x, z, py === null ? y : Math.min(py, y), y);
          py = y; pxz = [x, z];
        }
        const xw = xE + Math.round(Math.cos(a) * (hw + 1)), zw = Math.round(Math.sin(a) * (hw + 1));
        if (xw > xE) for (let y = IRT + 1; y <= NT; y++) if (!S.has(xw, y, zw)) { S.set(xw, y, zw, B(FM.frame)); GF.mine.add(xw + ',' + y + ',' + zw); }
        if (xw > xE && fo.forest) { gothicPinnacleAt(S, fo, xw, NT + 1, zw, 4, true, GF.mine); pn++; }   // Cologne: a big pinnacle over every pilaster of the choir
      }
    }
    for (const [x, z] of cells) {                 // chapels: a frame plinth and an overhanging cornice
      if (zone(x, z) !== C || !border.has(x + ',' + z)) continue;
      for (const [dx, dz] of N4) if (!zone(x + dx, z + dz)) {
        if (!S.has(x + dx, 1, z + dz)) S.set(x + dx, 1, z + dz, stair(FM.stairs, DIR(-dx, -dz)));
        if (!S.has(x + dx, CT, z + dz)) S.set(x + dx, CT, z + dz, stair(FM.stairs, DIR(-dx, -dz), 'top'));
      }
    }
    for (const k of GF.mine) {                     // anything of ours standing on a bottom slab would hover half a block: make that slab a full block
      const b = S.blocks.get(k); if (!b || /_slab|_stairs|end_rod|_pane/.test(b)) continue;
      const [x, y, z] = k.split(',').map(Number), u = S.get(x, y - 1, z);
      if (u && /_slab\[.*type=bottom/.test(u)) S.set(x, y - 1, z, B(FM.frame));
    }
    const nfl = gothicDropFloating(S, GF.mine);
    report.push(`${screen ? '屏风立面' : '精细西立面'}：宽 ${GF.width}，${st} 座雕像、${pn} 座小尖塔`);
  }

  // ---- inside (off by default): altar in the apse, choir stalls, hanging lanterns ----
  if (p.interior) {
    const ax = east === 'flat' ? xE - 2 : xE;
    for (let z = -1; z <= 1; z++) S.set(ax, 1, z, B(SM.accent));
    S.set(ax, 2, -1, B('candle', { candles: 3, lit: true, waterlogged: false })); S.set(ax, 2, 1, B('candle', { candles: 3, lit: true, waterlogged: false }));
    S.set(ax, 2, 0, B('lectern', { facing: 'west', has_book: true, powered: false }));
    const c0 = hasT ? xc1 + 2 : xN + 2;
    for (let x = c0; x < xE - 1; x++) for (const s of [-1, 1]) { const z = s * (hw - 1); if (!S.has(x, 1, z)) S.set(x, 1, z, stair(WD.stairs, s < 0 ? 'north' : 'south')); }
    for (const xm of bayMids) { S.set(xm, NT, 0, B('chain', { axis: 'y', waterlogged: false })); S.set(xm, NT - 1, 0, B('lantern', { hanging: true, waterlogged: false })); }
  }

  report.push(...matRep);
  fixConnections(S); stairShapes(S);
  const [[bx0, , bz0], [bx1, by1, bz1]] = S.bounds();
  report.unshift(`主教座堂（${CATHEDRAL_STYLES[p.style] || CATHEDRAL_STYLES.french}）：中殿 ${NB} 开间 × ${bay} 格、宽 ${W}；每侧侧廊 ${NA} 条（各宽 ${AW}）` +
    (hasT ? `；耳堂伸出侧廊外 ${tdep} 格` : '') + `；唱诗堂 ${CB} 开间；东端${CATHEDRAL_EAST[east]}` + (nch ? `（${nch} 个小礼拜堂）` : '') +
    `；剖面：拱廊 ${AH}` + (GH ? ` + 楼廊 ${GH}` : '') + ` + 高侧窗 ${CH}，中殿墙高 ${NT}、屋脊 ${ridge}；西立面高 ${FT}，双塔高 ${TT}` + (fTop ? `，交叉处尖塔顶 ${fTop}` : '') +
    `；窗 ${nw} 扇、玫瑰窗 ${roses} 扇、飞扶壁 ${nf} 道；总尺寸 ${bx1 - bx0 + 1}×${bz1 - bz0 + 1}，高 ${by1 + 1}` + (p.interior ? '；内部有祭坛、唱诗席' : ''));
  const spec = { ...p, ...R, facade: detailed ? 'detailed' : 'simple', width: W, aisles: NA, east_end: east, chapels: nch || R.chapels };
  return { S, foot: [bx0, bx1, bz0, bz1], tags: ['landmark', 'cathedral'], report, spec, adjust };
}
