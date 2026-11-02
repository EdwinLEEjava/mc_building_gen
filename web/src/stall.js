// ---------------------------------------------------------------------------------------------
// Market stall (集市摊位) as its own component. Front = north (-z), the customer side.
// Rule that keeps sight lines open: the counter top only carries LOW goods (carpets, pots,
// candles, cake, pressure plates...); full-block stock goes in crates on the ground in front,
// or on shelves against the back, behind the vendor. The canopy starts 3 blocks up.
// ---------------------------------------------------------------------------------------------
const STALL_ROOFS = { flat: '条纹平顶布棚', slant: '斜坡布棚', jagged: '锯齿边布棚', tent: '尖顶帐篷', gable: '木瓦双坡顶' };
const C_ = (n, p) => [n, p];
const CANDLE = c => C_(`${c}candle`, { candles: 3, lit: false, waterlogged: false });
const STALL_WARES = {
  produce: { label: '蔬果', counter: [C_('lime_carpet'), C_('orange_carpet'), C_('red_carpet'), C_('flower_pot')], front: [C_('melon'), C_('pumpkin'), C_('composter', { level: 7 }), C_('hay_block', { axis: 'y' })], back: [C_('pumpkin'), C_('melon'), C_('hay_block', { axis: 'x' })] },
  bakery: { label: '面包', counter: [C_('cake', { bites: 0 }), C_('brown_carpet'), C_('yellow_carpet'), C_('cake', { bites: 2 })], front: [C_('hay_block', { axis: 'y' }), C_('barrel', { facing: 'up', open: true })], back: [C_('smoker', { facing: 'north', lit: false }), C_('hay_block', { axis: 'y' }), C_('barrel', { facing: 'north', open: false })] },
  fish: { label: '鱼', counter: [C_('sea_pickle', { pickles: 3, waterlogged: false }), C_('light_blue_carpet'), C_('cyan_carpet')], front: [C_('barrel', { facing: 'up', open: true }), C_('packed_ice'), C_('blue_ice')], back: [C_('barrel', { facing: 'north', open: false }), C_('packed_ice')] },
  smith: { label: '铁器', counter: [C_('heavy_weighted_pressure_plate', { power: 0 }), C_('chain', { axis: 'x', waterlogged: false }), C_('light_gray_carpet')], front: [C_('anvil', { facing: 'west' }), C_('grindstone', { face: 'floor', facing: 'north' })], back: [C_('smithing_table'), C_('blast_furnace', { facing: 'north', lit: false }), C_('iron_block')] },
  cloth: { label: '布匹', counter: [C_('white_carpet'), C_('red_carpet'), C_('blue_carpet'), C_('yellow_carpet'), C_('purple_carpet')], front: [C_('white_wool'), C_('light_gray_wool')], back: [C_('red_wool'), C_('blue_wool'), C_('yellow_wool'), C_('green_wool'), C_('loom', { facing: 'north' })] },
  pottery: { label: '陶罐', counter: [C_('flower_pot'), CANDLE(''), C_('flower_pot')], front: [C_('decorated_pot', { cracked: false, facing: 'north', waterlogged: false }), C_('terracotta')], back: [C_('decorated_pot', { cracked: false, facing: 'north', waterlogged: false }), C_('terracotta'), C_('brown_terracotta')] },
  books: { label: '书籍', counter: [C_('brown_carpet'), CANDLE('white_'), C_('red_carpet')], front: [C_('barrel', { facing: 'up', open: false })], back: [C_('bookshelf'), C_('chiseled_bookshelf', { facing: 'north', slot_0_occupied: true, slot_1_occupied: false, slot_2_occupied: true, slot_3_occupied: true, slot_4_occupied: false, slot_5_occupied: true }), C_('bookshelf')] },
  flowers: { label: '花', counter: [C_('potted_poppy'), C_('potted_dandelion'), C_('potted_blue_orchid'), C_('potted_allium'), C_('potted_oxeye_daisy'), C_('potted_cornflower')], front: [C_('moss_block'), C_('flowering_azalea_leaves', { distance: 1, persistent: true, waterlogged: false })], back: [C_('flowering_azalea_leaves', { distance: 1, persistent: true, waterlogged: false }), C_('azalea_leaves', { distance: 1, persistent: true, waterlogged: false })] },
  potions: { label: '药水', counter: [C_('brewing_stand', { has_bottle_0: true, has_bottle_1: true, has_bottle_2: false }), CANDLE('purple_'), C_('flower_pot')], front: [C_('barrel', { facing: 'up', open: false })], back: [C_('bookshelf'), C_('cauldron'), C_('barrel', { facing: 'north', open: false })] },
};
const STALL_COLORS = { red: '红白', blue: '蓝白', green: '绿黄', orange: '橙白', purple: '紫黄', brown: '棕米', plain: '素色帆布' };
const STALL_COLOR_PAIRS = { red: ['red', 'white'], blue: ['blue', 'white'], green: ['green', 'yellow'], orange: ['orange', 'white'], purple: ['purple', 'yellow'], brown: ['brown', 'white'], plain: ['white', 'white'] };
const STALL_DEFAULT = { roof: 'flat', wares: 'produce', width: 5, depth: 3, wood: 'spruce', colors: 'auto', front_display: true, back_shelf: true, lantern: true, seed: 1 };

