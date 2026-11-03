// ---- greenery (绿化): recipes of ground, cover, flowers, shrubs and trees mixed by weight ----------
// A recipe says WHAT grows; a density field (0..1 per cell) says HOW MUCH. Everything is decided per cell from a
// fixed hash of (seed, x, z, layer), never from a running random sequence, so painting in one place never moves a
// plant anywhere else: shrubs and trees use "hash-priority" Poisson-disk sampling (a candidate stays only if no
// candidate with a higher priority lies within its spacing), which only looks at nearby cells.
// Generation uses the newest block names; the target game version swaps them on show / export (version.js).

const GREEN_GROUND = { grass_block: '草方块', podzol: '灰化土', moss_block: '苔藓块', coarse_dirt: '砂土', rooted_dirt: '缠根泥土', dirt: '泥土', mud: '泥巴', dirt_path: '土径（不长植物）' };
const GREEN_COVER = { short_grass: '短草', tall_grass: '高草（两格）', fern: '蕨', large_fern: '大型蕨（两格）', bush: '灌木丛（1.21.5）', short_dry_grass: '短干草（1.21.5）', tall_dry_grass: '高干草（1.21.5）', dead_bush: '枯萎的灌木', leaf_litter: '落叶（1.21.5）', moss_carpet: '苔藓地毯', pink_petals: '粉红色花簇', wildflowers: '野花簇（1.21.5）' };
const GREEN_FLOWERS = { poppy: '虞美人', dandelion: '蒲公英', cornflower: '矢车菊', oxeye_daisy: '滨菊', azure_bluet: '蓝花美耳草', allium: '绒球葱', lily_of_the_valley: '铃兰', blue_orchid: '兰花', red_tulip: '红色郁金香', orange_tulip: '橙色郁金香', white_tulip: '白色郁金香', pink_tulip: '粉红色郁金香', torchflower: '火把花', rose_bush: '玫瑰丛（两格）', lilac: '丁香（两格）', peony: '牡丹（两格）', sunflower: '向日葵（两格）' };
const GREEN_SHRUBS = { 'leaf:oak': '橡树叶灌木', 'leaf:birch': '白桦叶灌木', 'leaf:spruce': '云杉叶灌木', 'leaf:dark_oak': '深色橡树叶灌木', 'leaf:azalea': '杜鹃叶灌木', 'leaf:flowering_azalea': '开花杜鹃叶灌木', 'leaf:cherry': '樱花叶灌木', azalea: '杜鹃花丛', flowering_azalea: '盛开的杜鹃花丛', sweet_berry_bush: '甜浆果丛', firefly_bush: '萤火虫灌木（1.21.5）' };
const GREEN_TREES = { 'oak:m': '橡树', 'oak:l': '大橡树', 'birch:m': '白桦', 'birch:l': '高大白桦', 'spruce:m': '云杉', 'spruce:l': '巨型云杉', 'dark_oak:m': '深色橡树', 'cherry:m': '樱花树' };
const GREEN_EDGES = { none: '无', hedge: '树篱（叶子围一圈）', border: '镶边（地面换一圈方块）' };
const GREEN_BORDERS = { stone_bricks: '石砖', mossy_stone_bricks: '苔石砖', cobblestone: '圆石', mossy_cobblestone: '苔石', coarse_dirt: '砂土', dirt_path: '土径', packed_mud: '泥坯', bricks: '红砖' };
const GREEN_SHRUB_SIZES = { s: '小（1 格）', m: '中（十字，高 2）', l: '大（3×3，高 2–3）', mix: '大小混合' };
const GREEN_PREVIEWS = { uniform: '均匀（按浓度）', gradient: '渐变（左淡右浓）', round: '圆形（中间浓、边上淡）' };
const TALL_GREEN = new Set(['tall_grass', 'large_fern', 'rose_bush', 'lilac', 'peony', 'sunflower']);
const NO_PLANTS_ON = new Set(['dirt_path', 'stone_bricks', 'mossy_stone_bricks', 'cobblestone', 'mossy_cobblestone', 'bricks', 'packed_mud']);

// the recipe a panel / swatch describes; missing parts get these values
const GREEN_RECIPE_DEFAULT = {
  ground: [['grass_block', 100]], ground_patch: 5,
  cover: { amount: 50, items: [['short_grass', 70], ['tall_grass', 20], ['fern', 10]] },
  flowers: { amount: 12, clump: 0.5, items: [['poppy', 1], ['dandelion', 1], ['oxeye_daisy', 1]] },
  shrubs: { amount: 0, spacing: 3, size: 'mix', items: [['leaf:oak', 1]] },
  trees: { amount: 0, spacing: 6, items: [['oak:m', 1]] },
  from: { flowers: 20, shrubs: 40, trees: 50 },
  edge: { kind: 'none', block: 'oak_leaves', border: 'stone_bricks', height: 2 },
};

