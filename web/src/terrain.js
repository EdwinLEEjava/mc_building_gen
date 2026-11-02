// ---------------------------------------------------------------------------------------------
// Terrain: a region of the user's world (exported with WorldEdit as .schem) turned into a height
// map, plus the cut / fill operations every site generator uses. Coordinates are the schematic's
// local ones; the result keeps the same box so `//paste -o` puts it back in place.
// ---------------------------------------------------------------------------------------------
const NOT_GROUND = /(_log|_wood|_stem|hyphae|leaves|short_grass|tall_grass|fern|flower|poppy|dandelion|tulip|orchid|allium|bluet|daisy|cornflower|lily|rose|bush|sapling|vine|snow\b|mushroom|sugar_cane|kelp|seagrass|torch|lantern|carpet|_sign|wildflowers|leaf_litter|pink_petals|moss_carpet|cactus|bamboo)/;
const isAir = st => st === undefined || st === 'minecraft:air' || st === 'minecraft:cave_air' || st === 'minecraft:void_air';
const isWater = st => !!st && (st.startsWith('minecraft:water') || st.startsWith('minecraft:bubble_column'));
const isGround = st => !isAir(st) && !isWater(st) && !NOT_GROUND.test(st.split('[')[0]);
const isTreePart = st => !!st && /(_log|_wood|leaves)/.test(st.split('[')[0]) && !st.includes('stripped');

class Terrain {
  // S: Structure of the exported region. The box is fixed to the region's bounds.
  constructor(S) {
    this.S = S;
    const [[x0, y0, z0], [x1, y1, z1]] = S.box || S.bounds();
    S.box = [[x0, y0, z0], [x1, y1, z1]];
    Object.assign(this, { x0, y0, z0, x1, y1, z1, W: x1 - x0 + 1, L: z1 - z0 + 1 });
    this.h = new Int16Array(this.W * this.L);       // top ground block y (y0 - 1 = none)
    this.water = new Uint8Array(this.W * this.L);   // water on top of the ground
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.scan(x, z);
    this.orig = this.h.slice();
    this.changed = 0; this.cut = 0; this.fill = 0; this.maxCut = 0; this.maxFill = 0;
  }
  idx(x, z) { return (x - this.x0) * this.L + (z - this.z0); }
  inside(x, z) { return x >= this.x0 && x <= this.x1 && z >= this.z0 && z <= this.z1; }
  scan(x, z) {
    let top = this.y0 - 1, wat = 0;
    for (let y = this.y1; y >= this.y0; y--) {
      const st = this.S.get(x, y, z);
      if (isWater(st)) { wat = 1; continue; }
      if (isGround(st)) { top = y; break; }
    }
    this.h[this.idx(x, z)] = top; this.water[this.idx(x, z)] = wat;
  }
  H(x, z) { return this.h[this.idx(x, z)]; }
  surface(x, z) { return this.S.get(x, this.H(x, z), z); }
  // remove every tree (logs + leaves, connected) that touches the given cells
  clearTreesAt(cells) {
    const seen = new Set(), stack = [];
    for (const [x, y, z] of cells) if (isTreePart(this.S.get(x, y, z))) stack.push([x, y, z]);
    while (stack.length) {
      const [x, y, z] = stack.pop(), k = key3(x, y, z);
      if (seen.has(k)) continue; seen.add(k);
      if (this.protect && this.protect.has(k)) continue;     // never eat into a placed building's timber
      if (!isTreePart(this.S.get(x, y, z))) continue;
      this.S.del(x, y, z);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
        if ((dx || dy || dz) && seen.size < 4000) stack.push([x + dx, y + dy, z + dz]);
    }
  }
  // set the ground of one column to height y: cut everything above, fill below with dirt over stone.
  // `top` = surface block (default: grass on fills and cuts, the old surface if unchanged)
  setGround(x, z, y, top) {
    if (!this.inside(x, z)) return;
    const i = this.idx(x, z), o = this.orig[i], cur = this.h[i];
    const trees = [];
    for (let yy = y + 1; yy <= this.y1; yy++) {
      const st = this.S.get(x, yy, z);
      if (this.protect && this.protect.has(key3(x, yy, z))) continue;   // buildings already placed stay intact
      if (isTreePart(st)) trees.push([x, yy, z]);
      else if (!isAir(st)) this.S.del(x, yy, z);
    }
    if (trees.length) this.clearTreesAt(trees);
    for (let yy = Math.min(cur, y) + 1; yy <= y; yy++) this.S.set(x, yy, z, y - yy < 3 ? 'minecraft:dirt' : 'minecraft:stone');
    this.S.set(x, y, z, top || (y === o && cur === o ? this.S.get(x, y, z) || 'minecraft:grass_block[snowy=false]' : 'minecraft:grass_block[snowy=false]'));
    if (y < cur && this.S.get(x, y - 1, z) === 'minecraft:grass_block[snowy=false]') this.S.set(x, y - 1, z, 'minecraft:dirt');
    this.h[i] = y; this.water[i] = 0;
  }
  // bookkeeping of earthworks against the original surface
  summary() {
    let cut = 0, fill = 0, maxCut = 0, maxFill = 0, cols = 0;
    for (let i = 0; i < this.h.length; i++) {
      const d = this.h[i] - this.orig[i];
      if (d) cols++;
      if (d > 0) { fill += d; maxFill = Math.max(maxFill, d); } else { cut -= d; maxCut = Math.max(maxCut, -d); }
    }
    return { cut, fill, maxCut, maxFill, cols, share: cols / this.h.length };
  }
  // slope (max height difference to the 4 neighbours) for planning
  slope(x, z) {
    const h = this.H(x, z); let s = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inside(x + dx, z + dz)) s = Math.max(s, Math.abs(this.H(x + dx, z + dz) - h));
    return s;
  }
}

