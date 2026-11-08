// Local style preview. Existing cathedral styles keep their original builders.
// Brick Gothic reuses the Gothic shell; Byzantine has a separate domed shell.
CHURCH_WALLS.brick = { label: '红砖', mix: [['bricks', 8], ['granite', 1]], plinth: 'stone_bricks', set: 'stone' };
GOTHIC_FACADE_MATS.brick = { frame: 'bricks', stairs: 'brick_stairs', slab: 'brick_slab', wall: 'brick_wall', head: 'polished_granite', capital: 'cut_red_sandstone', niche: 'red_terracotta' };
WALL_TRIM.brick = 'polished_andesite';

function brickGothicCathedral(o) {
  // A separate control avoids redefining the original cathedral's tower_top.
  // Old saved brick parameters keep their old geometry, including the former
  // openwork + solid combination. New requests use exactly one selected top.
  const legacyTop = o.brick_tower_top === undefined && o.tower_top !== undefined;
  const requestedTop = legacyTop ? (o.tower_top === 'none' ? 'none' : 'solid') : (o.brick_tower_top || 'solid');
  const top = ['solid', 'flat', 'openwork', 'none'].includes(requestedTop) ? requestedTop : 'solid';
  const baseTop = legacyTop ? o.tower_top : top === 'none' ? 'none' : 'flat';
  const out = _cathedral({ ...o, tower_top: baseTop }), p = { ...out.spec, facade: o.facade || CATHEDRAL_PRESETS.brick_gothic.facade }, S = out.S;
  out.spec.facade = p.facade;
  if (legacyTop) delete out.spec.brick_tower_top;
  else { out.spec.brick_tower_top = top; delete out.spec.tower_top; }
  const W = p.width, hw = W >> 1, AW = p.aisle_width, edge = hw + p.aisles * AW;
  // Match the existing shell's effective section; a hall has no gallery step.
  const hall = p.plan === 'hall';
  const NT = hall ? p.arcade_height + p.clerestory_height : p.arcade_height + p.gallery_height + 1 + ((AW - 1) >> 1) + p.clerestory_height;
  const pitch = (ROOF_PITCHES[p.roof_pitch] || ROOF_PITCHES.medium).r;
  const ridge = NT + 1 + Math.round(pitch * (hall ? edge : hw));
  const GL = gothicFrontLayout({ hw, edge, NT, ridge, TT: ridge + p.facade_extra + p.tower_rise });
  const mine = new Set(), trim = 'stone_bricks';
  let addedTwinTops = false;
  const put = (x, y, z, name) => S.set(x, y, z, B(name));
  // Solid stepped parapets: each two-block tread has a pale stone coping.
  const gable = (alongX, fixed, mid, half) => {
    for (let u = -half; u <= half; u++) {
      const step = Math.floor((half - Math.abs(u)) / 2);
      const top = NT + 4 + Math.ceil(step * 2 * pitch);
      const x = alongX ? mid + u : fixed, z = alongX ? fixed : mid + u;
      for (let y = NT; y <= top; y++) put(x, y, z, 'bricks');
      put(x, top + 1, z, trim);
      // Recessed blind lancets below each tread; a brick spine separates them.
      if (u % 3 === 0 && Math.abs(u) < half - 1) {
        for (let y = NT + 1; y < top; y++) {
          const xx = alongX ? x : x + (fixed < 1 ? -1 : 1);
          const zz = alongX ? z + Math.sign(fixed) : z;
          put(xx, y, zz, 'red_terracotta');
        }
      }
    }
  };
  const hasT = p.plan === 'greek' || p.transept;
  const NB = p.plan === 'greek' ? p.choir_bays : p.nave_bays;
  const xN = NB * p.bay - 1, xc0 = xN + 1, xc1 = xN + W;
  const xE = (hasT ? xc1 : xN) + p.choir_bays * p.bay;
  if (p.stepped_gables !== false) {
    gable(false, -1, 0, hw);
    if (p.east_end === 'flat') gable(false, xE + 1, 0, hw);
    if (hasT) {
      const td = p.plan === 'greek' ? Math.max(p.transept_depth, p.choir_bays * p.bay - p.aisles * AW) : p.transept_depth;
      for (const s of [-1, 1]) gable(true, s * (edge + td + 1), (xc0 + xc1) >> 1, hw);
    }
  }
  // Narrow dark, solid steeples make the paired brick towers read differently
  // from Cologne's openwork stone spires. Geometry follows the original layout.
  if (p.facade === 'detailed' && (top === 'solid' || top === 'openwork')) {
    addedTwinTops = true;
    const TL = Math.min(edge - hw, Math.max(4, xN + 1 - p.bay));
    const cx = Math.floor((TL - 1) / 2), R = Math.max(2, Math.min(GL.th + 1, cx));
    const customRoof = resolveMats(CHURCH_MAT_SLOTS, p.mats, null).roof;
    const RM = customRoof || CHURCH_ROOFS[p.roof] || CHURCH_ROOFS.slate;
    let roofWall = RM.wall || 'deepslate_tile_wall';
    if (customRoof && !customRoof.wall) {
      const target = matRoofOpt(RM.block), candidates = OPTIONS ? OPTIONS.roof.filter(opt => matWallOf(opt.key)) : [];
      const closest = target && candidates.length ? minBy(candidates, opt => de(opt.lab, target.lab)) : null;
      roofWall = closest ? matWallOf(closest.key) : /quartz/.test(RM.block) ? 'diorite_wall' : roofWall;
    }
    const mats = { frame: RM.block, stairs: RM.stairs, slab: RM.slab, wall: roofWall };
    const open = !legacyTop && top === 'openwork';
    for (const s of [-1, 1]) gothicSpire(S, mats, cx, GL.top + 1, s * GL.tc, R, open ? R * 10 : R * 7 + 5, open ? 'open' : 'solid', mine, null, open ? R * 2 + 2 : 0);
  }
  fixConnections(S); stairShapes(S);
  // The base builder reports before these gables and steeples are added. Refresh
  // its summary from the final building model, excluding the preview terrain.
  const [[x0, y0, z0], [x1, y1, z1]] = S.bounds();
  const width = x1 - x0 + 1, depth = z1 - z0 + 1, height = y1 - y0 + 1;
  let blocks = 0;
  for (const state of S.blocks.values()) if (!['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'].includes(state)) blocks++;
  out.report[0] = out.report[0].replace(/；总尺寸 \d+×\d+，高 \d+/, `；总尺寸 ${width}×${depth}，高 ${height}${addedTwinTops ? '（含双尖顶）' : ''}；非空气方块 ${blocks} 个（仅建筑，不含预览地面）`);
  if (p.facade === 'single') out.report[0] = out.report[0].replace(/，双塔高 \d+/, '，单塔立面');
  else if (p.facade === 'screen' || p.tower_top === 'none') out.report[0] = out.report[0].replace(/，双塔高 \d+/, '');
  else out.report[0] = out.report[0].replace(/，双塔高 (\d+)/, '，双塔塔身顶标高 $1' + (addedTwinTops ? '（尖顶另计）' : ''));
  const topLabel = legacyTop && o.tower_top === 'openwork' ? '保留旧版塔顶造型' : top === 'openwork' ? '镂空双尖顶' : '实心双尖顶';
  out.report.push(`砖砌哥特：${p.stepped_gables !== false ? '阶梯山墙与盲拱' : '阶梯山墙已关闭'}；${addedTwinTops ? topLabel + '，已计入建筑总高' : top === 'none' ? '无双塔' : '未额外添加大型尖顶'}；种子 ${p.seed}`);
  if (p.plan === 'greek') out.report = out.report.map(line => line.startsWith('希腊十字：')
    ? line.replace('，四臂等长', `；中殿与唱诗堂各长 ${NB * p.bay} 格，横臂长度受侧廊宽度与耳堂进深下限约束`)
    : line);
  const ordinaryRose = !!p.rose && hasT, simple = p.facade === 'simple';
  for (const [slot, active, label] of [['accent', simple || ordinaryRose || p.interior, '点缀块'], ['trim', simple || ordinaryRose, '窗框']]) {
    if (p.mats && p.mats[slot] && !active) {
      out.report = out.report.filter(line => !line.startsWith('配色·' + (slot === 'accent' ? '点缀块' : '窗台与窗楣')));
      out.report.push(`${label}配色当前未使用：适用于简单立面、耳堂普通玫瑰窗${slot === 'accent' ? '或内部祭坛' : ''}，不替换精细立面石作。`);
    }
  }
  if (p.flyer_levels === 2 && p.flying_buttresses && !hall && !out.report.some(line => /其中 \d+ 道双层/.test(line))) out.report.push('双层飞扶壁：当前侧廊屋面与高侧窗之间净空不足，仍按原规则生成单层；可提高高侧窗层高。');
  if (p.facade === 'detailed' && p.tower_rise < GL.top - ridge - p.facade_extra) out.report.push(`双塔高度受精细立面的最小高度约束；塔身顶标高 ${GL.top}，较小的增高值可能得到相同塔高。`);
  out.foot = [x0, x1, z0, z1];
  return out;
}