// built-in swatches (绿化颜色). Each is a full recipe; the panel starts from one of them.
const GREEN_SWATCHES = {
  lawn: { name: '草坪', recipe: { ground: [['grass_block', 100]], ground_patch: 0, cover: { amount: 22, items: [['short_grass', 1]] }, flowers: { amount: 0, clump: 0, items: [['dandelion', 1]] } } },
  meadow: { name: '野花草甸', recipe: { cover: { amount: 55, items: [['short_grass', 60], ['tall_grass', 22], ['fern', 6], ['wildflowers', 12]] },
    flowers: { amount: 18, clump: 0.6, items: [['poppy', 3], ['dandelion', 3], ['cornflower', 2], ['oxeye_daisy', 2], ['azure_bluet', 2], ['allium', 1], ['lilac', 0.5], ['peony', 0.5]] } } },
  cherry_grove: { name: '樱花林下', recipe: { cover: { amount: 45, items: [['short_grass', 50], ['pink_petals', 40], ['tall_grass', 10]] },
    flowers: { amount: 4, clump: 0.5, items: [['allium', 1], ['pink_tulip', 1], ['lilac', 0.5]] }, trees: { amount: 0.7, spacing: 6, items: [['cherry:m', 1]] }, from: { flowers: 20, shrubs: 40, trees: 45 } } },
  oak_wood: { name: '橡树林', recipe: { ground: [['grass_block', 70], ['podzol', 15], ['coarse_dirt', 8], ['moss_block', 7]], ground_patch: 6,
    cover: { amount: 45, items: [['short_grass', 45], ['fern', 15], ['tall_grass', 10], ['leaf_litter', 20], ['bush', 10]] },
    flowers: { amount: 3, clump: 0.7, items: [['lily_of_the_valley', 1], ['oxeye_daisy', 1]] },
    shrubs: { amount: 1.5, spacing: 3, size: 'mix', items: [['leaf:oak', 3], ['leaf:azalea', 1]] },
    trees: { amount: 1, spacing: 5, items: [['oak:m', 60], ['oak:l', 15], ['birch:m', 25]] }, from: { flowers: 20, shrubs: 35, trees: 45 } } },
  spruce_wood: { name: '云杉林', recipe: { ground: [['podzol', 50], ['grass_block', 30], ['coarse_dirt', 12], ['moss_block', 8]], ground_patch: 6,
    cover: { amount: 40, items: [['fern', 45], ['large_fern', 15], ['short_grass', 30], ['sweet_berry_bush', 0], ['leaf_litter', 10]] },
    flowers: { amount: 0, clump: 0.5, items: [['lily_of_the_valley', 1]] }, shrubs: { amount: 1.2, spacing: 3, size: 'm', items: [['sweet_berry_bush', 1], ['leaf:spruce', 2]] },
    trees: { amount: 1.6, spacing: 4, items: [['spruce:m', 85], ['spruce:l', 15]] }, from: { flowers: 20, shrubs: 35, trees: 45 } } },
  thicket: { name: '灌木丛', recipe: { cover: { amount: 50, items: [['tall_grass', 40], ['short_grass', 40], ['bush', 20]] }, flowers: { amount: 4, clump: 0.5, items: [['poppy', 1], ['azure_bluet', 1]] },
    shrubs: { amount: 6, spacing: 2, size: 'mix', items: [['leaf:oak', 3], ['leaf:birch', 1], ['leaf:azalea', 1], ['flowering_azalea', 1]] }, from: { flowers: 20, shrubs: 25, trees: 50 } } },
  avenue: { name: '行道树（配合沿线笔刷）', recipe: { ground_patch: 0, cover: { amount: 20, items: [['short_grass', 1]] }, flowers: { amount: 0, clump: 0, items: [['dandelion', 1]] },
    trees: { amount: 19, spacing: 1, items: [['oak:m', 3], ['birch:m', 1]] }, from: { flowers: 20, shrubs: 40, trees: 50 } } },
  hedge: { name: '树篱', recipe: { ground_patch: 0, cover: { amount: 18, items: [['short_grass', 1]] }, flowers: { amount: 0, clump: 0, items: [['dandelion', 1]] },
    edge: { kind: 'hedge', block: 'oak_leaves', border: 'stone_bricks', height: 2 } } },
  flower_bed: { name: '花坛', recipe: { ground: [['grass_block', 60], ['rooted_dirt', 40]], ground_patch: 3, cover: { amount: 10, items: [['short_grass', 1]] },
    flowers: { amount: 72, clump: 0.6, items: [['red_tulip', 2], ['orange_tulip', 2], ['white_tulip', 2], ['pink_tulip', 2], ['allium', 1], ['cornflower', 1], ['peony', 0.5], ['rose_bush', 0.5]] },
    from: { flowers: 0, shrubs: 40, trees: 50 }, edge: { kind: 'border', block: 'oak_leaves', border: 'stone_bricks', height: 1 } } },
  churchyard: { name: '墓园草地', recipe: { ground: [['grass_block', 85], ['moss_block', 10], ['coarse_dirt', 5]], ground_patch: 4, cover: { amount: 40, items: [['short_grass', 75], ['fern', 10], ['moss_carpet', 15]] },
    flowers: { amount: 4, clump: 0.6, items: [['lily_of_the_valley', 2], ['azure_bluet', 1], ['oxeye_daisy', 1]] }, trees: { amount: 0.3, spacing: 8, items: [['dark_oak:m', 1], ['spruce:m', 1]] }, from: { flowers: 20, shrubs: 40, trees: 60 } } },
  wetland: { name: '水边湿地', recipe: { ground: [['grass_block', 50], ['mud', 30], ['moss_block', 20]], ground_patch: 4, cover: { amount: 60, items: [['tall_grass', 35], ['short_grass', 30], ['fern', 15], ['large_fern', 10], ['moss_carpet', 10]] },
    flowers: { amount: 6, clump: 0.7, items: [['blue_orchid', 3], ['azure_bluet', 1]] }, shrubs: { amount: 3, spacing: 3, size: 's', items: [['firefly_bush', 2], ['leaf:dark_oak', 1]] }, from: { flowers: 20, shrubs: 30, trees: 50 } } },
};