// ---- synthetic terrain for tests and demos (value noise from the seeded hash) ----
function synthTerrain({ W = 96, L = 96, base = 12, amp = 8, scale = 28, seed = 1, river = false, trees = 0.012, flat = false } = {}) {
  const S = new Structure();
  const n2 = (x, z, s, k) => {
    const gx = Math.floor(x / s), gz = Math.floor(z / s), fx = x / s - gx, fz = z / s - gz;
    const v = (a, b) => _h(seed, k, a, b);
    const sm = t => t * t * (3 - 2 * t), u = sm(fx), w = sm(fz);
    return (v(gx, gz) * (1 - u) + v(gx + 1, gz) * u) * (1 - w) + (v(gx, gz + 1) * (1 - u) + v(gx + 1, gz + 1) * u) * w;
  };
  const hs = new Int16Array(W * L);
  for (let x = 0; x < W; x++) for (let z = 0; z < L; z++) {
    let h = flat ? base : base + amp * (n2(x, z, scale, 'a') * 0.7 + n2(x, z, scale / 2.5, 'b') * 0.3 - 0.5) * 2;
    if (river) { const c = L * 0.72 + 6 * Math.sin(x / 13); const d = Math.abs(z - c); if (d < 6) h = Math.min(h, base - Math.round(amp * 0.55) - 3 + d * 0.5); }
    hs[x * L + z] = Math.round(h);
  }
  const waterY = base - Math.round(amp * 0.55) - 1;
  for (let x = 0; x < W; x++) for (let z = 0; z < L; z++) {
    const h = hs[x * L + z];
    for (let y = 0; y <= h; y++) S.set(x, y, z, y === h ? (h < waterY + 1 ? 'minecraft:sand' : 'minecraft:grass_block[snowy=false]') : y > h - 3 ? 'minecraft:dirt' : 'minecraft:stone');
    for (let y = h + 1; y <= waterY; y++) S.set(x, y, z, 'minecraft:water[level=0]');
  }
  // a few natural trees (non-persistent leaves, as the game makes them)
  for (let x = 3; x < W - 3; x++) for (let z = 3; z < L - 3; z++) {
    const h = hs[x * L + z];
    if (h <= waterY || _h(seed, 'tree', x, z) > trees) continue;
    const th = 4 + Math.floor(_h(seed, 'th', x, z) * 3);
    for (let y = h + 1; y <= h + th; y++) S.set(x, y, z, 'minecraft:oak_log[axis=y]');
    for (let dy = th - 2; dy <= th + 1; dy++) {
      const r = dy >= th ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === th + 1 || _h(seed, 'c', x + dx, z + dz, dy) < 0.5)) continue;
        if (!S.has(x + dx, h + dy, z + dz)) S.set(x + dx, h + dy, z + dz, 'minecraft:oak_leaves[distance=1,persistent=false,waterlogged=false]');
      }
    }
  }
  S.box = [[0, 0, 0], [W - 1, base + amp + 14, L - 1]];
  return S;
}