function stall(o = {}) {
  const p = { ...STALL_DEFAULT, ...o };
  const rng = new PyRandom(deriveSeed(p.seed || 1, 'stall'));
  const pick = a => a[Math.floor(rng.random() * a.length)];
  const W = Math.max(3, Math.min(9, p.width | 0)) | 1, hw = W >> 1;   // odd width, posts at x = ±hw
  const D = Math.max(2, Math.min(5, p.depth | 0)), z0 = -Math.floor((D - 1) / 2), zb = z0 + D - 1;
  const wood = p.wood || 'spruce', wares = STALL_WARES[p.wares] || STALL_WARES.produce;
  const colKey = p.colors === 'auto' || !STALL_COLOR_PAIRS[p.colors] ? pick(Object.keys(STALL_COLOR_PAIRS).filter(k => k !== 'plain')) : p.colors;
  const [c1, c2] = STALL_COLOR_PAIRS[colKey];
  const S = new Structure(), put = (x, y, z, [n, pr]) => S.set(x, y, z, B(n, pr && Object.keys(pr).length ? pr : undefined));
  const fence = B(`${wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false });
  const roof = STALL_ROOFS[p.roof] ? p.roof : 'flat';

  // ---- canopy shape: height of the underside per row z (front overhang zf .. back zb(+1)) ----
  const zf = z0 - 1, zr = roof === 'gable' || roof === 'tent' ? zb + 1 : zb, rows = zr - zf + 1;
  const base = 3;                                    // clear height under the front edge
  const rowY = z => {
    const i = z - zf;
    if (roof === 'slant') return base + Math.floor(i * 2 / rows);            // rises toward the back
    if (roof === 'gable' || roof === 'tent') return base + Math.min(i, rows - 1 - i);
    return base;
  };
  const stripe = x => B(`${(x + hw) % 2 === 0 ? c1 : c2}_wool`);
  for (let x = -hw; x <= hw; x++) for (let z = zf; z <= zr; z++) {
    const y = rowY(z), i = z - zf, ridge = (roof === 'gable' || roof === 'tent') && (i === (rows - 1) / 2);
    if (roof === 'gable') {
      const f = i < (rows - 1) / 2 ? 'south' : 'north';
      S.set(x, y, z, ridge ? B(`${wood}_slab`, { type: 'bottom', waterlogged: false }) : B(`${wood}_stairs`, { facing: f, half: 'bottom', shape: 'straight', waterlogged: false }));
      if (!ridge && i > 0 && i < rows - 1) S.set(x, y - 1, z, B(`${wood}_planks`));
      if (ridge) S.set(x, y - 1, z, B(`${wood}_planks`));
    } else {
      S.set(x, y, z, stripe(x));
      if (roof === 'slant' && z > zf && rowY(z - 1) < y) S.set(x, y - 1, z, stripe(x));   // close the step
      if (roof === 'tent' && i > 0 && i < rows - 1) for (let yy = base; yy < y; yy++) S.setIfEmpty(x, yy, z, stripe(x));
    }
  }
  if (roof === 'jagged') for (let x = -hw; x <= hw; x += 2) S.set(x, base - 1, zf, stripe(x));     // valance teeth

  // ---- posts: corners of the booth, up to the canopy ----
  const postZ = [z0, zb];
  for (const x of [-hw, hw]) for (const z of postZ) for (let y = 0; y < rowY(z) - (roof === 'gable' && z !== zf && z !== zr ? 1 : 0); y++) S.setIfEmpty(x, y, z, fence);

  // ---- counter (front row between the posts) with low goods only ----
  for (let x = -hw + 1; x <= hw - 1; x++) {
    S.set(x, 0, z0, (x + hw) % 2 ? B(`${wood}_planks`) : B('barrel', { facing: 'north', open: false }));
    if (rng.random() < 0.8) put(x, 1, z0, pick(wares.counter));
  }
  // side rails: trapdoor panels at the counter ends make it read as a booth
  for (const x of [-hw, hw]) for (let z = z0 + 1; z < zb; z++) S.set(x, 0, z, B(`${wood}_trapdoor`, { facing: x < 0 ? 'east' : 'west', half: 'bottom', open: true, powered: false, waterlogged: false }));

  // ---- crates on the ground in front, at the two ends only (middle stays open for customers) ----
  if (p.front_display) for (const x of W >= 5 ? [-hw + 1, hw - 1] : [-hw]) if (rng.random() < 0.85) put(x, 0, z0 - 1, pick(wares.front));

  // ---- back shelf: storage low, stock above it (behind the vendor, so it never blocks the view) ----
  if (p.back_shelf && D >= 2) for (let x = -hw + 1; x <= hw - 1; x++) {
    S.set(x, 0, zb, rng.random() < 0.5 ? B('barrel', { facing: 'north', open: false }) : B(`${wood}_planks`));
    if (rng.random() < 0.75 && rowY(zb) > 2) put(x, 1, zb, pick(wares.back));
  }

  // ---- a lantern under the front edge of the canopy ----
  if (p.lantern) S.set(hw, base - 1 - (roof === 'jagged' && hw % 2 === 0 ? 0 : 0), zf, S.has(hw, base - 1, zf) ? null : B('lantern', { hanging: true, waterlogged: false }));
  if (p.lantern && roof === 'jagged' && !S.has(hw - 1, base - 1, zf)) { S.set(hw, base - 1, zf, stripe(hw)); S.set(hw - 1, base - 1, zf, B('lantern', { hanging: true, waterlogged: false })); }

  fixConnections(S); stairShapes(S);
  const report = [`摊位：${STALL_ROOFS[roof]}，${W}×${D}，${wares.label}，${STALL_COLORS[colKey]}`];
  return { S, foot: [-hw, hw, zf, zr], tags: ['market'], report, spec: { ...p, width: W, depth: D, colors: colKey }, adjust: (p.width | 0) % 2 === 0 && W !== (p.width | 0) ? [{ key: 'width', got: W, why: '摊位宽必须是奇数，两侧立柱才能对称' }] : [] };
}