// fill in and clamp a recipe; unknown names are dropped (reported in `adjust` by the caller when it matters)
function greenRecipe(r) {
  const D = GREEN_RECIPE_DEFAULT, src = r || {}, num = (v, d, a, b) => { v = +v; if (!isFinite(v)) v = d; return Math.max(a, Math.min(b, v)); };
  const items = (list, known, d) => { const out = (Array.isArray(list) ? list : d).filter(e => Array.isArray(e) && known[e[0]] && +e[1] > 0).map(e => [e[0], +e[1]]); return out; };
  const L = (k, known, extra) => { const s = { ...D[k], ...(src[k] || {}) }; return { ...s, amount: num(s.amount, D[k].amount, 0, k === 'shrubs' || k === 'trees' ? 50 : 100), items: items(s.items, known, D[k].items), ...extra(s) }; };
  return {
    ground: (() => { const g = items(src.ground, GREEN_GROUND, D.ground); return g.length ? g : [['grass_block', 100]]; })(),
    ground_patch: num(src.ground_patch ?? D.ground_patch, D.ground_patch, 0, 24),
    cover: L('cover', GREEN_COVER, () => ({})),
    flowers: L('flowers', GREEN_FLOWERS, s => ({ clump: num(s.clump, 0.5, 0, 1) })),
    shrubs: L('shrubs', GREEN_SHRUBS, s => ({ spacing: num(s.spacing, 3, 1, 12), size: GREEN_SHRUB_SIZES[s.size] ? s.size : 'mix' })),
    trees: L('trees', GREEN_TREES, s => ({ spacing: num(s.spacing, 6, 1, 20) })),
    from: { flowers: num((src.from || {}).flowers ?? D.from.flowers, 20, 0, 100), shrubs: num((src.from || {}).shrubs ?? D.from.shrubs, 40, 0, 100), trees: num((src.from || {}).trees ?? D.from.trees, 50, 0, 100) },
    edge: (() => { const e = { ...D.edge, ...(src.edge || {}) }; return { kind: GREEN_EDGES[e.kind] ? e.kind : 'none', block: /^[a-z_]+_leaves$/.test(e.block) ? e.block : 'oak_leaves', border: GREEN_BORDERS[e.border] ? e.border : 'stone_bricks', height: num(e.height, 2, 1, 4) | 0 }; })(),
  };
}
const greenSwatchRecipe = k => greenRecipe({ ...(GREEN_SWATCHES[k] || GREEN_SWATCHES.meadow).recipe });

