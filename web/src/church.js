// ---------------------------------------------------------------------------------------------
// Chapel / parish church (小礼拜堂 / 教区教堂). Long axis along x: west (x < 0) is the entrance end,
// east is the altar end; north is -z, south is +z. The plan is a set of rectangular volumes with
// disjoint footprints (after English parish-church ground plans):
//   nave, optional lean-to aisles (侧廊) with a clerestory, optional transept (耳堂) / crossing,
//   chancel, apse (round / flat / none), south or north porch (门廊).
// The tower can stand at the west end, at a west corner beside the facade, on the flank (its ground
// floor doubling as the porch) or over the crossing; or there is only a bellcote.
// Roofs of the nave, transept and crossing merge as one height field, so their ridges and valleys meet.
// Every glass pane is written with its two arms along the wall already on, and fixConnections keeps
// those arms when the pane has nothing to lean on, so no window shrinks to a bare post.
// ---------------------------------------------------------------------------------------------
const CHURCH_KINDS = { chapel: '小礼拜堂', parish: '教区教堂' };
const CHURCH_WALLS = {
  stone: { label: '石砖', mix: [['stone_bricks', 6], ['cracked_stone_bricks', 2], ['mossy_stone_bricks', 1]], plinth: 'cobblestone', set: 'stone' },
  rough: { label: '毛石', mix: [['cobblestone', 4], ['stone', 3], ['mossy_cobblestone', 2], ['andesite', 1]], plinth: 'mossy_cobblestone', set: 'mossy' },
  sandstone: { label: '砂岩', mix: [['cut_sandstone', 5], ['sandstone', 3], ['smooth_sandstone', 1]], plinth: 'sandstone', set: 'sandstone' },
  dark: { label: '深板岩', mix: [['deepslate_bricks', 5], ['cracked_deepslate_bricks', 2], ['deepslate_tiles', 1]], plinth: 'cobbled_deepslate', set: 'dark' },
  white: { label: '白石（方解石）', mix: [['calcite', 5], ['diorite', 2], ['polished_diorite', 1]], plinth: 'stone_bricks', set: 'stone' },
};
const CHURCH_ROOFS = {
  slate: { label: '深色石板', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', block: 'deepslate_tiles' },
  dark_oak: { label: '深色橡木瓦', stairs: 'dark_oak_stairs', slab: 'dark_oak_slab', block: 'dark_oak_planks' },
  spruce: { label: '云杉木瓦', stairs: 'spruce_stairs', slab: 'spruce_slab', block: 'spruce_planks' },
  stone: { label: '石瓦', stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', block: 'stone_bricks' },
  copper: { label: '氧化铜', stairs: 'waxed_oxidized_cut_copper_stairs', slab: 'waxed_oxidized_cut_copper_slab', block: 'waxed_oxidized_cut_copper' },
};
const CHURCH_GLASS = { colored: '彩色玻璃', clear: '透明玻璃', blue: '蓝色调', amber: '琥珀色调' };
const TOWER_TOPS = { spire: '细长尖塔', stepped: '阶梯尖塔', battlement: '雉堞平顶', pyramid: '矮四坡顶' };
const ROOF_PITCHES = { normal: { label: '标准（45°）', r: 1 }, medium: { label: '中陡', r: 1.5 }, steep: { label: '陡', r: 2 }, very_steep: { label: '很陡', r: 3 } };
const SPIRE_HEIGHTS = { normal: { label: '普通', k: 2.5 }, tall: { label: '高', k: 3.5 }, very_tall: { label: '很高', k: 5 } };
const CHURCH_WINDOWS = { romanesque: '罗马式圆拱', lancet: '单尖拱（细长）', gothic: '双尖拱', triple: '三联尖拱（中高侧低）', wide: '宽窗（三格 + 尖顶）', rose: '十字小圆窗', slit: '窄缝窗' };
const WALL_TRIM = { stone: 'polished_andesite', rough: 'stone', sandstone: 'smooth_sandstone', dark: 'polished_deepslate', white: 'polished_andesite' };
const TOWER_POS = { seed: '由种子决定', west: '西端正中', corner: '西端角塔（立面一侧）', side: '侧塔（底层兼门廊）', crossing: '中央塔（十字交叉处）', bellcote: '无塔 · 山墙钟架', none: '无塔' };
const CHURCH_SIDES = { seed: '由种子决定', south: '南侧', north: '北侧' };
const CHURCH_PORCH = { seed: '由种子决定', none: '无', south: '南侧', north: '北侧' };
const CHURCH_DEFAULT = {
  kind: 'parish', length: 21, width: 11, wall_height: 8, chancel: true, chancel_length: 7, apse: 'round',
  tower: 'seed', tower_side: 'seed', tower_section: 'square', tower_storeys: 2, tower_top: 'spire',
  transept: true, transept_depth: 4, aisles: true, clerestory_height: 4, porch_height: 3, porch: 'seed', rose: true, pinnacles: true,
  roof_pitch: 'steep', flare: true, spire_height: 'tall', windows: 'gothic', window_frame: true, buttresses: true, interior: true, walls: 'stone', roof: 'slate', glass: 'colored', seed: 1,
};
const CHAPEL_DEFAULT = { length: 13, width: 9, wall_height: 6, chancel: false, tower: 'bellcote', windows: 'romanesque', roof_pitch: 'medium', transept: false, aisles: false, rose: false };

// free colouring: every slot can stay on the preset, take a colour (nearest block) or named blocks (see matslots.js)
const CHURCH_MAT_SLOTS = {
  wall: { kind: 'mix', label: '墙体' },
  plinth: { kind: 'block', label: '墙基' },
  stone: { kind: 'stone', label: '石作（扶壁、窗肩、门拱、柱、钟架）' },
  accent: { kind: 'block', label: '点缀块（拱心石、塔楼腰线）' },
  trim: { kind: 'block', label: '窗台与窗楣、玫瑰窗框' },
  roof: { kind: 'roof', label: '屋顶与塔顶' },
  floor: { kind: 'mix', label: '地面（前两种交替）' },
  wood: { kind: 'wood', label: '木作（门、长椅、楼板）' },
  glass: { kind: 'glass', label: '玻璃' },
};
function church(o = {}) {
  const chapel = o.kind === 'chapel';
  const p = { ...CHURCH_DEFAULT, ...(chapel ? CHAPEL_DEFAULT : {}), ...o };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const L = cl(p.length | 0, 9, 41), W = cl(p.width | 0, 7, 17) | 1, hw = W >> 1;
  let WH = cl(p.wall_height | 0, 5, 14);
  const seed = p.seed || 1;
  const matRep = [], MS = resolveMats(CHURCH_MAT_SLOTS, p.mats, matRep);
  const WM0 = CHURCH_WALLS[p.walls] || CHURCH_WALLS.stone, RM0 = CHURCH_ROOFS[p.roof] || CHURCH_ROOFS.slate;
  const SM0 = FOUNTAIN_MATERIALS[WM0.set] || FOUNTAIN_MATERIALS.stone;          // stairs / walls / accent of the stone
  const WM = { ...WM0, ...(MS.wall ? { mix: MS.wall.mix } : {}), ...(MS.plinth ? { plinth: MS.plinth.block } : {}) };
  const RM = MS.roof ? { ...RM0, stairs: MS.roof.stairs, slab: MS.roof.slab, block: MS.roof.block } : RM0;
  const SM = { ...SM0, ...(MS.stone ? { block: MS.stone.block, stairs: MS.stone.stairs, slab: MS.stone.slab, wall: MS.stone.wall || SM0.wall, accent: MS.stone.accent } : {}), ...(MS.accent ? { accent: MS.accent.block } : {}) };
  const FL = MS.floor ? [MS.floor.mix[0][0], (MS.floor.mix[1] || MS.floor.mix[0])[0]] : ['polished_andesite', 'stone_bricks'];
  const WD = { door: 'dark_oak_door', stairs: 'spruce_stairs', planks: 'spruce_planks', ...(MS.wood || {}) };
  const rng = new PyRandom(deriveSeed(seed, 'church'));
  const S = new Structure();
  const wallB = (x, y, z) => B(pickU(patchNoise(x, y, z, deriveSeed(seed, 'church-wall'), 'cw', 2), WM.mix));
  const stair = (m, f, half = 'bottom') => B(m, { facing: f, half, shape: 'straight', waterlogged: false });
  const slab = (m, type = 'bottom') => B(m, { type, waterlogged: false });
  const post = (c = {}) => B(SM.wall, { east: 'none', north: 'none', south: 'none', up: true, waterlogged: false, west: 'none', ...c });
  const AIR = 'minecraft:air';
  const report = [], adjust = [];   // adjust: [{ key, got, why }] — sizes that could not be built as asked
  if (o.width !== undefined && (o.width | 0) % 2 === 0 && o.width >= 7 && o.width <= 17) adjust.push({ key: 'width', got: W, why: '中殿宽必须是奇数，屋脊和中门才能落在正中一格' });
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const BACK = { north: 'south', south: 'north', east: 'west', west: 'east' };

  // ---- choices the seed makes (always drawn in the same order, so a fixed choice never shifts the others) ----
  const r1 = rng.random(), r2 = rng.random();
  let tpos = TOWER_POS[p.tower] ? p.tower : 'west';
  if (tpos === 'seed') {
    const opts = chapel ? [['bellcote', 4], ['west', 2], ['corner', 2]] : [['west', 4], ['corner', 3], ['side', 2], ['crossing', 2]];
    let t = r1 * opts.reduce((a, [, w]) => a + w, 0); tpos = opts[opts.length - 1][0];
    for (const [k, w] of opts) { t -= w; if (t < 0) { tpos = k; break; } }
  }
  const sd = p.tower_side === 'north' ? -1 : p.tower_side === 'south' ? 1 : (r2 < 0.65 ? 1 : -1);   // most towers and porches stand on the south
  let porchSide = p.porch === 'south' ? 1 : p.porch === 'north' ? -1 : p.porch === 'seed' ? (tpos === 'side' ? 0 : tpos === 'corner' ? -sd : 1) : 0;

  // ---- aisles: lean-to roofs of slabs, half a block per row; the nave rises above them as a clerestory ----
  const aisles = !!p.aisles, AW = 3;
  let AT = 0;
  // with aisles: wall_height is the ground storey (aisle walls, arcade); clerestory_height is the upper storey,
  // counted from the top of the aisle roof to the nave wall top. Each is set on its own.
  const CH = cl((p.clerestory_height ?? 4) | 0, 3, 10);
  if (aisles) { AT = WH; WH = AT + 3 + CH; }
  const edge = hw + (aisles ? AW : 0);                                        // outer face of the body (nave or aisle wall)

  // ---- volumes ----
  const vols = [];
  const V = (name, x0, x1, z0, z1, axis, top, roof = 'gable', extra = {}) => { const v = { name, x0, x1, z0, z1, axis, top, roof, ...extra }; vols.push(v); return v; };
  const nave = V('nave', 0, L - 1, -hw, hw, 'x', WH);
  if (aisles) for (const s of [-1, 1]) V('aisle', 0, L - 1, s > 0 ? hw + 1 : -hw - AW, s > 0 ? hw + AW : -hw - 1, 'x', AT, 'lean', { s });
  let xe = L, cross = null, transept = null, tdep = 0;
  if (p.transept) {
    tdep = cl(p.transept_depth | 0, 2, 8);
    const ext = edge - hw + tdep;
    transept = V('transept', xe, xe + W - 1, -hw - ext, hw + ext, 'z', WH);
    cross = [xe, xe + W - 1]; xe += W;
  } else if (tpos === 'crossing') { V('crossing', xe, xe + W - 1, -hw, hw, 'x', WH); cross = [xe, xe + W - 1]; xe += W; }
  let chancel = null;
  if (p.chancel && chapel) adjust.push({ key: 'chancel', got: false, why: '小礼拜堂不带圣坛段；要圣坛请把类型改成教区教堂' });
  if (p.chancel && !chapel) {
    const CL = cl(p.chancel_length | 0, 4, 15), chw = Math.max(2, hw - 2);
    chancel = V('chancel', xe, xe + CL - 1, -chw, chw, 'x', WH - 2); xe += CL;
  }
  const last = { x1: xe - 1, hw: chancel ? chancel.z1 : hw, top: chancel ? chancel.top : WH };
  const apseR = p.apse === 'none' ? 0 : last.hw;
  if (apseR && p.apse === 'flat') V('apse', last.x1 + 1, last.x1 + 2, -(last.hw - 1), last.hw - 1, 'x', last.top - 1);
  const roundApse = apseR > 0 && p.apse === 'round';
  const apseVol = { name: 'apse', top: last.top, roof: 'apse' };
  const inApse = (x, z) => roundApse && x > last.x1 && Math.hypot(x - last.x1, z) <= apseR + 0.4;

  // ---- tower footprint (decided before the porch so they never meet) ----
  const hasTower = ['west', 'corner', 'side', 'crossing'].includes(tpos);
  const T = tpos === 'crossing' ? W : (W >= 11 ? 7 : 5), th = T >> 1, oct = p.tower_section === 'octagon';
  let tcx = 0, tcz = 0;
  if (tpos === 'west') tcx = -th - 1;
  else if (tpos === 'corner') { tcx = th; tcz = sd * (edge + 1 + th); }
  else if (tpos === 'side') { tcx = cl(Math.round(L * 0.3), th + 1, Math.max(th + 1, L - th - 2)); tcz = sd * (edge + 1 + th); }
  else if (tpos === 'crossing') tcx = cross[0] + hw;
  const inT = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz)) <= th && (!oct || Math.abs(dx) + Math.abs(dz) <= th + Math.floor(th / 2) + 1);
  const inTower = (x, z, m = 0) => hasTower && Math.abs(x - tcx) <= th + m && Math.abs(z - tcz) <= th + m;

  let porch = null;
  if (porchSide) {
    let px = Math.max(3, Math.round(L * 0.3));
    if ((tpos === 'corner' || tpos === 'side') && porchSide === sd) px = Math.max(px, tcx + th + 4);
    if (px + 3 <= L - 1) porch = V('porch', px - 2, px + 2, porchSide > 0 ? edge + 1 : -edge - 4, porchSide > 0 ? edge + 4 : -edge - 1, 'z', cl((p.porch_height ?? 3) | 0, 2, 16), 'gable', { ps: porchSide, px });
    else if (p.porch !== 'seed') { report.push('门廊：中殿太短（或被塔楼占了位置），放不下门廊'); adjust.push({ key: 'porch', got: '无', why: '中殿太短或被同侧塔楼占了位置，放不下门廊；加长中殿或换一侧' }); }
  }

  const owner = (x, z) => { for (const v of vols) if (x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1) return v; return inApse(x, z) ? apseVol : null; };
  const inside = (x, z) => owner(x, z) !== null;
  const occupied = (x, z) => inside(x, z) || inTower(x, z);
  const border = (x, z) => N8.some(([dx, dz]) => !inside(x + dx, z + dz));

  // ---- shell: walls on the outline of the union; where a lower volume meets a taller one, the taller one's wall
  // carries on above the lower roofline (clerestory over the aisles, transept wall over the chancel) ----
  const minX = Math.min(...vols.map(v => v.x0)), maxX = last.x1 + apseR + 3;
  const minZ = Math.min(...vols.map(v => v.z0)), maxZ = Math.max(...vols.map(v => v.z1));
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
    const v = owner(x, z); if (!v) continue;
    const b = border(x, z);
    S.set(x, 0, z, b ? B(WM.plinth) : B((x + z) % 2 ? FL[0] : FL[1]));
    if (b) { for (let y = 1; y <= v.top; y++) S.set(x, y, z, wallB(x, y, z)); continue; }
    let lo = Infinity;
    for (const [dx, dz] of N4) { const n = owner(x + dx, z + dz); if (n && n.top < v.top) lo = Math.min(lo, n.top); }
    for (let y = lo + 1; y <= v.top; y++) S.set(x, y, z, wallB(x, y, z));
  }

  // ---- roofs ----
  const PR = ROOF_PITCHES[p.roof_pitch] || ROOF_PITCHES.steep, pitch = PR.r, flare = !!p.flare;
  const rise = d => d <= 0 ? 0 : flare ? 1 + Math.round(pitch * (d - 1)) : Math.round(pitch * d);
  const geo = v => v.axis === 'x' ? { c: (v.z0 + v.z1) / 2, h: (v.z1 - v.z0) / 2, w0: v.x0, w1: v.x1 } : { c: (v.x0 + v.x1) / 2, h: (v.x1 - v.x0) / 2, w0: v.z0, w1: v.z1 };
  const xzOf = (v, w, u) => v.axis === 'x' ? [w, geo(v).c + u] : [geo(v).c + u, w];
  const uwOf = (v, x, z) => v.axis === 'x' ? [z - geo(v).c, x] : [x - geo(v).c, z];
  const surf = (v, u) => v.top + 1 + rise(geo(v).h + 1 - Math.abs(u));
  const own = (v, x, z) => x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1;
  const endFree = (v, w) => { const [x, z] = xzOf(v, w, 0); return !occupied(x, z); };
  // roof height of the part under (x, z), if it is a lower part that an eave may hang over; Infinity otherwise
  const lowerAt = (x, z) => {
    if (inTower(x, z)) return Infinity;
    const o = owner(x, z); if (!o || o.roof === 'apse') return Infinity;
    if (o.roof === 'lean') { const k = AW + 1 - (o.s * z - hw); return o.top + 1 + ((k + 1) >> 1); }
    const [uo] = uwOf(o, x, z); return surf(o, uo);
  };
  // group: parts whose roofs merge (the nave roof runs on over the crossing, so the two ridges really cross)
  const gableCells = (v, group = null, w1 = null) => {
    const g = geo(v), out = [];
    const a = g.w0 - (endFree(v, g.w0 - 1) ? 1 : 0), b = w1 !== null ? w1 : g.w1 + (endFree(v, g.w1 + 1) ? 1 : 0);
    for (let w = a; w <= b; w++) for (let u = -g.h - 1; u <= g.h + 1; u++) {
      const [x, z] = xzOf(v, w, u);
      const h = surf(v, u);
      if (!own(v, x, z) && occupied(x, z) && !(group && Math.abs(u) <= g.h && group.some(o => own(o, x, z))) && !(lowerAt(x, z) < h - 1)) continue;   // overhang into another part or the tower (fine over a lower roof)
      out.push({ x, z, u, w, v, h, d: g.h + 1 - Math.abs(u) });
    }
    return { out, a, b };
  };
  const placeGable = c => {
    const { x, z, u, h, v, d } = c, below = d > 0 ? v.top + 1 + rise(d - 1) + 1 : h;
    for (let yy = below; yy < h; yy++) S.set(x, yy, z, B(RM.block));
    if (u === 0) S.set(x, h, z, slab(RM.slab));
    else S.set(x, h, z, stair(RM.stairs, v.axis === 'x' ? (u < 0 ? 'south' : 'north') : (u < 0 ? 'east' : 'west')));
  };
  const flareRow = (v, a, b) => {
    if (!flare) return;
    const g = geo(v);
    for (let w = a; w <= b; w++) for (const u of [-g.h - 2, g.h + 2]) { const [x, z] = xzOf(v, w, u); if (!occupied(x, z) && !S.has(x, v.top + 1, z)) S.set(x, v.top + 1, z, slab(RM.slab)); }
  };
  const leanY = (v, z) => { const k = AW + 1 - (v.s * z - hw); return { y: v.top + 1 + ((k + 1) >> 1), type: (k + 1) % 2 ? 'top' : 'bottom' }; };   // half a block up from the wall top
  // lower parts first, the main body last (it overwrites where they touch)
  for (const v of vols) {
    if (v.roof === 'lean') {
      const a = v.x0 - (endFree(v, v.x0 - 1) ? 1 : 0), b = v.x1 + (endFree(v, v.x1 + 1) ? 1 : 0);
      for (let x = a; x <= b; x++) for (let e = 1; e <= AW + 1; e++) {
        const z = v.s * (hw + e), { y, type } = leanY(v, z);
        if (!own(v, x, z) && occupied(x, z) && !(lowerAt(x, z) < y)) continue;   // the eave may hang over a lower part (the porch)
        S.set(x, y, z, slab(RM.slab, type));
      }
    } else if (v.name === 'chancel' || v.name === 'porch' || v.name === 'apse') { const { out, a, b } = gableCells(v); out.forEach(placeGable); }
  }
  // porch against an aisle: carry its gable roof back over the aisle roof until it dies into the slope, so porch
  // and aisle read as one roof (a dormer-like ridge), with roof stone filling between the two surfaces
  if (porch && aisles) {
    const g = geo(porch), ps = porch.ps, lv = vols.find(v => v.roof === 'lean' && v.s === ps);
    for (let e = AW + 1; e >= 1; e--) {
      const z = ps * (hw + e);
      for (let u = -g.h - 1; u <= g.h + 1; u++) {
        const x = porch.px + u, h = surf(porch, u), { y: ly } = leanY(lv, z);
        if (h < ly || inTower(x, z)) continue;
        for (let yy = ly; yy < h; yy++) S.set(x, yy, z, B(RM.block));
        if (u === 0) S.set(x, h, z, slab(RM.slab)); else S.set(x, h, z, stair(RM.stairs, u < 0 ? 'east' : 'west'));
      }
    }
  }
  const main = vols.filter(v => v.name === 'nave' || v.name === 'transept' || v.name === 'crossing');
  const best = new Map();
  for (const v of main) {
    const { out, a, b } = gableCells(v, main, v === nave && transept ? cross[1] : null);
    for (const c of out) { const k = c.x + ',' + c.z, o = best.get(k); if (!o || c.h > o.h || (c.h === o.h && c.u === 0)) best.set(k, c); }
    v._ab = [a, b];
  }
  for (const c of best.values()) placeGable(c);

  // walls up to the roof: gable ends, eave gaps, steps between parts; a gable end that butts against another
  // part is closed too (the porch's inner end above the aisle roof)
  for (const v of vols) {
    if (v.roof === 'gable') {
      const g = geo(v), isMain = main.includes(v);
      const abut0 = !endFree(v, g.w0 - 1), abut1 = !endFree(v, g.w1 + 1);
      for (let x = v.x0; x <= v.x1; x++) for (let z = v.z0; z <= v.z1; z++) {
        const [u, w] = uwOf(v, x, z);
        if (!(border(x, z) || Math.abs(u) === g.h || w === g.w0 || w === g.w1)) continue;
        const lo = S.has(x, v.top, z) || border(x, z) || (v.name === 'porch' && ((w === g.w0 && abut0) || (w === g.w1 && abut1))) ? v.top + 1 : Infinity;
        const c = isMain ? best.get(x + ',' + z) : null, hi = c ? c.h : surf(v, u);
        // roof stone, not wall, where the block shows: the riser above the next row's stair at a gable edge, and
        // anything above this part's own roofline (another roof's gable end, e.g. the nave roof over the crossing)
        const d = g.h + 1 - Math.abs(u), rb = Math.min(isMain ? surf(v, u) : Infinity, d > 0 ? v.top + 2 + rise(d - 1) : Infinity);
        for (let y = lo; y < hi; y++) S.set(x, y, z, y >= rb ? B(RM.block) : wallB(x, y, z));
      }
    } else if (v.roof === 'lean') {
      for (let x = v.x0; x <= v.x1; x++) for (let z = v.z0; z <= v.z1; z++) {
        if (!border(x, z) && z !== v.s * edge) continue;                      // outer wall, also where the porch hides it
        const { y, type } = leanY(v, z);
        for (let yy = v.top + 1; yy < y; yy++) S.set(x, yy, z, wallB(x, yy, z));
        if (type === 'top' && (x === v.x0 || x === v.x1)) S.set(x, y, z, B(RM.block));   // end walls: close the half step under a top slab with roof stone
      }
    }
  }

  // round apse: half cone of stairs climbing to the ridge of the part it closes
  if (roundApse) {
    const cx = last.x1, top = last.top, ghw = last.hw;
    for (let x = cx + 1; x <= cx + apseR + 1; x++) for (let z = -apseR - 1; z <= apseR + 1; z++) {
      const r = Math.hypot(x - cx, z); if (r > apseR + 1.4) continue;
      const d = Math.min(ghw + 1, Math.max(0, apseR + 1 - r)), y = top + 1 + rise(Math.round(d));
      const f = Math.abs(z) > (x - cx) ? (z < 0 ? 'south' : 'north') : 'west';
      S.set(x, y, z, stair(RM.stairs, f)); S.set(x, y - 1, z, B(RM.block));
      for (let yy = top + 1; yy < y - 1; yy++) if (inApse(x, z)) S.set(x, yy, z, B(RM.block));
    }
  }

  // ---- windows ----
  const glassColors = MS.glass ? MS.glass.colors : { colored: ['red', 'blue', 'yellow', 'purple', 'lime', 'light_blue'], blue: ['blue', 'light_blue', 'cyan'], amber: ['yellow', 'orange', 'brown'], clear: [null] }[p.glass] || [null];
  // ax: the wall runs along x ('x': arms east + west) or along z ('z': arms north + south)
  const pane = (x, y, z, ax) => {
    const c = glassColors[Math.floor(_h(seed, 'glass', x, y, z) * glassColors.length)];
    return B(c ? `${c}_stained_glass_pane` : 'glass_pane', { east: ax === 'x', north: ax === 'z', south: ax === 'z', waterlogged: false, west: ax === 'x' });
  };
  const wstyle = CHURCH_WINDOWS[p.windows] ? p.windows : 'gothic';
  const trim = B(MS.trim ? MS.trim.block : WALL_TRIM[p.walls] || 'polished_andesite');
  const bay = wstyle === 'triple' || wstyle === 'wide' ? 5 : 4, nw = [];
  const SPAN = { romanesque: 1, lancet: 1, gothic: 2, triple: 3, wide: 2, rose: 1, slit: 1 };
  const blocked = (x, z) => inTower(x, z, 1) || (porch && x >= porch.x0 - 1 && x <= porch.x1 + 1 && z >= porch.z0 - 1 && z <= porch.z1 + 1);
  const fits = (x, z, alongX, span, needWall = true) => {
    for (let u = -span; u <= span; u++) {
      const [a, b] = alongX ? [x + u, z] : [x, z + u];
      if (blocked(a, b) || (needWall && !(inside(a, b) && border(a, b)))) return false;
    }
    return true;
  };
  // a window = glass cells (u across the wall, y), shoulder stairs, a keystone; optional sill + hood
  const openWin = (x, z, y0, h, alongX, style = wstyle, frame = !!p.window_frame) => {
    const ax = alongX ? 'x' : 'z';
    const at = (u, y) => alongX ? [x + u, y, z] : [x, y, z + u];
    const sh = (u, y, half = 'top') => S.set(...at(u, y), alongX ? stair(SM.stairs, u < 0 ? 'west' : 'east', half) : stair(SM.stairs, u < 0 ? 'north' : 'south', half));
    const gl = (u, y) => S.set(...at(u, y), pane(...at(u, y), ax));
    let us = [0], topY = y0 + h;
    if (style === 'romanesque') { for (let y = y0; y < y0 + h; y++) gl(0, y); sh(-1, y0 + h - 1); sh(1, y0 + h - 1); S.set(...at(0, y0 + h), B(SM.accent)); }
    else if (style === 'lancet') { for (let y = y0; y <= y0 + h; y++) gl(0, y); sh(-1, y0 + h); sh(1, y0 + h); topY = y0 + h + 1; S.set(...at(0, topY), B(SM.accent)); }
    else if (style === 'gothic') { us = [-1, 0, 1]; for (let y = y0; y < y0 + h; y++) { gl(-1, y); gl(1, y); } gl(0, y0 + h); sh(-1, y0 + h); sh(1, y0 + h); }
    else if (style === 'triple') {
      us = [-2, -1, 0, 1, 2];
      for (let y = y0; y < y0 + h - 1; y++) { gl(-2, y); gl(2, y); }
      for (let y = y0; y <= y0 + h; y++) gl(0, y);
      sh(-1, y0 + h); sh(1, y0 + h); sh(-3, y0 + h - 2); sh(3, y0 + h - 2); topY = y0 + h + 1; S.set(...at(0, topY), B(SM.accent));
    } else if (style === 'wide') {
      us = [-1, 0, 1];
      for (let y = y0; y < y0 + h; y++) for (const u of us) gl(u, y);
      gl(0, y0 + h); sh(-1, y0 + h); sh(1, y0 + h); topY = y0 + h + 1; S.set(...at(0, topY), B(SM.accent));
    } else if (style === 'rose') {
      const c = y0 + Math.floor(h / 2); us = [-1, 0, 1];
      gl(0, c); gl(-1, c); gl(1, c); gl(0, c - 1); gl(0, c + 1);
      sh(-1, c - 1, 'bottom'); sh(1, c - 1, 'bottom'); sh(-1, c + 1); sh(1, c + 1);
      if (frame) { S.set(...at(0, c - 2), trim); S.set(...at(0, c + 2), trim); }
      nw.push(1); return;
    } else { for (let y = y0 + 1; y < y0 + h; y++) gl(0, y); }                 // slit
    if (frame) {
      for (const u of us) S.set(...at(u, y0 - 1), trim);                                               // sill
      for (let u = us[0] - 1; u <= us[us.length - 1] + 1; u++) { const k = at(u, topY + 1); if (!/pane/.test(S.get(...k) || '')) S.set(...k, trim); }   // hood
    }
    nw.push(1);
  };
  // round window high in a gable: glass disc, chiselled hub, a ring of trim. Only where the whole ring is wall.
  let roses = 0;
  const roseWin = (x, z, yc, R, alongX) => {
    const at = (u, y) => alongX ? [x + u, y, z] : [x, y, z + u];
    const isWall = st => st && !/stairs|slab|pane|door/.test(st);
    for (let du = -R - 1; du <= R + 1; du++) for (let dy = -R - 1; dy <= R + 1; dy++) if (du * du + dy * dy <= (R + 1) * (R + 1) + 1 && !isWall(S.get(...at(du, yc + dy)))) return false;
    for (let du = -R - 1; du <= R + 1; du++) for (let dy = -R - 1; dy <= R + 1; dy++) {
      const q = du * du + dy * dy, k = at(du, yc + dy);
      if (q === 0 && R >= 2) S.set(...k, B(SM.accent));
      else if (q <= R * R + 1) S.set(...k, pane(...k, alongX ? 'x' : 'z'));
      else if (q <= (R + 1) * (R + 1) + 1) S.set(...k, trim);
    }
    roses++; return true;
  };
  const tryRose = (x, z, alongX, yBase) => { const R = hw >= 5 ? 2 : 1; for (let yc = yBase + R + 1; yc >= yBase + R - 1; yc--) if (roseWin(x, z, yc, R, alongX)) return; };
  const bays = v => { const len = v.x1 - v.x0 + 1, n = Math.max(1, Math.floor((len - 2) / bay)), span = len / n; return { n, line: i => Math.round(v.x0 + span * i), mid: i => Math.round(v.x0 + span * (i + 0.5)) }; };
  const winH = top => Math.max(2, top - (wstyle === 'romanesque' || wstyle === 'slit' || wstyle === 'rose' ? 3 : 5) - (p.window_frame ? 1 : 0));
  const sideWindows = (v, zs, y0, h, style, frame, needWall = true) => {
    const bb = bays(v);
    for (let i = 0; i < bb.n; i++) {
      const x = bb.mid(i);
      if (tpos === 'west' && x < 2) continue;
      for (const z of zs) if (fits(x, z, true, SPAN[style], needWall)) openWin(x, z, y0, h, true, style, frame);
    }
  };
  const y0w = p.window_frame ? 3 : 2;
  if (aisles) {
    // aisle walls: short round-headed lights; clerestory: the same, in the nave wall above the aisle roofs
    sideWindows(vols[1], [-edge], 2, AT - 2, 'romanesque', false); sideWindows(vols[2], [edge], 2, AT - 2, 'romanesque', false);
    const bb = bays(nave);
    for (let i = 0; i < bb.n; i++) {
      const x = bb.mid(i);
      for (const z of [-hw, hw]) if (S.has(x, AT + 4, z) && !inTower(x, z, 1) && x - 1 > nave.x0 && x + 1 < nave.x1) openWin(x, z, AT + 4, Math.max(1, WH - AT - 4), true, 'romanesque', false);
    }
  } else sideWindows(nave, [-hw, hw], y0w, winH(WH), wstyle, !!p.window_frame);
  if (chancel) sideWindows(chancel, [chancel.z0, chancel.z1], y0w, winH(chancel.top), wstyle, !!p.window_frame);
  if (transept) {
    const xc = transept.x0 + hw;
    for (const zE of [transept.z0, transept.z1]) {
      if (fits(xc, zE, true, SPAN[wstyle])) openWin(xc, zE, y0w, winH(WH), true);
      if (p.rose) tryRose(xc, zE, true, WH);
    }
    if (tdep >= 3) for (const s of [-1, 1]) for (const xF of [transept.x0, transept.x1]) {
      const z = s * (edge + Math.ceil(tdep / 2));
      if (fits(xF, z, false, 1)) openWin(xF, z, y0w, winH(WH), false, 'lancet');
    }
  }
  // east end: three narrow lights round the apse, or a window in the flat east wall
  if (roundApse) {
    for (const a of [-50, 0, 50]) {
      const ang = a * Math.PI / 180, x = last.x1 + Math.round(Math.cos(ang) * apseR), z = Math.round(Math.sin(ang) * apseR);
      const ax = Math.abs(Math.sin(ang)) > Math.abs(Math.cos(ang)) ? 'x' : 'z';    // panes run along the curve
      if (inside(x, z)) { for (let y = 2; y < last.top - 1; y++) S.set(x, y, z, pane(x, y, z, ax)); nw.push(1); }
    }
  } else { const ex = apseR ? last.x1 + 2 : last.x1; openWin(ex, 0, 2, Math.max(2, (apseR ? last.top - 1 : last.top) - 4), false); }

  // ---- arcade between nave and aisles: piers on the bay lines, arches between ----
  if (aisles) {
    const bb = bays(nave), piers = new Set(); for (let i = 0; i <= bb.n; i++) piers.add(bb.line(i));
    for (const z of [-hw, hw]) for (let x = nave.x0 + 1; x < nave.x1; x++) {
      if (border(x, z)) continue;
      S.set(x, AT, z, wallB(x, AT, z));
      if (piers.has(x)) { for (let y = 1; y < AT; y++) S.set(x, y, z, B(SM.block)); continue; }
      if (piers.has(x - 1)) S.set(x, AT - 1, z, stair(SM.stairs, 'west', 'top'));
      else if (piers.has(x + 1)) S.set(x, AT - 1, z, stair(SM.stairs, 'east', 'top'));
    }
  }
  if (transept) for (const x of cross) for (const z of [-hw, hw]) if (!border(x, z)) for (let y = 1; y <= WH; y++) S.set(x, y, z, B(SM.block));   // crossing piers

  // ---- buttresses (bay lines and facade corners) with optional pinnacles ----
  let nb = 0;
  const buttress = (x, z, nx, nz, h) => {
    const a = [x + nx, z + nz], b2 = [x + 2 * nx, z + 2 * nz];
    for (const [bx, bz] of [a, b2]) if (occupied(bx, bz) || blocked(bx, bz) || S.has(bx, 1, bz)) return;
    const f = nx ? (nx < 0 ? 'east' : 'west') : (nz < 0 ? 'south' : 'north');
    for (let y = 0; y <= h; y++) S.set(a[0], y, a[1], B(y === 0 ? WM.plinth : SM.block));
    S.set(a[0], h + 1, a[1], stair(SM.stairs, f));
    if (p.pinnacles && h >= 4) {
      for (let y = 0; y <= h; y++) S.set(b2[0], y, b2[1], B(y === 0 ? WM.plinth : SM.block));
      S.set(b2[0], h + 1, b2[1], post()); S.set(b2[0], h + 2, b2[1], post());
    } else {
      const low = Math.floor(h / 2);
      for (let y = 0; y < low; y++) S.set(b2[0], y, b2[1], B(y === 0 ? WM.plinth : SM.block));
      S.set(b2[0], low, b2[1], stair(SM.stairs, f));
    }
    nb++;
  };
  if (p.buttresses) {
    const sideB = (v, zs) => {
      const bb = bays(v);
      for (let i = 0; i <= bb.n; i++) {
        const x = Math.min(v.x1, bb.line(i));
        if (tpos === 'west' && x === v.x0) continue;
        for (const z of zs) { const s = Math.sign(z); if (inside(x, z + s)) continue; if (x === v.x1 && inside(x + 1, z)) continue; buttress(x, z, 0, s, v.top - 1); }
      }
    };
    if (aisles) sideB(vols[1], [-edge]), sideB(vols[2], [edge]); else sideB(nave, [-hw, hw]);
    if (chancel) sideB(chancel, [chancel.z0, chancel.z1]);
    if (tpos !== 'west') for (const z of aisles ? [-edge, -hw, hw, edge] : [-hw, hw]) buttress(0, z, -1, 0, (Math.abs(z) === hw ? WH : AT) - 1);
    if (transept) for (const zE of [transept.z0, transept.z1]) for (const xF of [transept.x0, transept.x1]) buttress(xF, zE, 0, Math.sign(zE), WH - 1);
  }

  // ---- gable crosses ----
  const gableCross = (x, y, z, alongZ) => {
    S.set(x, y - 1, z, B(SM.block));
    S.set(x, y, z, post()); S.set(x, y + 1, z, post(alongZ ? { north: 'low', south: 'low' } : { east: 'low', west: 'low' }));
    if (alongZ) { S.set(x, y + 1, z - 1, post({ up: false, south: 'low' })); S.set(x, y + 1, z + 1, post({ up: false, north: 'low' })); }
    else { S.set(x - 1, y + 1, z, post({ up: false, east: 'low' })); S.set(x + 1, y + 1, z, post({ up: false, west: 'low' })); }
    S.set(x, y + 2, z, post());
  };
  if (p.pinnacles) {
    if (tpos !== 'west' && tpos !== 'bellcote') gableCross(0, surf(nave, 0) + 1, 0, true);
    if (transept) for (const zE of [transept.z0, transept.z1]) gableCross(transept.x0 + hw, surf(transept, 0) + 1, zE, false);
    if (chancel && !apseR) gableCross(chancel.x1, surf(chancel, 0) + 1, 0, true);
    if (porch) gableCross(porch.px, surf(porch, 0) + 1, porch.ps > 0 ? porch.z1 : porch.z0, false);
  }

  // ---- doors ----
  const STEP = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] };
  const door = (x, z, facing) => {
    const [fx, fz] = STEP[facing];
    S.set(x, 1, z, B(WD.door, { facing, half: 'lower', hinge: 'left', open: false, powered: false }));
    S.set(x, 2, z, B(WD.door, { facing, half: 'upper', hinge: 'left', open: false, powered: false }));
    S.set(x, 3, z, B(SM.accent));
    for (const u of [-1, 1]) { if (fx) S.set(x, 3, z + u, stair(SM.stairs, u < 0 ? 'north' : 'south', 'top')); else S.set(x + u, 3, z, stair(SM.stairs, u < 0 ? 'west' : 'east', 'top')); }
    if (!S.has(x + fx, 0, z + fz)) S.set(x + fx, 0, z + fz, stair(SM.stairs, BACK[facing]));
  };
  const sideDoors = [];                       // [x, side] of doors in the long walls: no pews in front of them
  if (porch) {
    const { px, ps } = porch, zi = ps * edge, zo = ps > 0 ? porch.z1 : porch.z0;
    for (let u = -1; u <= 1; u++) for (let y = u ? 1 : 4; y <= porch.top; y++) S.set(px + u, y, zi, wallB(px + u, y, zi));   // the wall behind the porch, around the door
    door(px, zi, ps > 0 ? 'south' : 'north'); S.set(px, 0, zi + ps, B(FL[1]));
    for (let u = -1; u <= 1; u++) for (let y = 1; y <= 2; y++) S.set(px + u, y, zo, AIR);
    S.set(px, 3, zo, AIR); S.set(px - 1, 3, zo, stair(SM.stairs, 'west', 'top')); S.set(px + 1, 3, zo, stair(SM.stairs, 'east', 'top'));
    S.set(px, 0, zo, B(FL[1])); S.set(px, 0, zo + ps, stair(SM.stairs, ps > 0 ? 'north' : 'south'));
    for (const k of [2, 3]) { const z = ps * (edge + k); S.set(px - 1, 1, z, stair(WD.stairs, 'west')); S.set(px + 1, 1, z, stair(WD.stairs, 'east')); }
    sideDoors.push([px, ps]);
    report.push(`门廊：${ps > 0 ? '南' : '北'}侧双坡门廊，内有长凳`);
  }
  if (tpos !== 'west') {
    // west front: portal with shafts and a little gabled hood, a big window over it, a rose in the gable
    door(0, 0, 'west');
    for (const u of [-1, 1]) { for (let y = 1; y <= 3; y++) S.set(-1, y, u, post()); }
    S.set(-1, 4, -1, stair(SM.stairs, 'south')); S.set(-1, 4, 0, B(SM.block)); S.set(-1, 4, 1, stair(SM.stairs, 'north')); S.set(-1, 5, 0, slab(SM.slab));
    openWin(0, 0, 5, Math.max(2, WH - 6), false);
    if (p.rose) tryRose(0, 0, false, WH);
  }

  // ---- tower or bellcote ----
  let towerH = 0, towerStoreys = p.tower_storeys;
  if (hasTower) {
    const SH = 5, apex = surf(nave, 0) + 1, ty0 = tpos === 'crossing' ? WH : 1;
    // tower_storeys = storeys that show above the nave roof; the ones hidden below the ridge are added on top,
    // so the belfry always clears the roof and the setting can never be impossible
    const need = Math.ceil((apex + 1) / SH) + 1;      // the lowest storey count whose belfry clears the nave ridge
    const storeys = need - 1 + Math.max(1, Math.min(5, p.tower_storeys | 0));
    towerStoreys = storeys;
    towerH = storeys * SH;
    for (let dx = -th; dx <= th; dx++) for (let dz = -th; dz <= th; dz++) {
      if (!inT(dx, dz)) continue;
      const x = tcx + dx, z = tcz + dz, ed = N8.some(([a, b]) => !inT(dx + a, dz + b));
      if (ty0 === 1) S.set(x, 0, z, ed ? B(WM.plinth) : B(FL[1]));
      for (let y = ty0; y <= towerH; y++) {
        if (!ed) { S.set(x, y, z, y === towerH || y === ty0 && ty0 > 1 || (y % SH === 0) ? B(WD.planks) : null); continue; }
        S.set(x, y, z, y % SH === 0 ? B(SM.accent) : wallB(x, y, z));          // string course every storey
      }
    }
    const underRoof = (x, y, z) => { for (let yy = y; yy <= towerH; yy++) if (S.has(x, yy, z)) return true; return false; };
    const FACES = [[0, -th], [0, th], [-th, 0], [th, 0]];
    for (let s = 1; s < storeys; s++) for (const [fx, fz] of FACES) {          // slit lights, only where they look out
      const y = s * SH + 2, x = tcx + fx, z = tcz + fz, ox = x + Math.sign(fx), oz = z + Math.sign(fz);
      if (y <= ty0 + 1 || underRoof(ox, y, oz)) continue;
      const ax = fz ? 'x' : 'z';
      S.set(x, y, z, pane(x, y, z, ax)); S.set(x, y + 1, z, pane(x, y + 1, z, ax));
    }
    const by = (storeys - 1) * SH + 1;
    for (const [fx, fz] of FACES) {
      const us = T >= 9 ? [-2, 0, 2] : T >= 7 ? [-1, 1] : [0];
      for (const u of us) for (let y = by + 1; y <= by + 3; y++) S.set(tcx + fx + (fz ? u : 0), y, tcz + fz + (fx ? u : 0), AIR);
    }
    S.set(tcx, towerH - 1, tcz, B('bell', { attachment: 'ceiling', facing: 'north', powered: false }));
    // ways in
    if (tpos === 'west') {
      door(tcx - th, 0, 'west');
      for (let z = -1; z <= 1; z++) for (let y = 1; y <= 3; y++) { S.set(tcx + th, y, z, AIR); S.set(0, y, z, AIR); }
    } else if (tpos === 'corner') {
      door(tcx - th, tcz, 'west');
      for (let y = 1; y <= 2; y++) { S.set(tcx, y, tcz - sd * th, AIR); S.set(tcx, y, sd * edge, AIR); }
    } else if (tpos === 'side') {
      door(tcx, tcz + sd * th, sd > 0 ? 'south' : 'north');
      for (let y = 1; y <= 3; y++) { S.set(tcx, y, tcz - sd * th, AIR); S.set(tcx, y, sd * edge, AIR); }
      sideDoors.push([tcx, sd]);
    }
    // top
    const top = TOWER_TOPS[p.tower_top] ? p.tower_top : 'spire', ty = towerH + 1;
    if (top === 'battlement') {
      for (let dx = -th; dx <= th; dx++) for (let dz = -th; dz <= th; dz++) {
        if (!inT(dx, dz) || !N8.some(([a, b]) => !inT(dx + a, dz + b))) continue;
        S.set(tcx + dx, ty, tcz + dz, wallB(tcx + dx, ty, tcz + dz));
        if ((dx + dz) % 2 === 0) S.set(tcx + dx, ty + 1, tcz + dz, wallB(tcx + dx, ty + 1, tcz + dz));
      }
      for (const [a, b] of [[-th, -th], [th, -th], [-th, th], [th, th]]) if (inT(a, b)) S.set(tcx + a, ty + 2, tcz + b, post());
      towerH = ty + 2;
    } else if (top === 'spire') {
      // a cone: radius falls linearly from R0 to 0 over Hs layers. Distance is an octagon-ish metric with the
      // faces staggered (cells further from a face centre count as further out), so the steps run diagonally
      // as in hand-built spires. Each layer keeps a one-block shell; cells less than half a block inside the
      // surface become stairs.
      const Hs = Math.max(6, Math.round(Math.min(T, 9) * (SPIRE_HEIGHTS[p.spire_height] || SPIRE_HEIGHTS.tall).k));
      const R0 = th + 0.5 + (flare ? 0.5 : 0);
      const rr = i => R0 * (1 - i / Hs);
      const dist = (dx, dz) => { const a = Math.abs(dx), b = Math.abs(dz), c = Math.max(a, b), t = Math.min(a, b); return c + (oct ? 1.1 : 0.85) * (c ? t / c : 0); };
      const n = Math.ceil(R0);
      for (let i = 0; i < Hs; i++) {
        const r = rr(i), rn = rr(i + 1), y = ty + i;
        if (r < 0.5) { S.set(tcx, y, tcz, B(RM.block)); continue; }
        for (let dx = -n; dx <= n; dx++) for (let dz = -n; dz <= n; dz++) {
          const c = dist(dx, dz) + 0.5;
          if (c > r + 0.25 || c <= rn - 0.75) continue;
          const f = Math.abs(dz) >= Math.abs(dx) ? (dz < 0 ? 'south' : 'north') : (dx < 0 ? 'east' : 'west');
          S.set(tcx + dx, y, tcz + dz, c > rn + 0.25 ? stair(RM.stairs, f) : B(RM.block));
        }
      }
      if (flare) for (let dx = -th - 1; dx <= th + 1; dx++) for (let dz = -th - 1; dz <= th + 1; dz++) {   // bellcast skirt
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== th + 1) continue;
        if (oct && Math.abs(dx) + Math.abs(dz) > th + 1 + Math.floor(th / 2) + 1) continue;
        if (!S.has(tcx + dx, ty, tcz + dz)) S.set(tcx + dx, ty, tcz + dz, slab(RM.slab));
      }
      const y = ty + Hs;                                                        // finial: short pole and a cross
      S.set(tcx, y, tcz, post()); S.set(tcx, y + 1, tcz, post()); S.set(tcx, y + 2, tcz, post({ north: 'low', south: 'low' }));
      S.set(tcx, y + 2, tcz - 1, post({ up: false, south: 'low' })); S.set(tcx, y + 2, tcz + 1, post({ up: false, north: 'low' })); S.set(tcx, y + 3, tcz, post());
      S.set(tcx, y + 4, tcz, B('lightning_rod', { facing: 'up', powered: false, waterlogged: false }));
      towerH = y + 4;
    } else {
      const k = top === 'stepped' ? 3 : 1;
      let y = ty;
      for (let h = th + (top === 'pyramid' ? 1 : 0); h >= 0; h--) {
        const inO = (dx, dz, r) => r >= 0 && Math.max(Math.abs(dx), Math.abs(dz)) <= r && (!oct || Math.abs(dx) + Math.abs(dz) <= r + Math.floor(r / 2) + 1);
        for (let j = 0; j < k; j++, y++) for (let dx = -h; dx <= h; dx++) for (let dz = -h; dz <= h; dz++) {
          if (!inO(dx, dz, h) || inO(dx, dz, h - 1)) continue;
          const f = Math.abs(dz) >= Math.abs(dx) ? (dz < 0 ? 'south' : 'north') : (dx < 0 ? 'east' : 'west');
          S.set(tcx + dx, y, tcz + dz, j === k - 1 && h > 0 ? stair(RM.stairs, f) : B(RM.block));
        }
      }
      if (top === 'stepped') S.set(tcx, y, tcz, B('lightning_rod', { facing: 'up', powered: false, waterlogged: false }));
      towerH = y;
    }
    const where = { west: '西端正中', corner: `西端${sd > 0 ? '南' : '北'}角（立面一侧）`, side: `${sd > 0 ? '南' : '北'}侧（底层是门廊）`, crossing: '十字交叉处' }[tpos];
    report.push(`塔楼：${where}，${oct ? '八角' : '方'}塔 ${T}×${T}，${storeys} 层（其中 ${storeys - need + 1} 层露出屋顶，每层 ${SH} 格），顶部${TOWER_TOPS[top]}，钟室挂钟`);
  } else {
    if (tpos === 'bellcote') {                     // small bell frame on the west gable apex
      const ay = surf(nave, 0);
      for (const z of [-1, 1]) for (let y = Math.min(ay, surf(nave, z)); y <= ay + 3; y++) S.set(nave.x0, y, z, wallB(nave.x0, y, z));   // piers stand on the roof slope
      S.set(nave.x0, ay, 0, B(SM.block));
      for (let z = -1; z <= 1; z++) S.set(nave.x0, ay + 4, z, B(SM.block));
      S.set(nave.x0, ay + 5, 0, slab(SM.slab));
      S.set(nave.x0, ay + 3, 0, B('bell', { attachment: 'ceiling', facing: 'west', powered: false }));
      report.push('钟架：西山墙顶上的小钟架');
    } else report.push('塔楼：无');
  }

  // ---- inside: pews facing the altar, altar with candles, lanterns ----
  let pews = 0;
  if (p.interior) {
    const xa = nave.x0 + (tpos === 'west' ? 2 : 3), xb = nave.x1 - 2;
    for (let x = xa; x <= xb; x += 2) for (let z = -hw + 1; z <= hw - 1; z++) {
      if (Math.abs(z) <= 1) continue;                // centre aisle
      if (!aisles && sideDoors.some(([dx, s]) => Math.abs(x - dx) <= 1 && Math.sign(z) === s)) continue;
      if (S.has(x, 1, z)) continue;
      S.set(x, 1, z, stair(WD.stairs, 'west')); pews++;
    }
    const ax = roundApse ? last.x1 : last.x1 - 1;
    for (let z = -1; z <= 1; z++) S.set(ax, 1, z, B(SM.accent));
    S.set(ax, 2, -1, B('candle', { candles: 3, lit: true, waterlogged: false })); S.set(ax, 2, 1, B('candle', { candles: 3, lit: true, waterlogged: false }));
    S.set(ax, 2, 0, B('lectern', { facing: 'west', has_book: true, powered: false }));
    for (const v of vols) {
      if (!['nave', 'chancel', 'transept'].includes(v.name)) continue;
      const g = geo(v);
      for (let w = g.w0 + 2; w <= g.w1 - 1; w += 5) {
        const [x, z] = xzOf(v, w, 0);
        if (inTower(x, z) || (cross && x >= cross[0] && x <= cross[1] && Math.abs(z) <= hw)) continue;
        S.set(x, v.top, z, B('chain', { axis: 'y', waterlogged: false })); S.set(x, v.top - 1, z, B('lantern', { hanging: true, waterlogged: false }));
      }
    }
  }

  report.push(...matRep);
  fixConnections(S); stairShapes(S);
  const [[bx0, , bz0], [bx1, by1, bz1]] = S.bounds();
  const parts = [aisles ? `一楼（侧廊）墙高 ${AT}、二楼（高侧窗层）高 ${CH}，中殿总墙高 ${WH}` : '', transept ? `耳堂（每侧伸出 ${tdep} 格）` : '', roses ? `玫瑰窗 ${roses} 扇` : ''].filter(Boolean).join('，');
  report.unshift(`${CHURCH_KINDS[chapel ? 'chapel' : 'parish']}：中殿 ${L}×${W}，中殿墙高 ${WH}` + (chancel ? `，圣坛 ${chancel.x1 - chancel.x0 + 1}×${chancel.z1 * 2 + 1}` : '') +
    `，${({ round: '半圆后殿', flat: '方形后殿', none: '无后殿' })[p.apse] || ''}` + (parts ? `；${parts}` : '') + `；屋顶${PR.label}${flare ? '带飞檐' : ''}；${CHURCH_WINDOWS[wstyle]}窗等共 ${nw.length} 扇${p.window_frame ? '（带窗台与窗楣）' : ''}；扶壁 ${nb} 个${p.pinnacles ? '（带小尖顶）' : ''}；` +
    `${WM.label}墙、${RM.label}屋顶；总尺寸 ${bx1 - bx0 + 1}×${bz1 - bz0 + 1}，高 ${by1 + 1}` + (p.interior ? `；内部长椅 ${pews} 格、祭坛` : ''));
  return { S, foot: [bx0, bx1, bz0, bz1], tags: ['landmark', 'church'], report, spec: { ...p, length: L, width: W, wall_height: cl(p.wall_height | 0, 5, 14), clerestory_height: CH, transept_depth: p.transept ? tdep : p.transept_depth, chancel_length: chancel ? chancel.x1 - chancel.x0 + 1 : p.chancel_length, porch_height: porch ? porch.top : p.porch_height, tower_storeys: p.tower_storeys }, adjust };
}