// An ellipsoidal masonry shell, not a stack of shrinking solid disks. Its inner
// surface stays hollow. A half dome uses half=+1 or -1 along the x axis.
function cathedralDome(S, cx, cz, y0, radius, height, material, half = 0) {
  let top = y0;
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    if (half && dx * half < 0) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    const y = y0 + Math.round(height * Math.sqrt(1 - d2 / (radius * radius)));
    const ir = Math.max(1, radius - 1.5), ih = Math.max(1, height - 1.5);
    const inner = d2 <= ir * ir ? y0 + Math.floor(ih * Math.sqrt(1 - d2 / (ir * ir))) : y0 - 1;
    for (let yy = Math.max(y0, inner + 1); yy <= y; yy++) S.set(cx + dx, yy, cz + dz, B(material));
    top = Math.max(top, y);
  }
  return top;
}

function byzantineCathedral(o) {
  const p = { ...CATHEDRAL_PRESETS.byzantine, ...o }, S = new Structure(), report = [], adjust = [];
  const range = (key, fallback, lo, hi) => {
    const requested = p[key] === undefined ? fallback : p[key];
    const v = Number(requested), n = Math.max(lo, Math.min(hi, Number.isFinite(v) ? Math.round(v) : fallback));
    if (o[key] !== undefined && n !== requested) adjust.push({ key, got: n, why: `允许范围 ${lo}–${hi}` });
    return n;
  };
  const R = range('dome_radius', 17, 11, 23), DH = range('dome_height', 12, 8, 18);
  const DR = range('drum_height', 7, 5, 10), H = range('body_height', 23, 18, 30);
  const hx = R + 3, hz = R + 9, end = R + 2, capR = R + 2, low = Math.round(H * 0.64);
  const materialReport = [], slots = Object.fromEntries(Object.entries(CHURCH_MAT_SLOTS).filter(([key]) => key !== 'wood'));
  const MS = resolveMats(slots, p.mats, materialReport);
  if (p.mats && p.mats.wood) materialReport.push('木作配色当前未使用：拜占庭试作没有木作部件。');
  // A dome needs full blocks only. Uncut oxidized copper also has a correct
  // average-colour definition in the current offline viewer.
  const roof = MS.roof ? MS.roof.block : p.roof === 'copper' ? 'oxidized_copper' : (CHURCH_ROOFS[p.roof] || CHURCH_ROOFS.copper).block;
  const walls = { ...(p.walls === 'warm' ? CATHEDRAL_WARM : p.walls === 'marble' ? CATHEDRAL_MARBLE : CHURCH_WALLS[p.walls] || CHURCH_WALLS.sandstone) };
  if (MS.wall) walls.mix = MS.wall.mix;
  const salt = deriveSeed(p.seed || 1, 'byzantine-wall');
  const stone = MS.stone ? MS.stone.block : 'smooth_sandstone', accent = MS.accent ? MS.accent.block : 'bricks';
  const trim = MS.trim ? MS.trim.block : stone, plinth = MS.plinth ? MS.plinth.block : 'stone_bricks';
  const wall = (x, y, z) => B(y % 6 === 1 || y % 6 === 2 ? accent : pickU(patchNoise(x, y, z, salt, 'byz', 2), walls.mix));
  const dyes = MS.glass ? MS.glass.colors : p.glass === 'clear' ? [null] : p.glass === 'amber' ? ['yellow'] : p.glass === 'colored' ? ['red', 'yellow', 'blue', 'green', 'purple'] : ['light_blue'];
  const glassAt = (x, y, z) => {
    const dye = dyes[Math.floor(_h(p.seed || 1, 'glass', x, y, z) * dyes.length)];
    return B(dye ? dye + '_stained_glass' : 'glass');
  };
  const floor = (x, z) => B(MS.floor ? pickU(patchNoise(x, 0, z, salt, 'byz-floor', 2), MS.floor.mix) : (Math.floor(x / 4) + Math.floor(z / 4)) % 2 ? 'smooth_sandstone' : 'polished_andesite');
  const zone = (x, z) => {
    if (Math.abs(x) <= hx && Math.abs(z) <= R + 2) return H;
    if (Math.abs(x) <= hx && Math.abs(z) <= hz) return low;
    if (Math.abs(x) > end && (Math.abs(x) - end) ** 2 + z * z <= capR * capR) return H;
    return 0;
  };
  const cells = [], border = [];
  for (let x = -end - capR; x <= end + capR; x++) for (let z = -hz; z <= hz; z++) {
    const h = zone(x, z); if (!h) continue;
    cells.push([x, z]); S.set(x, -1, z, B(plinth));
    S.set(x, 0, z, floor(x, z));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nh = zone(x + dx, z + dz);
      if (nh < h) {
        for (let y = nh ? nh + 1 : 1; y <= h; y++) S.set(x, y, z, wall(x, y, z));
        if (!nh) border.push([x, z]);
      }
    }
    S.set(x, h, z, B(stone));
    S.set(x, h + 1, z, B(roof));
  }
  // Regular round-headed lights in the lower and upper walls. Full glass blocks
  // are used for curved walls so there are no unsupported panes at the steps.
  for (const [x, z] of border) {
    const h = zone(x, z), along = Math.abs(z) >= R + 2 ? x : z;
    const u = ((along % 8) + 8) % 8 - 4, wTop = Math.min(h - 3, 12), sill = 4;
    const inside = Math.abs(u) <= 1 && (u === 0 ? wTop : wTop - 1) >= sill;
    if (!inside) continue;
    for (let y = sill; y <= wTop - (u ? 1 : 0); y++) S.set(x, y, z, glassAt(x, y, z));
  }
  // Four principal piers and round arcades carry the square body into the drum.
  const pier = R - 4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = 1; y <= H; y++) S.set(sx * pier + dx, y, sz * pier + dz, wall(sx * pier + dx, y, sz * pier + dz));
  }
  for (const axis of ['x', 'z']) for (const side of [-1, 1]) {
    for (let u = -pier; u <= pier; u++) {
      const bottom = 10 + Math.round(Math.sqrt(Math.max(0, pier * pier - u * u)) * 0.75);
      for (let y = bottom; y <= H; y++) for (let d = -1; d <= 1; d++) {
        const x = axis === 'x' ? u : side * pier + d, z = axis === 'x' ? side * pier + d : u;
        S.set(x, y, z, B(stone));
      }
    }
  }
  // Open the horizontal ceiling into the central dome's hollow volume.
  for (let dx = -R + 2; dx <= R - 2; dx++) for (let dz = -R + 2; dz <= R - 2; dz++) if (dx * dx + dz * dz < (R - 2) ** 2) {
    S.blocks.delete(dx + ',' + H + ',' + dz); S.blocks.delete(dx + ',' + (H + 1) + ',' + dz);
  }
  // Paired half domes over the east and west arms, with closed tympana at their
  // junctions to the central body. This is a simplified Hagia-Sophia-like massing.
  for (const side of [-1, 1]) {
    const top = cathedralDome(S, side * end, 0, H + 1, capR, Math.round(DH * 0.78), roof, side);
    for (let z = -capR; z <= capR; z++) {
      const t = H + 1 + Math.round(DH * 0.78 * Math.sqrt(Math.max(0, 1 - z * z / (capR * capR))));
      for (let y = H + 1; y <= t; y++) S.set(side * end, y, z, wall(side * end, y, z));
    }
    for (let z = -capR; z <= capR; z++) if (Math.abs(z) % 5 === 0) {
      for (let y = H + 3; y <= top - 3; y++) if (S.has(side * end, y, z)) S.set(side * end, y, z, glassAt(side * end, y, z));
    }
  }
  // Drum with sixteen windows; a narrow cream cornice separates it from copper.
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x, z); if (d > R || d < R - 1.6) continue;
    const a = Math.atan2(z, x), gap = Math.abs(Math.sin(a * 8));
    for (let y = H; y <= H + DR; y++) {
      const win = gap < 0.43 && y >= H + 2 && y <= H + DR - 2;
      S.set(x, y, z, win ? glassAt(x, y, z) : B(y === H || y === H + DR ? trim : 'cut_sandstone'));
    }
  }
  const top = cathedralDome(S, 0, 0, H + DR + 1, R, DH, roof);
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x, z); if (d <= R + 0.5 && d >= R - 0.8) S.set(x, H + DR, z, B(trim));
  }
  // Four smaller copper domes over the lower galleries.
  if (p.small_domes !== false) {
    const rr = Math.max(4, Math.round(R * 0.35));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * Math.round(R * 0.7), cz = sz * (R + 4);
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
        const d = Math.hypot(dx, dz); if (d > rr) continue;
        for (let y = low + 1; y <= low + 4; y++) if (d >= rr - 1.4) S.set(cx + dx, y, cz + dz, B(stone));
      }
      cathedralDome(S, cx, cz, low + 5, rr, Math.max(4, Math.round(DH * 0.45)), roof);
    }
  }
  // Buttress masses and a banded western entrance porch.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    for (let y = 1; y <= H + 3; y++) S.set(sx * (R + 1) + dx, y, sz * (R + 1) + dz, wall(sx * (R + 1) + dx, y, sz * (R + 1) + dz));
  }
  const front = -end - capR;
  for (let x = front - 6; x <= front + 2; x++) for (let z = -7; z <= 7; z++) {
    S.set(x, -1, z, B(plinth)); S.set(x, 0, z, floor(x, z));
    const edge = x === front - 6 || Math.abs(z) === 7;
    if (edge) for (let y = 1; y <= 11; y++) {
      const opening = x === front - 6 && Math.abs(z) <= 2 && y <= 5 + Math.round(Math.sqrt(Math.max(0, 4 - z * z)));
      if (!opening) S.set(x, y, z, wall(x, y, z));
    }
    S.set(x, 12, z, B(roof));
  }
  for (let z = -2; z <= 2; z++) for (let y = 1; y <= 7; y++) S.blocks.delete(front + ',' + y + ',' + z);
  // A small masonry cross stays attached to the dome crown.
  for (let y = top + 1; y <= top + 4; y++) S.set(0, y, 0, B('smooth_sandstone'));
  for (const z of [-1, 1]) S.set(0, top + 3, z, B('smooth_sandstone'));
  fixConnections(S); stairShapes(S); S.box = null;
  const [[x0, , z0], [x1, y1, z1]] = S.bounds();
  report.push(`拜占庭式：中央穹顶直径 ${R * 2 + 1} 格、高 ${DH} 格；鼓座 ${DR} 格；东西半穹顶；${p.small_domes !== false ? '四座侧廊小穹顶；' : ''}砖石横向色带、圆拱窗与粗大承重墩。`);
  report.push(`尺寸 ${x1 - x0 + 1}×${y1 + 2}×${z1 - z0 + 1}；简化的穹顶教堂试作，并非历史建筑复刻。`);
  report.push(...materialReport);
  return { S, spec: { ...p, style: 'byzantine', plan: 'central', arch: 'round', dome_radius: R, dome_height: DH, drum_height: DR, body_height: H }, report, adjust, foot: [x0, x1, z0, z1], tags: ['landmark', 'cathedral'] };
}