// ---- fast deterministic hashing / noise (per cell, order independent) ----
function ghash(seed, x, z, salt) {
  let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const GSALT = { ground: 11, gpick: 12, cover: 21, cpick: 22, camt: 23, flower: 31, fpick: 32, fclump: 33, fsp: 34, shrub: 41, spri: 42, spick: 43, ssize: 44, tree: 51, tpri: 52, tpick: 53, tseed: 54, face: 61 };
function gnoise(seed, x, z, scale, salt) {                     // smooth value noise in 0..1
  if (scale <= 0) return ghash(seed, x, z, salt);
  const fx = x / scale, fz = z / scale, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
  const s = t => t * t * (3 - 2 * t), a = ghash(seed, x0, z0, salt), b = ghash(seed, x0 + 1, z0, salt), c = ghash(seed, x0, z0 + 1, salt), d = ghash(seed, x0 + 1, z0 + 1, salt);
  const u = s(tx), v = s(tz); return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
const ramp = (d, from) => { const t = from / 100; return d <= t ? (t === 0 && d > 0 ? d : 0) : t >= 1 ? 1 : (d - t) / (1 - t); };
function gpick(list, u) { let t = 0; for (const [, w] of list) t += w; let r = u * t; for (const [n, w] of list) { r -= w; if (r < 0) return n; } return list[list.length - 1][0]; }

// cached tree shapes: a few seeds per species / size so a forest does not rebuild every tree
const _greenTreeCache = new Map();
function greenTree(id, seed) {
  const [sp, sz] = id.split(':'), k = id + ':' + seed;
  if (!_greenTreeCache.has(k)) { if (_greenTreeCache.size > 64) _greenTreeCache.clear(); _greenTreeCache.set(k, tree({ species: sp, size: sz === 'l' ? 'l' : 'm', seed }).S.blocks); }
  return _greenTreeCache.get(k);
}
// extent of a tree's canopy (cells from the trunk) — used to keep trees off houses and roads
function greenTreeReach(blocks) { let r = 0; for (const k of blocks.keys()) { const [x, , z] = unkey(k); r = Math.max(r, Math.abs(x), Math.abs(z)); } return r; }

// shrub shapes (relative cells [dx, dy, dz]) for the leaf bushes
function shrubCells(size, u) {
  if (size === 's') return [[0, 0, 0]];
  if (size === 'm') return [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
  const out = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const corner = dx && dz; if (corner && ghash(7, dx, dz, (u * 1e6) | 0) < 0.5) continue; out.push([dx, 0, dz]); }
  out.push([0, 1, 0], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]); if (u > 0.5) out.push([0, 2, 0]);
  return out;
}
const shrubReach = size => size === 's' ? 0 : 1;

// ---- the core: write one recipe over a density field --------------------------------------------
// o: { x0, z0, x1, z1           cells to write (inclusive)
//      dens(x, z) -> 0..1       density (may be called outside the box, for neighbours)
//      top(x, z) -> y           the ground block's y at this cell (null = no ground: skip)
//      can(x, y, z) -> bool     may this block be written (free air / not a house, road …)
//      ground(x, z, y, st)      write the ground block
//      set(x, y, z, st)         write a block above ground
//      seed }
// returns counts per layer
function greenPaint(recipe, o) {
  const R = greenRecipe(recipe), seed = (o.seed | 0) || 1, cnt = { ground: 0, cover: 0, flowers: 0, shrubs: 0, trees: 0, edge: 0 };
  const dens = (x, z) => { const v = o.dens(x, z); return v > 0 ? Math.min(1, v) : 0; };
  const edgeAt = (x, z) => dens(x, z) > 0 && (dens(x + 1, z) <= 0 || dens(x - 1, z) <= 0 || dens(x, z + 1) <= 0 || dens(x, z - 1) <= 0);
  const B2 = (n, p) => B(n, p);
  const face = (x, z) => ['north', 'east', 'south', 'west'][(ghash(seed, x, z, GSALT.face) * 4) | 0];
  const occ = new Set(), K = (x, z) => x + ',' + z;            // cells taken by a tree trunk / shrub / hedge (no plant there)
  const groundOf = new Map(), mine = o.mine || new Set(), clip = o.clip || [o.x0, o.z0, o.x1, o.z1];
  const inClip = (x, z) => x >= clip[0] && x <= clip[2] && z >= clip[1] && z <= clip[3];
  // greenery may overlap itself (canopies touch) but never anything else
  const blocked = (x, y, z) => !mine.has(key3(x, y, z)) && !o.can(x, y, z);
  const empty = (x, y, z) => !mine.has(key3(x, y, z)) && o.can(x, y, z);
  const put = (x, y, z, st, over) => { const k = key3(x, y, z); if (mine.has(k) ? !over : !o.can(x, y, z)) return; mine.add(k); if (inClip(x, z)) o.set(x, y, z, st); };
  // 1. ground + edge (only inside the clip box; trees and shrubs are decided over the whole box so that the
  //    parts of a tree standing just outside the clip come out exactly as before)
  for (let x = clip[0]; x <= clip[2]; x++) for (let z = clip[1]; z <= clip[3]; z++) {
    const d = dens(x, z); if (d <= 0) continue; const y = o.top(x, z); if (y == null) continue;
    let g = null;
    if (R.edge.kind === 'border' && edgeAt(x, z)) { g = R.edge.border; cnt.edge++; }
    else if (ghash(seed, x, z, GSALT.ground) < Math.min(1, d * 2)) g = gpick(R.ground, R.ground_patch > 0 ? Math.min(0.9999, gnoise(seed, x, z, R.ground_patch, GSALT.gpick) * 0.85 + ghash(seed, x, z, GSALT.gpick) * 0.15) : ghash(seed, x, z, GSALT.gpick));
    if (g) { o.ground(x, z, y, B2(g, /^(grass_block|podzol|mycelium)$/.test(g) ? { snowy: false } : null)); groundOf.set(K(x, z), g); cnt.ground++; }
    if (R.edge.kind === 'hedge' && edgeAt(x, z)) {
      for (let h = 1; h <= R.edge.height; h++) put(x, y + h, z, LEAF(R.edge.block));
      occ.add(K(x, z)); cnt.edge++;
    }
  }
  const groundPick = (x, z) => {                               // the ground this recipe puts on a cell (same rule as above)
    const d = dens(x, z); if (d <= 0) return null;
    if (R.edge.kind === 'border' && edgeAt(x, z)) return R.edge.border;
    return ghash(seed, x, z, GSALT.ground) < Math.min(1, d * 2) ? gpick(R.ground, R.ground_patch > 0 ? Math.min(0.9999, gnoise(seed, x, z, R.ground_patch, GSALT.gpick) * 0.85 + ghash(seed, x, z, GSALT.gpick) * 0.15) : ghash(seed, x, z, GSALT.gpick)) : null;
  };
  const soilOK = (x, z) => { const g = groundOf.has(K(x, z)) ? groundOf.get(K(x, z)) : groundPick(x, z); return !g || !NO_PLANTS_ON.has(g); };
  // 2. trees and shrubs: hash-priority Poisson disk, only looks at cells within the spacing
  const disk = (L, salt, pri, reachOf) => {
    if (!L.amount || !L.items.length) return [];
    const from = L === R.trees ? R.from.trees : R.from.shrubs, r = L.spacing, out = [];
    // a candidate survives when no candidate of higher priority lies within r: with nd cells in the disk and
    // candidate rate p, about (1 - e^(-p·nd)) / nd of the cells keep a plant. Solve for p so that the amount
    // asked for (plants per 100 cells) is what comes out; it cannot exceed one plant per disk.
    let nd = 0; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if ((dx || dz) && dx * dx + dz * dz <= r * r) nd++;
    const pOf = t => { const x = Math.min(0.97, t * (nd + 1)); return x <= 0 ? 0 : Math.min(1, -Math.log(1 - x) / Math.max(1, nd)); };
    const isCand = (x, z) => { const d = dens(x, z); if (d <= 0) return false; const p = pOf(L.amount / 100 * ramp(d, from)); return p > 0 && ghash(seed, x, z, salt) < p; };
    const prio = (x, z) => ghash(seed, x, z, pri);
    for (let x = o.x0; x <= o.x1; x++) for (let z = o.z0; z <= o.z1; z++) {
      if (!isCand(x, z)) continue;
      const p = prio(x, z); let ok = true;
      for (let dx = -r; dx <= r && ok; dx++) for (let dz = -r; dz <= r; dz++) {
        if ((dx || dz) && dx * dx + dz * dz <= r * r && isCand(x + dx, z + dz)) { const q = prio(x + dx, z + dz); if (q > p || (q === p && (dx > 0 || (dx === 0 && dz > 0)))) { ok = false; break; } }
      }
      if (ok) out.push([x, z]);
    }
    return out;
  };
  for (const [x, z] of disk(R.trees, GSALT.tree, GSALT.tpri)) {
    const y = o.top(x, z); if (y == null || occ.has(K(x, z)) || (R.edge.kind === 'hedge' && edgeAt(x, z)) || !soilOK(x, z)) continue;
    const id = gpick(R.trees.items, ghash(seed, x, z, GSALT.tpick)), bl = greenTree(id, 1 + ((ghash(seed, x, z, GSALT.tseed) * 6) | 0));
    let fits = true;
    // a tree may not touch anything built (o.hard); against hills and wild trees it just loses those leaves
    const hard = o.hard || blocked;
    for (const k of bl.keys()) { const [a, b, c] = unkey(k); if (!mine.has(key3(x + a, y + 1 + b, z + c)) && hard(x + a, y + 1 + b, z + c)) { fits = false; break; } }
    if (!fits) continue;
    for (const [k, st] of bl) { const [a, b, c] = unkey(k), log = /_(log|wood)\b/.test(st); put(x + a, y + 1 + b, z + c, st, log); if (b === 0 && log) occ.add(K(x + a, z + c)); }
    occ.add(K(x, z)); cnt.trees++;
  }
  for (const [x, z] of disk(R.shrubs, GSALT.shrub, GSALT.spri)) {
    const y = o.top(x, z); if (y == null || occ.has(K(x, z)) || (R.edge.kind === 'hedge' && edgeAt(x, z)) || !soilOK(x, z)) continue;
    const id = gpick(R.shrubs.items, ghash(seed, x, z, GSALT.spick)), u = ghash(seed, x, z, GSALT.ssize);
    if (id.startsWith('leaf:')) {
      const size = R.shrubs.size === 'mix' ? (u < 0.35 ? 's' : u < 0.75 ? 'm' : 'l') : R.shrubs.size;
      const cells = shrubCells(size, u).filter(([a, b, c]) => b > 0 || (dens(x + a, z + c) > 0 && o.top(x + a, z + c) === y && !occ.has(K(x + a, z + c))));
      if (!cells.every(([a, b, c]) => b > 0 ? !blocked(x + a, y + 1 + b, z + c) : empty(x + a, y + 1, z + c))) continue;
      for (const [a, b, c] of cells) { put(x + a, y + 1 + b, z + c, LEAF(id.slice(5) + '_leaves')); if (b === 0) occ.add(K(x + a, z + c)); }
    } else {
      if (!empty(x, y + 1, z)) continue;
      put(x, y + 1, z, id === 'sweet_berry_bush' ? B('sweet_berry_bush', { age: 3 }) : B(id)); occ.add(K(x, z));
    }
    cnt.shrubs++;
  }
  // 3. flowers, then cover, one plant per cell
  const F = R.flowers, C = R.cover;
  for (let x = clip[0]; x <= clip[2]; x++) for (let z = clip[1]; z <= clip[3]; z++) {
    const d = dens(x, z); if (d <= 0 || occ.has(K(x, z)) || !soilOK(x, z)) continue;
    const y = o.top(x, z); if (y == null || !empty(x, y + 1, z)) continue;
    let name = null, kind = null;
    if (F.amount && F.items.length) {
      const cl = F.clump, n = gnoise(seed, x, z, 4, GSALT.fclump), w = (1 - cl) + cl * Math.max(0, n * 2.2 - 0.6) / 0.53;   // clumps: same average amount, gathered into patches
      if (ghash(seed, x, z, GSALT.flower) < F.amount / 100 * ramp(d, R.from.flowers) * w) {
        const u = cl > 0 ? Math.min(0.9999, (1 - cl) * ghash(seed, x, z, GSALT.fsp) + cl * gnoise(seed, x, z, 5, GSALT.fpick)) : ghash(seed, x, z, GSALT.fsp);
        name = gpick(F.items, u); kind = 'flowers';
      }
    }
    if (!name && C.amount && C.items.length && ghash(seed, x, z, GSALT.cover) < C.amount / 100 * ramp(d, 0)) { name = gpick(C.items, ghash(seed, x, z, GSALT.cpick)); kind = 'cover'; }
    if (!name) continue;
    if (TALL_GREEN.has(name)) {
      if (!empty(x, y + 2, z)) { if (kind === 'cover') { name = name === 'large_fern' ? 'fern' : 'short_grass'; } else continue; }
      else { put(x, y + 1, z, B(name, { half: 'lower' })); put(x, y + 2, z, B(name, { half: 'upper' })); cnt[kind]++; continue; }
    }
    const amt = 1 + ((ghash(seed, x, z, GSALT.camt) * 4) | 0);
    const st = name === 'pink_petals' || name === 'wildflowers' ? B(name, { facing: face(x, z), flower_amount: amt })
      : name === 'leaf_litter' ? B(name, { facing: face(x, z), segment_amount: amt }) : B(name);
    put(x, y + 1, z, st); cnt[kind]++;
  }
  return cnt;
}
// most plants per 100 cells a spacing allows (one per disk of that radius)
function greenMaxAmount(spacing) { let nd = 0; for (let dx = -spacing; dx <= spacing; dx++) for (let dz = -spacing; dz <= spacing; dz++) if ((dx || dz) && dx * dx + dz * dz <= spacing * spacing) nd++; return Math.floor(97 / (nd + 1) * 10) / 10; }

// ---- component: a rectangle of ground with one recipe (组件模式 → 绿化 → 绿化配方) ----
const GREEN_DEFAULT = { swatch: 'meadow', width: 24, length: 24, preview: 'uniform', density: 100, seed: 1 };
function greenPatch(o = {}) {
  const sp = { ...GREEN_DEFAULT, ...o }, adjust = [];
  sp.width = Math.max(4, Math.min(96, Math.round(+sp.width || 24))); sp.length = Math.max(4, Math.min(96, Math.round(+sp.length || 24)));
  sp.density = Math.max(0, Math.min(100, +sp.density || 0)); if (!GREEN_PREVIEWS[sp.preview]) sp.preview = 'uniform';
  const recipe = greenRecipe(o.recipe || (GREEN_SWATCHES[sp.swatch] || GREEN_SWATCHES.meadow).recipe);
  for (const k of ['trees', 'shrubs']) { const L = recipe[k], mx = greenMaxAmount(L.spacing); if (L.amount > mx) { adjust.push({ key: k + '_amount', got: mx, why: `最小间距 ${L.spacing} 时每 100 格最多约 ${mx}` }); L.amount = mx; } }
  const W = sp.width, L = sp.length, x0 = -(W >> 1), z0 = -(L >> 1), x1 = x0 + W - 1, z1 = z0 + L - 1, k = sp.density / 100;
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const dens = (x, z) => {
    if (!inside(x, z)) return 0;
    if (sp.preview === 'gradient') return k * (x - x0 + 1) / W;
    if (sp.preview === 'round') { const dx = (x - (x0 + x1) / 2) / (W / 2), dz = (z - (z0 + z1) / 2) / (L / 2), r = Math.sqrt(dx * dx + dz * dz); return k * Math.max(0, Math.min(1, (1.05 - r) / 0.6)); }
    return k;
  };
  const S = new Structure();
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) S.set(x, -1, z, 'minecraft:grass_block[snowy=false]');
  const cnt = greenPaint(recipe, { x0, z0, x1, z1, dens, seed: sp.seed, top: () => -1, can: (x, y, z) => !S.has(x, y, z),
    ground: (x, z, y, st) => S.set(x, y, z, st), set: (x, y, z, st) => S.set(x, y, z, st) });
  const report = [`绿化 ${W}×${L}：地面 ${cnt.ground} 格，地被 ${cnt.cover}，花 ${cnt.flowers}，灌木 ${cnt.shrubs}，树 ${cnt.trees}` + (cnt.edge ? `，边 ${cnt.edge} 格` : '')];
  return { S, foot: [x0, z0, x1, z1], tags: ['green'], report, spec: { ...sp, recipe }, adjust, counts: cnt };
}
PROPS.green = { label: '绿化', make: greenPatch, styles: { ...Object.fromEntries(Object.entries(GREEN_SWATCHES).map(([k, v]) => [k, v.name])), custom: '自定义配方' } };

// ---- greenery layers painted over a terrain / town (布局模式的绿化图层) --------------------------------
// layer: { id, recipe, seed, visible, tiles: { 'tx,tz': Uint8Array(256) } }, density 0..255 per cell, 16×16 tiles.
// The overlay is a Map key -> block kept apart from the town's own blocks; it is computed against those blocks
// (never against itself), so any part of it can be recomputed alone and comes out the same.
const GREEN_SOIL = /^minecraft:(grass_block|dirt|podzol|coarse_dirt|rooted_dirt|moss_block|mud|mycelium)(\[|$)/;
const GREEN_SOFT = /^minecraft:(short_grass|grass|tall_grass|fern|large_fern|bush|short_dry_grass|tall_dry_grass|dead_bush|leaf_litter|moss_carpet|pink_petals|wildflowers|poppy|dandelion|cornflower|oxeye_daisy|azure_bluet|allium|lily_of_the_valley|blue_orchid|\w+_tulip|torchflower|rose_bush|lilac|peony|sunflower|snow)(\[|$)/;
const GREEN_NATURAL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|stone|andesite|diorite|granite|deepslate|tuff|gravel|sand|red_sand|sandstone|clay|terracotta|\w+_terracotta|moss_block|mud|snow_block|calcite|water|dirt_path)(\[|$)/;
const greenHard = st => !!st && !GREEN_SOFT.test(st) && !GREEN_NATURAL.test(st) && !(st.includes('_leaves[') && st.includes('persistent=false'));
function greenDensOf(L) {
  const T = L.tiles || {};
  return (x, z) => { const t = T[(x >> 4) + ',' + (z >> 4)]; return t ? t[(x & 15) + ((z & 15) << 4)] / 255 : 0; };
}
function greenBounds(layers) {
  let b = null;
  for (const L of layers) for (const [k, t] of Object.entries(L.tiles || {})) {
    if (!t || !t.some(v => v)) continue; const [tx, tz] = k.split(',').map(Number);
    if (!b) b = [tx * 16, tz * 16, tx * 16 + 15, tz * 16 + 15]; else { b[0] = Math.min(b[0], tx * 16); b[1] = Math.min(b[1], tz * 16); b[2] = Math.max(b[2], tx * 16 + 15); b[3] = Math.max(b[3], tz * 16 + 15); }
  }
  return b;
}
// how far a change can reach: a tree's spacing decides which trunks stay, its canopy reaches out from the trunk
function greenReach(layers) {
  let reach = 2, spacing = 1;
  for (const L of layers) {
    const R = greenRecipe(L.recipe);
    if (R.trees.amount && R.trees.items.length) { spacing = Math.max(spacing, R.trees.spacing); for (const [id] of R.trees.items) for (let s = 1; s <= 6; s++) reach = Math.max(reach, greenTreeReach(greenTree(id, s)) + 1); }
    if (R.shrubs.amount && R.shrubs.items.length) spacing = Math.max(spacing, R.shrubs.spacing);
  }
  return { reach, spacing };
}
// recompute the overlay inside `rect` (null = everywhere). T = Terrain (ground heights) or a Structure.
// returns { ov, clip, maxY }: clip = the box whose blocks may have changed
function greenOverlay(T, layers, rect, ov) {
  const S = T.S || T, vis = (layers || []).filter(L => L && L.visible !== false && L.tiles);
  if (!rect || !ov) ov = new Map();
  let maxY = -1;
  const all = greenBounds(vis), bb = S.box || S.bounds();
  if (!rect) { if (!all) return { ov, clip: null, maxY }; rect = all; }
  const { reach, spacing } = greenReach(vis), m = spacing + 2 * reach + 1;
  const clip = [Math.max(bb[0][0], rect[0] - m), Math.max(bb[0][2], rect[1] - m), Math.min(bb[1][0], rect[2] + m), Math.min(bb[1][2], rect[3] + m)];
  if (clip[0] > clip[2] || clip[1] > clip[3]) return { ov, clip: null, maxY };
  for (const k of [...ov.keys()]) { const i = k.indexOf(','), j = k.lastIndexOf(','), x = +k.slice(0, i), z = +k.slice(j + 1); if (x >= clip[0] && x <= clip[2] && z >= clip[1] && z <= clip[3]) ov.delete(k); }
  if (!vis.length) return { ov, clip, maxY };
  const dfs = vis.map(greenDensOf), own = new Map();
  const owner = (x, z) => { const k = x + ',' + z; let o = own.get(k); if (o === undefined) { o = -1; for (let i = vis.length - 1; i >= 0; i--) if (dfs[i](x, z) > 0) { o = i; break; } own.set(k, o); } return o; };
  const tops = new Map(), y0 = bb[0][1], y1 = bb[1][1];
  const top = (x, z) => {
    const k = x + ',' + z; if (tops.has(k)) return tops.get(k);
    let y = null;
    if (T.inside) { if (T.inside(x, z) && !T.water[T.idx(x, z)]) { const h = T.H(x, z), st = S.get(x, h, z); if (h >= y0 && st && GREEN_SOIL.test(st)) y = h; } }
    else for (let yy = y1; yy >= y0; yy--) { const st = S.get(x, yy, z); if (!st || GREEN_SOFT.test(st)) continue; if (GREEN_SOIL.test(st)) y = yy; break; }
    if (y != null) { const up = S.get(x, y + 1, z); if (up && !GREEN_SOFT.test(up)) y = null; }
    tops.set(k, y); return y;
  };
  const can = (x, y, z) => { const st = S.get(x, y, z); return !st || GREEN_SOFT.test(st); }, hard = (x, y, z) => greenHard(S.get(x, y, z));
  const mine = new Set(), lx0 = clip[0] - reach - spacing, lz0 = clip[1] - reach - spacing, lx1 = clip[2] + reach + spacing, lz1 = clip[3] + reach + spacing;
  vis.forEach((L, i) => {
    greenPaint(L.recipe, { x0: lx0, z0: lz0, x1: lx1, z1: lz1, clip, seed: L.seed || 1, mine, top, can, hard,
      dens: (x, z) => owner(x, z) === i ? dfs[i](x, z) : 0,
      ground: (x, z, y, st) => ov.set(key3(x, y, z), st),
      set: (x, y, z, st) => ov.set(key3(x, y, z), st) });
  });
  for (const k of ov.keys()) { const y = +k.split(',')[1]; if (y > maxY) maxY = y; }
  return { ov, clip, maxY };
}
// run fn with the overlay written into S, then put S back exactly as it was
function greenWith(S, ov, fn) {
  if (!ov || !ov.size) return fn();
  const prev = [];
  for (const [k, st] of ov) { prev.push([k, S.blocks.get(k)]); S.blocks.set(k, st); }
  try { return fn(); } finally { for (const [k, st] of prev) { if (st === undefined) S.blocks.delete(k); else S.blocks.set(k, st); } }
}

// ---- automatic greenery for an automatic layout (自动布局 → 空地绿化) ----
// Density grows with the distance from the nearest road: front gardens stay plain grass, the land behind the
// houses fills in (with a forest recipe: lawn first, then shrubs, then trees). Houses, roads and squares are
// skipped by the overlay itself. Depends only on the roads and the selection, so moving a house never changes it.
function greenAuto(scene, zones) {
  const out = [], roads = scene && scene.roadSet ? scene.roadSet : new Map();
  for (const zn of zones || []) {
    if (zn.kind !== 'district' || !zn.green || !zn.green.recipe) continue;
    const M = zoneMask(zn); if (!M.count) continue;
    const near = 7, ramp = 10, W = M.x1 - M.x0 + 1, L = M.z1 - M.z0 + 1, dist = new Float32Array(W * L).fill(Infinity), q = [];
    for (const k of roads.keys()) { const [x, , z] = k.split(',').map(Number); if (x < M.x0 || x > M.x1 || z < M.z0 || z > M.z1) continue; const i = (x - M.x0) + (z - M.z0) * W; if (dist[i]) { dist[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, z = (i / W) | 0, d = dist[i] + 1;       // 4-neighbour distance (cells)
      if (d > near + ramp) continue;
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) { if (nx < 0 || nz < 0 || nx >= W || nz >= L) continue; const j = nx + nz * W; if (dist[j] > d) { dist[j] = d; q.push(j); } } }
    const tiles = {};
    for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
      const wx = x + M.x0, wz = z + M.z0; if (!M.has(wx, wz)) continue;
      const v = Math.max(0, Math.min(1, (dist[x + z * W] - near) / ramp)); if (!v) continue;
      const tk = (wx >> 4) + ',' + (wz >> 4), t = tiles[tk] || (tiles[tk] = new Uint8Array(256)); t[(wx & 15) + ((wz & 15) << 4)] = Math.round(v * 255);
    }
    out.push({ id: 'auto' + zn.id, recipe: zn.green.recipe, seed: ((zn.seed || 1) * 131 + 7) | 0, visible: true, tiles });
  }
  return out;
}
