// ---------------------------------------------------------------------------------------------
// HouseBuilder (port of house.py)
// ---------------------------------------------------------------------------------------------
function patchNoise(x, y, z, seed, key, scale) {
  if (scale <= 1) return _h(seed, key, x, y, z);
  const j = [0, 1, 2].map(a => _h(seed, key, 'j', a, x, y, z) * scale * 0.7);
  const cell = [Math.trunc(fdiv(x + j[0], scale)), Math.trunc(fdiv(y + j[1], scale)), Math.trunc(fdiv(z + j[2], scale))];
  return _h(seed, key, ...cell);
}
function framePositions(a, b, spacing) {
  const L = b - a, n = Math.max(1, Math.trunc(L / spacing + 0.5));
  const s = new Set(); for (let k = 0; k <= n; k++) s.add(a + pyRound(k * L / n));
  return [...s].sort((p, q) => p - q);
}
function* ring(x0, x1, z0, z1) {
  for (let x = x0; x <= x1; x++) { yield [x, z0]; yield [x, z1]; }
  for (let z = z0 + 1; z < z1; z++) { yield [x0, z]; yield [x1, z]; }
}
const range = (a, b, step = 1) => { const o = []; if (step > 0) for (let i = a; i < b; i += step) o.push(i); else for (let i = a; i > b; i += step) o.push(i); return o; };
const OUT = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const PH_RE = /minecraft:@([a-z_]+)/;

class HouseBuilder {
  constructor(spec) {
    this.spec = { ...DEFAULT_SPEC, ...spec };
    this.p = PALETTES[this.spec.palette];
    if (!this.p) throw new Error('未知风格 ' + this.spec.palette);
    [this.p, this.colorReport] = applyColors(this.p, this.spec.colors);
    const seeds = {};
    for (const a of ['windows', 'materials', 'plants', 'dormers']) seeds[a] = deriveSeed(this.spec.seed, a);
    for (const [a, v] of Object.entries(this.spec.seeds || {})) seeds[a] = deriveSeed(v, a);
    this.seeds = seeds;
    this.rng = new PyRandom(seeds.windows);
    this.rngPlants = new PyRandom(seeds.plants);
    this.rngDormers = new PyRandom(seeds.dormers);
    this.S = new Structure();
  }
  m(slot) { const e = this.p[slot]; return isStr(e) ? e : '@' + slot; }

  resolveMaterials() {
    const mixes = this.p._mix || {};
    const todo = [];
    for (const [k, st] of this.S.blocks) if (st.includes('@')) todo.push([k, st, PH_RE.exec(st)[1]]);
    const ctx = Object.keys(mixes).length ? this.mixContext(todo, mixes) : {};
    for (const [k, st, slot] of todo) {
      const entry = this.p[slot], pos = unkey(k);
      let name;
      if (slot in mixes && !isStr(entry)) name = entry[this.mixIndex(pos, slot, mixes[slot], ctx, entry.length)][0];
      else {
        const group = NOISE_GROUP[slot] || slot;
        const u = patchNoise(pos[0], pos[1], pos[2], this.seeds.materials, group, NOISE_SCALE[group] !== undefined ? NOISE_SCALE[group] : 2);
        name = pickU(u, entry);
      }
      this.S.blocks.set(k, st.replace(PH_RE, 'minecraft:' + name));
    }
  }
  mixContext(todo, mixes) {
    const ext = {};
    for (const [k, , slot] of todo) {
      const g = (mixes[slot] || {}).group;
      if (g === undefined || g === null) continue;
      const [x, y, z] = unkey(k);
      const e = ext[g] || (ext[g] = [x, x, y, y, z, z]);
      e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], y); e[3] = Math.max(e[3], y); e[4] = Math.min(e[4], z); e[5] = Math.max(e[5], z);
    }
    const open = new Set();
    for (const [k, v] of this.S.blocks) if (v.includes('glass') || v.includes('_door[')) open.add(k);
    return { ext, open };
  }
  static ease(t, curve) {
    if (curve === 'ease_in') return t * t;
    if (curve === 'ease_out') return 1 - Math.pow(1 - t, 2);
    if (curve === 'ease_in_out') return t * t * (3 - 2 * t);
    return t;
  }
  mixIndex(pos, slot, cfg, ctx, n) {
    const [x, y, z] = pos, seed = this.seeds.materials, g = cfg.group;
    const [x0, x1, y0, y1, z0, z1] = ctx.ext[g] || [x, x, y, y, z, z];
    const hy = (y - y0) / Math.max(1, y1 - y0);
    const jit = Number(cfg.jitter !== undefined ? cfg.jitter : 0.35);
    const scale = Math.max(1, Math.trunc(cfg.scale !== undefined ? cfg.scale : 2));
    const clump = patchNoise(x, y, z, seed, 'mix:' + g, scale);
    const fine = patchNoise(x, y, z, seed, 'mixf:' + g, 1);
    const style = cfg.style;
    let t;
    if (style === 'cluster' || style === 'speckle') {
      const u = style === 'cluster' ? clump : fine, entry = this.p[slot], nm = pickU(u, entry);
      return entry.findIndex(([e]) => e === nm);
    }
    if (style === 'bottom_dark' || style === 'eave_dark') t = hy;
    else if (style === 'top_dark' || style === 'ridge_dark') t = 1 - hy;
    else if (style === 'horizontal') t = (x1 - x0) >= (z1 - z0) ? (x - x0) / Math.max(1, x1 - x0) : (z - z0) / Math.max(1, z1 - z0);
    else {
      let dark = Math.pow(1 - hy, 2) * 0.9;
      const cx = Math.min(Math.abs(x - x0), Math.abs(x - x1)) <= 1 && Math.min(Math.abs(z - z0), Math.abs(z - z1)) <= 1;
      if (cx) dark = Math.max(dark, 0.6);
      const op = ctx.open;
      let near = false;
      for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (op.has(key3(x + dx, y + dy, z + dz))) near = true;
      if (near) dark = Math.max(dark, 0.55);
      const N5 = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      const hitAt = dy => N5.some(([dx, dz]) => op.has(key3(x + dx, y + dy, z + dz)));
      const dys = [1, 2, 3].filter(hitAt);
      if (dys.length) dark = Math.max(dark, 0.7 - 0.1 * Math.min(...dys));
      t = 1 - dark;
      t = 0.55 * t + 0.45 * clump;
    }
    t = HouseBuilder.ease(Math.min(1.0, Math.max(0.0, t)), cfg.curve !== undefined ? cfg.curve : 'linear');
    t += jit * (clump - 0.5);
    if (cfg.curve === 'step') t = pyRound(t * (n - 1)) / Math.max(1, n - 1);
    let i = Math.trunc(pyRound(Math.min(1.0, Math.max(0.0, t)) * (n - 1)));
    const skip = Number(cfg.skip || 0);
    if (skip && fine < skip) i = Math.min(n - 1, Math.max(0, i + (fine < skip / 2 ? 2 : -2)));
    return i;
  }
  log(slot, axis) { return B(this.p[slot], { axis }); }

  foundation([x0, x1, z0, z1]) { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.S.set(x, 0, z, B(this.m('base'))); }

  storey(k, outer, y0, h, infillSlot, frontDoor) {
    const S = this.S, p = this.p;
    const [x0, x1, z0, z1] = outer, ix0 = x0 + 1, ix1 = x1 - 1, iz0 = z0 + 1, iz1 = z1 - 1;
    const flush = !!this.spec.flush_walls, sp = this.spec.post_spacing;
    const xs = framePositions(x0, x1, sp), zs = framePositions(z0, z1, sp);
    const postList = [], postSet = new Set();
    for (const pr of [...xs.map(x => [x, z0]), ...xs.map(x => [x, z1]), ...zs.map(z => [x0, z]), ...zs.map(z => [x1, z])]) {
      const kk = pr[0] + ',' + pr[1]; if (!postSet.has(kk)) { postSet.add(kk); postList.push(pr); }
    }
    let cornerFill = new Set();
    for (const [cx, cz, dx, dz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]]) { cornerFill.add((cx + dx) + ',' + cz); cornerFill.add(cx + ',' + (cz + dz)); }
    for (const kk of postSet) cornerFill.delete(kk);
    if (flush) cornerFill = new Set();
    for (let x = ix0; x <= ix1; x++) for (let z = iz0; z <= iz1; z++) S.setIfEmpty(x, y0, z, B(p.floor));
    for (let x = ix0 + 1; x < ix1; x++) for (let z = iz0 + 1; z < iz1; z++) S.set(x, y0, z, B(p.floor));
    for (const [x, z] of ring(x0, x1, z0, z1)) S.setIfEmpty(x, y0, z, this.log('beam', (z === z0 || z === z1) ? 'x' : 'z'));
    for (let y = y0 + 1; y < y0 + h; y++) {
      for (const [x, z] of (flush ? ring(x0, x1, z0, z1) : ring(ix0, ix1, iz0, iz1))) S.set(x, y, z, B(this.m(infillSlot)));
      for (const [x, z] of postList) S.set(x, y, z, this.log('post', 'y'));
    }
    this.cornerGaps = cornerFill;
    for (const [x, z] of ring(x0, x1, z0, z1)) S.set(x, y0 + h, z, this.log('beam', (z === z0 || z === z1) ? 'x' : 'z'));
    for (const [x, z] of postList) if ((x === x0 || x === x1) && (z === z0 || z === z1)) S.set(x, y0 + h, z, this.log('post', 'y'));

    const sides = [['north', xs, z0, iz0, 'x'], ['south', xs, z1, iz1, 'x'], ['west', zs, x0, ix0, 'z'], ['east', zs, x1, ix1, 'z']];
    const centerX = (x0 + x1) / 2, plan = [];
    const OUTSIDE = { north: -1, west: -1, south: 1, east: 1 };
    for (let [side, ps, outerC, innerC, along] of sides) {
      let lo, hi;
      if (flush) { [lo, hi] = along === 'x' ? [x0, x1] : [z0, z1]; innerC = outerC; }
      else { [lo, hi] = along === 'x' ? [ix0, ix1] : [iz0, iz1]; }
      const bays = [];
      for (let i = 0; i + 1 < ps.length; i++) {
        const a = ps[i], b = ps[i + 1];
        const inner = range(a + 1, b).filter(c => lo < c && c < hi);
        const outerCells = range(a + 1, b).filter(c => !cornerFill.has(this.xz(along, c, outerC).join(',')));
        if (outerCells.length) bays.push([inner, outerCells]);
      }
      let doorBay = null;
      if (frontDoor && side === 'north' && bays.length) {
        doorBay = range(0, bays.length).reduce((best, i) => {
          const o = bays[i][1], kk = [Math.abs(o.reduce((s, v) => s + v, 0) / o.length - centerX), -o.length];
          return (best === null || cmp(kk, best[1]) < 0) ? [i, kk] : best;
        }, null)[0];
      }
      bays.forEach(([inner, outerCells], bi) => {
        let role;
        if (bi === doorBay) role = 'door';
        else if (inner.length >= 3 && this.rng.random() < WINDOW_P[side]) role = 'window';
        else role = 'frame';
        plan.push([side, outerC, innerC, along, inner, outerCells, role, OUTSIDE[side]]);
      });
    }
    let eligible = plan.filter(b => b[6] === 'frame' && b[4].length >= 3);
    const front = eligible.filter(b => b[0] === 'north');
    if (front.length && !plan.some(b => b[6] === 'window' && b[0] === 'north')) this.rng.choice(front)[6] = 'window';
    eligible = plan.filter(b => b[6] === 'frame' && b[4].length >= 3);
    while (plan.filter(b => b[6] === 'window').length < 2 && eligible.length) {
      const b = this.rng.choice(eligible); b[6] = 'window'; eligible.splice(eligible.indexOf(b), 1);
    }
    for (const [side, outerC, innerC, along, inner, , role, outD] of plan) {
      const decoC = flush ? outerC + outD : outerC;
      if (role === 'door') {
        const dc = inner[fdiv(inner.length - 1, 2)];
        this.door(dc, y0, innerC, outerC);
      } else if (role === 'window') {
        const nIn = inner.length;
        let w = nIn % 2 ? 1 : 2;
        if (nIn >= 7 && nIn % 2) w = 3;
        const start = inner[fdiv(nIn - w, 2)];
        const cols = range(start, start + w);
        const shutters = (nIn - w) >= 4;
        this.window(side, cols, y0, h, innerC, decoC, along, postSet, shutters);
      }
    }
    if (k > 0 && this.spec.jetty) {
      for (const x of xs) {
        S.set(x, y0 - 1, z0, B(this.woodStairs(), { facing: 'south', half: 'top', shape: 'straight', waterlogged: false }));
        S.set(x, y0 - 1, z1, B(this.woodStairs(), { facing: 'north', half: 'top', shape: 'straight', waterlogged: false }));
      }
    }
    return postSet;
  }
  woodStairs() {
    if (this.p.wood_stairs) return this.p.wood_stairs;
    const wood = this.p.post.replace('stripped_', '').replace('_log', '').replace('_stem', '');
    return wood + '_stairs';
  }
  static isPost(posts, along, c, outerC) { return posts.has(along === 'x' ? c + ',' + outerC : outerC + ',' + c); }
  xz(along, c, plane) { return along === 'x' ? [c, plane] : [plane, c]; }
  windowBlock(along) {
    if (this.spec.flush_walls) return B('glass');
    return B(this.p.window, { ...(along === 'x' ? { east: true, west: true, north: false, south: false } : { north: true, south: true, east: false, west: false }), waterlogged: false });
  }
  window(side, cols, y0, h, innerC, outerC, along, posts, shutters = true) {
    const S = this.S, p = this.p, pane = this.windowBlock(along);
    for (const c of cols) {
      for (let y = y0 + 2; y < y0 + h; y++) { const [x, z] = this.xz(along, c, innerC); S.set(x, y, z, pane); }
      const [x, z] = this.xz(along, c, outerC);
      S.set(x, y0 + 1, z, B(p.trapdoor, { facing: side, half: 'top', open: false, powered: false, waterlogged: false }));
    }
    for (const c of (shutters ? [cols[0] - 1, cols[cols.length - 1] + 1] : [])) {
      if (HouseBuilder.isPost(posts, along, c, outerC)) continue;
      for (let y = y0 + 2; y < y0 + h; y++) {
        const [x, z] = this.xz(along, c, outerC);
        if (S.get(x, y, z) !== undefined || this.cornerGaps.has(x + ',' + z)) continue;
        S.set(x, y, z, B(p.trapdoor, { facing: side, half: 'bottom', open: true, powered: false, waterlogged: false }));
      }
    }
  }
  door(x, y0, innerZ, outerZ) {
    const S = this.S, p = this.p;
    S.set(x, y0 + 1, innerZ, B(p.door, { facing: 'north', half: 'lower', hinge: 'left', open: false, powered: false }));
    S.set(x, y0 + 2, innerZ, B(p.door, { facing: 'north', half: 'upper', hinge: 'left', open: false, powered: false }));
    S.set(x, 0, outerZ - 1, B(this.baseStairs(), { facing: 'south', half: 'bottom', shape: 'straight', waterlogged: false }));
    this.doorX = x;
  }
  baseStairs() {
    if (this.p.base_stairs) return this.p.base_stairs;
    return { medieval_timber: 'cobblestone_stairs', taiga_cabin: 'cobbled_deepslate_stairs', oak_cottage: 'stone_brick_stairs' }[this.spec.palette] || 'cobblestone_stairs';
  }

  // ---- roof ----
  resolvePitch(span) {
    const pitch = this.spec.roof_pitch !== undefined ? this.spec.roof_pitch : 'auto';
    if (pitch !== 'auto') return pitch;
    if (span >= 17) return 'low';
    if (span <= 13) return 'steep';
    return 'normal';
  }
  static sym(rises, span) {
    const n = fdiv(span, 2), g = [0];
    for (const r of rises.slice(0, n)) g.push(g[g.length - 1] + r);
    const cols = range(0, n).map(i => [g[i], g[i + 1]]);
    if (span % 2) cols.push([g[n], g[n]]);
    const mir = cols.slice(0, n).reverse().map(([L, R]) => [R, L]);
    return cols.concat(mir);
  }
  static bands(n, parts) {
    const out = []; let used = 0;
    parts.forEach(([frac, rise], i) => {
      let k = i === parts.length - 1 ? n - used : Math.max(1, pyRound(n * frac));
      k = Math.min(k, n - used);
      for (let j = 0; j < k; j++) out.push(rise);
      used += k;
    });
    return out;
  }
  roofColumns(span, pitch, style, flare) {
    style = style || (this.spec.roof_style !== undefined ? this.spec.roof_style : 'gable');
    pitch = pitch || this.resolvePitch(span);
    const r = RISE[pitch], n = fdiv(span, 2);
    const meta = { cap: false, wall_cols: new Set() };
    const useFlare = (flare === undefined || flare === null) ? this.spec.flared_eave : flare;
    const flareCols = useFlare ? this.spec.roof_overhang + 1 : 0;
    const fl = rises => rises.map((x, i) => i < flareCols ? (FLARE[x] !== undefined ? FLARE[x] : x) : x);
    let cols;
    const rep = (v, k) => Array(Math.max(0, k)).fill(v);
    if (style === 'gable') {
      cols = HouseBuilder.sym(fl(rep(r, n)), span); meta.cap = true;
      if (r === 1 && span % 2) { const H = cols[n][0] + 1; cols[n] = [H, H]; }
    } else if (style === 'gambrel') { cols = HouseBuilder.sym(HouseBuilder.bands(n, [[0.5, 4], [0.5, 2]]), span); meta.cap = true; }
    else if (style === 'mansard') cols = HouseBuilder.sym(HouseBuilder.bands(n, [[0.25, 6], [0.15, 2], [0.6, 0]]), span);
    else if (style === 'curved') {
      const Hc = 2 * Math.max(2, pyRound(n * 0.85));
      const g = range(0, n + 1).map(i => pyRound(Hc * Math.sqrt(Math.max(0.0, 1 - Math.pow((n - i) / n, 2)))));
      cols = HouseBuilder.sym(range(0, n).map(i => g[i + 1] - g[i]), span);
    } else if (style === 'elven' || style === 'temple' || style === 'magical') {
      const parts = { elven: [[0.34, 1], [0.33, 2], [0.33, 4]], temple: [[0.5, 1], [0.5, 2]], magical: [[0.3, 1], [0.25, 2], [0.3, 4], [0.15, 8]] }[style];
      cols = HouseBuilder.sym(HouseBuilder.bands(n, parts), span); meta.cap = style !== 'magical';
    } else if (style === 'saltbox') {
      const k = Math.max(2, pyRound(span / 3)), m = span - k, H = m;
      const g = range(0, k + 1).map(i => pyRound(H * i / k));
      for (let j = 1; j <= m; j++) g.push(H - j);
      cols = range(0, span).map(i => [g[i], g[i + 1]]);
    } else if (style === 'mono') {
      const rr = pitch !== 'low' ? Math.max(1, fdiv(r, 2)) : 1;
      cols = range(0, span).map(i => [i * rr, (i + 1) * rr]);
      meta.thin = rr === 1;
    } else if (style === 'clerestory') {
      const k = Math.max(3, pyRound(span * 0.55));
      const low = range(0, k).map(i => [i, i + 1]);
      const top = k + 6, m = span - k;
      const high = range(0, m).map(j => [top - j, top - j - 1]);
      cols = low.concat(high); meta.wall_cols = new Set([k]);
    } else if (style === 'm_shaped') {
      const a = fdiv(span, 2);
      cols = HouseBuilder.sym(rep(r, fdiv(a, 2)), a).concat(HouseBuilder.sym(rep(r, fdiv(span - a, 2)), span - a));
      meta.cap = true;
    } else if (style === 'butterfly') {
      const n2 = fdiv(span, 2), st = Math.max(1, fdiv(r, 2)), H = n2 * st + 2;
      const g = range(0, n2 + 1).map(i => H - i * st);
      const half = range(0, n2).map(i => [g[i], g[i + 1]]);
      cols = half.concat(span % 2 ? [[g[n2], g[n2]]] : [], half.slice().reverse().map(([L, R]) => [R, L]));
    } else throw new Error(`未知屋顶样式 ${style}，可选：${JSON.stringify(Object.keys(ROOF_STYLES))}`);
    return [cols, meta];
  }
  // cells: array of Map(dy -> kind), insertion-ordered like the Python dicts
  rasterRoof(cols, meta) {
    const thin = !!meta.thin, top = [], extra = [];
    for (const [L, R] of cols) {
      const hi = Math.max(L, R), lo = Math.min(L, R), d = hi - lo, more = new Map();
      let ty, kind;
      if (d <= 1) {
        if (hi % 2 === 0) { ty = Math.max(fdiv(hi, 2) - 1, 0); kind = (thin && hi > 0) ? 'slab_top' : 'full'; }
        else { ty = fdiv(hi - 1, 2); kind = 'slab_bottom'; if (!thin && ty - 1 >= 0) more.set(ty - 1, 'slab_top'); }
      } else {
        const up = R > L ? 's' : 'n';
        if (hi % 2) { ty = fdiv(hi - 1, 2); kind = 'slab_bottom'; } else { ty = fdiv(hi, 2) - 1; kind = 'stair_' + up; }
      }
      top.push([ty, kind]); extra.push(more);
    }
    const out = [];
    cols.forEach(([L, R], c) => {
      const [ty, kind] = top[c];
      const cells = new Map([[ty, kind]]);
      for (const [k, v] of extra[c]) cells.set(k, v);
      const d = Math.abs(L - R);
      const nbIdx = [c - 1, c + 1].filter(j => j >= 0 && j < top.length), nb = nbIdx.map(j => top[j][0]);
      const minCells = () => Math.min(...cells.keys());
      let low;
      if (d <= 1 && !nbIdx.some(j => Math.abs(top[j][0] - ty) > 1)) low = minCells();
      else low = Math.min(minCells(), ...nb, ...(d >= 2 ? [Math.max(0, fdiv(Math.min(L, R), 2))] : []));
      const fill = meta.wall_cols.has(c) ? 'wall' : 'full';
      for (let y = low; y < ty; y++) if (!cells.has(y)) cells.set(y, fill);
      if (this.spec.underside_stairs && d >= 2 && low - 1 >= 0 && !meta.wall_cols.has(c)) cells.set(low - 1, 'ustair_' + (R > L ? 'n' : 's'));
      if (meta.cap && kind === 'full' && nb.length && nb.every(t => t < ty)) cells.set(ty + 1, 'slab_bottom');
      out.push(cells);
    });
    return out;
  }
  roofHeight(span, pitch) {
    const [cols] = this.roofColumns(span, pitch);
    return Math.max(...cols.map(([L, R]) => Math.max(L, R))) / 2 + (span % 2 ? 0.5 : 0);
  }
  gableRoof(rect, yb) {
    const S = this.S;
    const [x0, x1, z0, z1] = rect, ov = this.spec.roof_overhang;
    const X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov, span = Z1 - Z0 + 1;
    const pitch = this.resolvePitch(span); this.roofPitch = pitch;
    const [cols, meta] = this.roofColumns(span, pitch);
    const cells = this.rasterRoof(cols, meta);
    const face = { s: 'south', n: 'north' }, pane = this.windowBlock('x');
    const block = (kind, edge, x) => {
      if (kind.startsWith('stair_')) return B(this.m('roof_stairs'), { facing: face[kind.slice(-1)], half: 'bottom', shape: 'straight', waterlogged: false });
      if (kind.startsWith('ustair_')) {
        if (x === x0 || x === x1) return B(this.m('infill_upper'));
        if (x0 < x && x < x1) return B(this.m('roof_full'));
        return B(this.m('roof_stairs'), { facing: face[kind.slice(-1)], half: 'top', shape: 'straight', waterlogged: false });
      }
      if (kind === 'slab_bottom') return B(this.m('roof_slab'), { type: 'bottom', waterlogged: false });
      if (kind === 'slab_top') { if (x0 <= x && x <= x1) return B(this.m('roof_full')); return B(this.m('roof_slab'), { type: 'top', waterlogged: false }); }
      if (kind === 'wall') return (x0 < x && x < x1 && pmod(x - x0, 2) === 1) ? pane : B(this.m('infill_upper'));
      return B(this.m('roof_full'));
    };
    const bottomAt = {}; let topY = yb;
    cells.forEach((cc, c) => {
      const z = Z0 + c;
      bottomAt[z] = yb + Math.min(...cc.keys());
      for (let x = X0; x <= X1; x++) {
        const edge = x === X0 || x === X1;
        for (const [dy, kind] of cc) {
          if (kind === 'wall' && !(x0 <= x && x <= x1)) continue;
          S.set(x, yb + dy, z, block(kind, edge, x));
        }
      }
      topY = Math.max(topY, yb + Math.max(...cc.keys()));
    });
    let trim = this.spec.eave_trim !== undefined ? this.spec.eave_trim : 'auto';
    trim = trim === 'auto' ? (pitch === 'steep' && (this.spec.roof_style !== undefined ? this.spec.roof_style : 'gable') === 'gable') : truthy(trim);
    for (const [zz, out] of (trim ? [[Z0, 'north'], [Z1, 'south']] : [])) {
      if (bottomAt[zz] === yb) for (let x = X0; x <= X1; x++) S.set(x, yb - 1, zz, B(this.m('roof_stairs'), { facing: out, half: 'top', shape: 'straight', waterlogged: false }));
    }
    for (const zw of [z0, z1]) for (let x = x0; x <= x1; x++) for (let y = yb; y < bottomAt[zw]; y++) S.set(x, y, zw, B(this.m('infill_upper')));
    const zc = fdiv(Z0 + Z1, 2), gpane = this.windowBlock('z');
    for (const gx of [x0, x1]) {
      for (let z = z0; z <= z1; z++) for (let y = yb; y < bottomAt[z]; y++) S.set(gx, y, z, B(this.m('infill_upper')));
      for (let y = yb; y < bottomAt[zc]; y++) S.set(gx, y, zc, this.log('post', 'y'));
      for (const [wy, offs] of [[yb + 2, [-2, 2]], [yb + 5, [-1, 1]], [yb + 8, [-1, 1]]]) {
        for (const o of offs) {
          const z = zc + o, out = z + (o > 0 ? 1 : -1);
          if (z0 < z && z < z1 && wy <= bottomAt[z] - 2 && wy <= bottomAt[out] - 1) S.set(gx, wy, z, gpane);
        }
      }
    }
    topY = Math.max(topY, this.dormers(rect, yb, Z0, Z1, cells));
    return [[X0, X1, Z0, Z1], topY];
  }
  dormerProfile(key) {
    const [style, pitch, wall] = DORMER_STYLES[key], span = wall + 2;
    const [cols, meta] = this.roofColumns(span, pitch, style, false);
    return [wall, span, this.rasterRoof(cols, meta)];
  }
  dormers(rect, yb, Z0, Z1, cells) {
    const want = this.spec.dormers !== undefined ? this.spec.dormers : 'auto';
    if (!truthy(want)) return yb;
    const [x0, x1, z0, z1] = rect;
    const surf = new Map(); cells.forEach((cc, c) => surf.set(Z0 + c, yb + Math.max(...cc.keys())));
    const chimneyX = truthy(this.spec.chimney) ? x0 + 2 : null;
    let key = this.spec.dormer_style !== undefined ? this.spec.dormer_style : 'auto';
    if (key === 'auto') key = this.rngDormers.choice(['gable', 'gable', 'steep', 'low', 'curved', 'mono', 'temple']);
    const [wall, span, dcells] = this.dormerProfile(key);
    const top = Math.max(...dcells.map(c => Math.max(...c.keys()))), wallH = 2;
    const plan = side => {
      const d = side === 'north' ? 1 : -1;
      const zs = d === 1 ? range(z0, z1 + 1) : range(z1, z0 - 1, -1);
      for (const zf of zs) {
        const ys = surf.get(zf);
        if (ys - yb < 1) continue;
        const cap = ys + wallH + top;
        let z = zf, n = 0;
        while (surf.has(z) && surf.get(z) < cap) { z += d; n += 1; }
        if (!surf.has(z) || n > 7 || n < 2) continue;
        return [d, zf, ys, z];
      }
      return null;
    };
    const half = fdiv(span, 2);
    const avoid = this.spec.dormer_avoid || [];
    for (const side of ['north', 'south']) {
      const pl = plan(side);
      if (!pl) continue;
      const [d, zf, ys, zend] = pl;
      let n;
      if (want === 'auto') n = this.rngDormers.choice(side === 'north' ? [0, 1, 1, 2] : [0, 0, 1]);
      else n = side === 'north' ? Math.trunc(Number(want)) : 0;
      const gap = this.spec.dormer_gap !== undefined ? this.spec.dormer_gap : 'auto';
      const usable = (x1 - 1) - (x0 + 1) + 1;
      const g = gap === 'auto' ? 1 : Math.max(0, Math.trunc(Number(gap)));
      n = Math.min(n, fdiv(usable + g, span + g));
      if (n <= 0) continue;
      const centers = [];
      if (gap === 'auto') {
        for (let i = 0; i < n; i++) {
          let cx = x0 + pyRound((i + 1) * (x1 - x0) / (n + 1)) + this.rngDormers.choice([-1, 0, 0, 1]);
          cx = Math.min(Math.max(cx, x0 + half + 1), x1 - half - 1);
          if (chimneyX !== null && Math.abs(cx - chimneyX) <= half) continue;
          if (avoid.some(([a, b]) => a <= cx + half && cx - half <= b)) continue;
          if (centers.every(o => Math.abs(cx - o) >= span + 1)) centers.push(cx);
        }
      } else {
        const total = n * span + (n - 1) * g, start = x0 + 1 + fdiv(usable - total, 2) + half;
        for (let i = 0; i < n; i++) {
          const cx = start + i * (span + g);
          if (chimneyX !== null && Math.abs(cx - chimneyX) <= half) continue;
          if (avoid.some(([a, b]) => a <= cx + half && cx - half <= b)) continue;
          centers.push(cx);
        }
      }
      for (const cx of centers) this.dormer(cx, d, zf, ys, zend, surf, wall, span, dcells, wallH);
    }
    return yb;
  }
  dormer(cx, d, zf, ys, zend, surf, wall, span, dcells, wallH) {
    const S = this.S, p = this.p, out = d === 1 ? 'north' : 'south', t = ys + wallH;
    const half = fdiv(span, 2), wh = fdiv(wall, 2);
    const xs = range(0, span).map(c => cx - half + c);
    const wallX = range(cx - wh, cx + wh + 1), sideX = [cx - wh, cx + wh];
    const glass = this.windowBlock('x'), post = this.log('post', 'y');
    const bottom = {}; xs.forEach((x, c) => { bottom[x] = t + Math.min(...dcells[c].keys()); });
    const roofBlock = kind => {
      const face = { s: 'east', n: 'west' };
      if (kind.startsWith('stair_')) return B(this.m('roof_stairs'), { facing: face[kind.slice(-1)], half: 'bottom', shape: 'straight', waterlogged: false });
      if (kind.startsWith('ustair_')) return B(this.m('roof_stairs'), { facing: face[kind.slice(-1)], half: 'top', shape: 'straight', waterlogged: false });
      if (kind === 'slab_bottom') return B(this.m('roof_slab'), { type: 'bottom', waterlogged: false });
      if (kind === 'slab_top') return B(this.m('roof_slab'), { type: 'top', waterlogged: false });
      return B(this.m('roof_full'));
    };
    for (const z of range(zf + d, zend, d)) for (const x of wallX) for (let y = ys; y < bottom[x]; y++) {
      if (sideX.includes(x)) S.set(x, y, z, B(this.m('infill_upper'))); else S.del(x, y, z);
    }
    for (const z of range(zf - d, zend, d)) {
      xs.forEach((x, c) => {
        const cc = dcells[c];
        const keys = z === zf - d ? [Math.max(...cc.keys())] : [...cc.keys()];
        for (const dy of keys) { const y = t + dy; if (y >= surf.get(z)) S.set(x, y, z, roofBlock(cc.get(dy))); }
      });
    }
    for (const x of wallX) for (let y = ys; y < bottom[x]; y++) S.set(x, y, zf, sideX.includes(x) ? post : glass);
    if (wall >= 5) for (let y = ys; y < bottom[cx]; y++) S.set(cx, y, zf, post);
    for (const x of wallX) if (!sideX.includes(x) && (wall < 5 || x !== cx))
      S.set(x, ys, zf - d, B(p.trapdoor, { facing: out, half: 'bottom', open: false, powered: false, waterlogged: false }));
  }
  chimney(rect, roofRect, ridgeY) {
    const [x0, , z0, z1] = rect, cx = x0 + 2, cz = fdiv(z0 + z1, 2) + 2;
    for (let y = 1; y < ridgeY + 3; y++) this.S.set(cx, y, cz, B(this.m('chimney')));
    this.S.set(cx, ridgeY + 3, cz, B('campfire', { facing: 'north', lit: true, signal_fire: false, waterlogged: false }));
  }
  ground(rect) {
    const [x0, x1, z0, z1] = rect, pad = 3;
    for (let x = x0 - pad; x <= x1 + pad; x++) for (let z = z0 - pad - 1; z <= z1 + pad; z++) this.S.set(x, -1, z, B(this.m('ground')));
    this.resolveMaterials();
    const dx = this.doorX !== undefined ? this.doorX : fdiv(x0 + x1, 2);
    for (let z = z0 - pad - 1; z < z0 - 1; z++) this.S.set(dx, -1, z, B(this.p.path));
    const plants = ['short_grass', 'short_grass', 'short_grass', 'poppy', 'dandelion', 'cornflower', 'fern'];
    for (const [x, y, z, st] of sortedBlocks(this.S)) {
      if (y !== -1 || !st.includes('grass_block')) continue;
      if (x0 - 1 <= x && x <= x1 + 1 && z0 - 2 <= z && z <= z1 + 1) continue;
      if (this.rngPlants.random() < 0.18 && this.S.get(x, 0, z) === undefined) this.S.set(x, 0, z, B(this.rngPlants.choice(plants)));
    }
    if (this.spec.floors > 1 && this.spec.jetty) this.S.set(dx, this.spec.floor_height - 1, z0 - 1, B('lantern', { hanging: true, waterlogged: false }));
  }
  build() {
    const s = this.spec, W = s.width, D = s.depth, F = s.floors, h = s.floor_height;
    const groundRect = [0, W - 1, 0, D - 1];
    this.foundation(groundRect);
    let rect = groundRect;
    for (let k = 0; k < F; k++) {
      const j = s.jetty ? k : 0;
      rect = [0, W - 1, -j, D - 1 + j];
      this.storey(k, rect, k * h, h, k === 0 ? 'infill_ground' : 'infill_upper', k === 0 && (s.front_door !== undefined ? truthy(s.front_door) : true));
    }
    const topY = F * h;
    const [roofRect, ridgeY] = this.gableRoof(rect, topY + 1);
    if (truthy(s.chimney)) this.chimney(rect, roofRect, ridgeY);
    if (truthy(s.ground)) this.ground(groundRect);
    this.resolveMaterials();
    return this.S;
  }
}
// sorted(S.blocks.items()) -> [[x, y, z, state], ...]
function sortedBlocks(S) {
  const arr = []; for (const [k, st] of S.blocks) { const [x, y, z] = unkey(k); arr.push([x, y, z, st]); }
  arr.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return arr;
}
const NOISE_GROUP = { roof_stairs: 'roof', roof_full: 'roof', roof_slab: 'roof' };
const NOISE_SCALE = { roof: 3, ground: 3, base: 2, infill_ground: 2, infill_upper: 2, chimney: 1 };
const WINDOW_P = { north: 0.7, south: 0.45, west: 0.35, east: 0.35 };
const RISE = { low: 1, normal: 2, steep: 4 };
const FLARE = { 4: 2, 2: 1 };
const ROOF_STYLES = {
  gable: '双坡（按 roof_pitch：缓坡台阶 / 标准楼梯 / 陡坡方块+楼梯）', gambrel: '复折 / 谷仓顶：下段陡、上段缓', mansard: '孟莎顶：四周近乎竖直，顶部平',
  curved: '拱顶：圆弧剖面', saltbox: '盐盒顶：不对称，一侧短陡、一侧长缓', mono: '单坡顶：附属建筑、披屋', clerestory: '高侧窗顶：两段单坡错开，中间一段带窗的竖墙',
  m_shaped: 'M 形双峰顶', butterfly: '蝴蝶顶：中间低、两侧高', elven: '精灵顶：檐口缓、越往上越陡（内凹）', temple: '神庙顶：缓坡加陡顶（内凹，较矮）', magical: '魔法顶：内凹，顶部收成尖塔',
};
const DORMER_STYLES = { gable: ['gable', 'normal', 3], steep: ['gable', 'steep', 3], low: ['gable', 'low', 5], curved: ['curved', 'normal', 5], mono: ['mono', 'normal', 3], temple: ['temple', 'normal', 5] };

// ---- stair shapes (post-processing) ----
const _STEP = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const _OPP = { north: 'south', south: 'north', west: 'east', east: 'west' };
const _CCW = { north: 'west', west: 'south', south: 'east', east: 'north' };
const STAIR_RE = /^(minecraft:[a-z_]+_stairs)\[(.*)\]$/;
function parseStair(st) {
  const m = st && STAIR_RE.exec(st);
  if (!m) return null;
  const o = {}; for (const kv of m[2].split(',')) { const [k, v] = kv.split('='); o[k] = v; }
  return o;
}
const WOODS_ = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak'];
function fullOfStairs(name) {
  const b = name.slice('minecraft:'.length, -'_stairs'.length);
  if (WOODS_.includes(b)) return `minecraft:${b}_planks`;
  const id = name.slice('minecraft:'.length);
  for (const o of OPTIONS.roof) if (o.roles.roof_stairs === id) return 'minecraft:' + o.roles.roof_full;
  for (const [a, f] of [['_brick', '_bricks'], ['_tile', '_tiles']]) if (b.endsWith(a)) return `minecraft:${b.slice(0, -a.length)}${f}`;
  return { brick: 'minecraft:bricks', quartz: 'minecraft:quartz_block', purpur: 'minecraft:purpur_block' }[b] || 'minecraft:' + b;
}
function buryCoveredStairs(S) {
  for (const [k, st] of [...S.blocks]) {
    const p = parseStair(st);
    if (!p || p.half !== 'bottom') continue;
    const [x, y, z] = unkey(k);
    const above = S.blocks.get(key3(x, y + 1, z)) || '';
    const ab = parseStair(above);
    const solid = (ab !== null && ab.half === 'bottom') || (above && !above.includes('[') && !above.includes('air') && !above.includes('glass') && !above.includes('leaves'))
      || above.includes('type=bottom') || above.includes('type=double');
    if (solid) S.blocks.set(k, fullOfStairs(st.split('[')[0]));
  }
}
const solidFull = st => !!st && !st.includes('[') && !st.includes('air') && !st.includes('glass') && !st.includes('leaves');
function mergeRidgeEnds(S) {
  const info = new Map();
  for (const [k, st] of S.blocks) { const p = parseStair(st); if (p) info.set(k, p); }
  const done = new Set();
  const ok = (q, f, bx, bz) => {
    const o = info.get(key3(...q));
    return o !== undefined && o.facing === f && o.half === 'bottom' && (o.shape || 'straight') === 'straight' && solidFull(S.blocks.get(key3(q[0] + bx, q[1], q[2] + bz)));
  };
  for (const [k, p] of info) {
    if (done.has(k)) continue;
    const pos = unkey(k), f = p.facing, [bx, bz] = _STEP[_OPP[f]];
    if (!ok(pos, f, bx, bz)) continue;
    const [d1, d2] = Object.keys(_STEP).filter(d => d !== f && d !== _OPP[f]);
    const run = [pos], ends = new Map();
    for (const d of [d1, d2]) {
      const [dx, dz] = _STEP[d];
      let q = [pos[0] + dx, pos[1], pos[2] + dz];
      while (ok(q, f, bx, bz) && run.length < 7) { run.push(q); q = [q[0] + dx, q[1], q[2] + dz]; }
      ends.set(d, q);
    }
    for (const q of run) done.add(key3(...q));
    let valley = 0;
    for (const [d, q] of ends) {
      const o = info.get(key3(...q)), bk = info.get(key3(q[0] + bx, q[1], q[2] + bz));
      if (o && o.facing === f && o.half === 'bottom' && bk && bk.half === 'bottom' && bk.facing === _OPP[d]) valley++;
    }
    if (valley === 2) for (const q of run) { const kk = key3(...q); S.blocks.set(kk, fullOfStairs(S.blocks.get(kk).split('[')[0])); }
  }
}
function stairShapes(S) {
  const info = new Map();
  for (const [k, st] of S.blocks) { const p = parseStair(st); if (p) info.set(k, p); }
  const at = (pos, d) => { const [dx, dz] = _STEP[d]; return info.get(key3(pos[0] + dx, pos[1], pos[2] + dz)); };
  const canTake = (pos, p, d) => { const o = at(pos, d); return o === undefined || o.facing !== p.facing || o.half !== p.half; };
  for (const [k, p] of info) {
    const pos = unkey(k), f = p.facing; let shape = 'straight';
    const front = at(pos, f);
    if (front && front.half === p.half && !(front.facing === f || front.facing === _OPP[f]) && canTake(pos, p, _OPP[front.facing]))
      shape = front.facing === _CCW[f] ? 'outer_left' : 'outer_right';
    else {
      const back = at(pos, _OPP[f]);
      if (back && back.half === p.half && !(back.facing === f || back.facing === _OPP[f]) && canTake(pos, p, back.facing))
        shape = back.facing === _CCW[f] ? 'inner_left' : 'inner_right';
    }
    if ((p.shape || 'straight') !== shape) {
      const p2 = { ...p, shape }, name = S.blocks.get(k).split('[')[0];
      S.blocks.set(k, name + '[' + Object.keys(p2).sort().map(kk => kk + '=' + p2[kk]).join(',') + ']');
    }
  }
}
const _SIDES = { north: [[1, 0], [-1, 0]], south: [[1, 0], [-1, 0]], east: [[0, 1], [0, -1]], west: [[0, 1], [0, -1]] };
// the filler copies the wall it patches (plaster, timber frame, brick, stone base...): the first
// neighbour that is a plain wall block; the house's base stone only when none is found
const _SEAL_SKIP = /_door|glass|_pane|_bars|_stairs|_slab|trapdoor|fence|lantern|torch|leaves|_carpet|_sign|flower|_wall\b|_wall\[/;
function wallLike(S, cands) { for (const [x, y, z] of cands) { const st = S.get(x, y, z); if (st && !_SEAL_SKIP.test(st)) return st; } return null; }
function sealDoors(S, hb) {
  const stone = hb.p.base, base = (x, y, z) => 'minecraft:' + pickU(patchNoise(x, y, z, hb.seeds.materials, 'base', 2), stone);
  let cx = 0, cz = 0, cn = 0;
  for (const k of S.blocks.keys()) { const [x, y, z] = unkey(k); if (y >= 1) { cx += x; cz += z; cn++; } }
  for (const [k, st] of [...S.blocks]) {
    if (!st.includes('_door[') || !st.includes('half=lower')) continue;
    const [x, y, z] = unkey(k), facing = /facing=(\w+)/.exec(st)[1];
    // outward = away from the house centre along the door's axis. A side cell whose inward neighbour is
    // wall and outward one is open lies outside the stepped wall: filling it sticks out as a post, skip it.
    // Every other empty side cell (wall in front of it, or open on both sides) is a slot into the house.
    const ax = facing === 'north' || facing === 'south' ? 1 : 0;
    const out = ax ? Math.sign(z * cn - cz) : Math.sign(x * cn - cx), [fx, fz] = ax ? [0, out] : [out, 0];
    for (const [dx, dz] of _SIDES[facing]) for (const yy of [y, y + 1]) {
      if (out && S.has(x + dx - fx, yy, z + dz - fz) && !S.has(x + dx + fx, yy, z + dz + fz)) continue;
      const sx = x + dx, sz = z + dz;
      if (!S.has(sx, yy, sz)) S.blocks.set(key3(sx, yy, sz), wallLike(S, [[sx + fx, yy, sz + fz], [sx - fx, yy, sz - fz], [sx + dx, yy, sz + dz], [sx + dx + fx, yy, sz + dz + fz], [sx + dx - fx, yy, sz + dz - fz]]) || base(sx, yy, sz));
    }
    if (!S.has(x, y + 2, z)) S.blocks.set(key3(x, y + 2, z), wallLike(S, [..._SIDES[facing].map(([dx, dz]) => [x + dx, y + 2, z + dz]), [x, y + 3, z]]) || base(x, y + 2, z));
  }
}
function buildHouse(spec) {
  const S = _buildHouse(spec);
  buryCoveredStairs(S); mergeRidgeEnds(S); stairShapes(S);
  applyWindowMaterial(S, spec);
  return S;
}

// ---- window material (窗户材料): swap the finished window cells for another block ----------------
// The builder always makes windows from glass panes (glass blocks on angled houses), and all the merge /
// door / colour rules recognise windows by that. So the swap happens last, on the finished structure.
const WINDOW_MATERIALS = {
  pane: '玻璃板', glass: '玻璃块', bars: '铁栏杆', fence: '栅栏', trapdoor: '活板门（竖起）', open: '空窗洞（不放任何方块）', wall: '不开窗（补成墙面）',
};
const WINDOW_COLORS = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'];
const COLOR_CN = { white: '白', light_gray: '浅灰', gray: '灰', black: '黑', brown: '棕', red: '红', orange: '橙', yellow: '黄', lime: '黄绿', green: '绿', cyan: '青', light_blue: '淡蓝', blue: '蓝', purple: '紫', magenta: '品红', pink: '粉' };
const WOODS_CN = { auto: '跟随房屋木构', oak: '橡木', spruce: '云杉', birch: '白桦', jungle: '丛林', acacia: '金合欢', dark_oak: '深色橡木', mangrove: '红树', cherry: '樱花', bamboo: '竹', crimson: '绯红', warped: '诡异' };
// each material has its own variant list (颜色 / 木材 / ...); the first entry is the default
const WINDOW_VARIANTS = {
  pane: { label: '颜色', options: { clear: '无色', mix: '多色', ...COLOR_CN } },
  glass: { label: '颜色', options: { clear: '无色', tinted: '遮光玻璃', mix: '多色', ...COLOR_CN } },
  bars: { label: '样式', options: { iron: '铁' } },
  fence: { label: '材质', options: { ...WOODS_CN, nether_brick: '下界砖' } },
  trapdoor: { label: '材质', options: { ...WOODS_CN, iron: '铁' } },
  open: { label: '', options: { none: '—' } },
  wall: { label: '材质', options: { auto: '跟随旁边墙面' } },
};
// older specs: stained / stained_block / tinted were separate materials
function windowChoice(spec) {
  let mat = (spec && spec.window_material) || 'pane', v = spec && (spec.window_variant ?? spec.window_color);
  if (mat === 'stained') { mat = 'pane'; v = v || 'mix'; }
  else if (mat === 'stained_block') { mat = 'glass'; v = v || 'mix'; }
  else if (mat === 'tinted') { mat = 'glass'; v = 'tinted'; }
  if (!WINDOW_MATERIALS[mat]) mat = 'pane';
  const opts = WINDOW_VARIANTS[mat].options;
  if (!(v in opts)) v = Object.keys(opts)[0];
  return [mat, v];
}
function applyWindowMaterial(S, spec) {
  const [mat, variant] = windowChoice(spec);
  if (mat === 'pane' && variant === 'clear') return 0;
  const seed = (spec && spec.seed) || 1, colorOpt = variant;
  const isWin = st => { const n = st.split('[')[0]; return n === 'minecraft:glass_pane' || n === 'minecraft:glass'; };
  const cells = []; for (const [k, st] of S.blocks) if (isWin(st)) cells.push(k);
  if (!cells.length) return 0;
  // wood: the same as the house's trapdoors (sills / shutters), so fences and trapdoors match the frame
  let wood = 'spruce';
  for (const st of S.blocks.values()) { const m = /^minecraft:(\w+?)_trapdoor\[/.exec(st); if (m && m[1] !== 'iron') { wood = m[1]; break; } }
  if ((mat === 'fence' || mat === 'trapdoor') && variant !== 'auto') wood = variant;
  const solid = st => !!st && !isWin(st) && !st.includes('[') && !/air|leaves|glass/.test(st);
  const winSet = new Set(cells);
  // wall orientation of a window cell: 'x' = the wall runs along x
  const axisOf = (x, y, z, st) => {
    if (st.includes('east=true') || st.includes('west=true')) return 'x';
    if (st.includes('north=true') || st.includes('south=true')) return 'z';
    const sx = [1, -1].filter(d => { const k = key3(x + d, y, z); return winSet.has(k) || solid(S.blocks.get(k)); }).length;
    const sz = [1, -1].filter(d => { const k = key3(x, y, z + d); return winSet.has(k) || solid(S.blocks.get(k)); }).length;
    return sx >= sz ? 'x' : 'z';
  };
  const colorAt = (x, y, z) => colorOpt === 'clear' || colorOpt === 'tinted' ? 'white' : colorOpt === 'mix' ? WINDOW_COLORS[Math.floor(_h(seed, 'wincol', x, Math.floor(y / 2), z) * WINDOW_COLORS.length)] : (WINDOW_COLORS.includes(colorOpt) ? colorOpt : 'white');
  const out = new Map();
  for (const k of cells) {
    const st = S.blocks.get(k), [x, y, z] = unkey(k), ax = axisOf(x, y, z, st);
    let nb;
    const col = colorAt(x, y, z);
    if (mat === 'glass') nb = variant === 'clear' ? B('glass') : variant === 'tinted' ? B('tinted_glass') : B(`${col}_stained_glass`);
    else if (mat === 'pane') nb = B(variant === 'clear' ? 'glass_pane' : `${col}_stained_glass_pane`, { east: false, north: false, south: false, waterlogged: false, west: false });
    else if (mat === 'bars') nb = B('iron_bars', { east: false, north: false, south: false, waterlogged: false, west: false });
    else if (mat === 'fence') nb = B(`${wood}_fence`, { east: false, north: false, south: false, waterlogged: false, west: false });
    else if (mat === 'trapdoor') nb = B(`${wood}_trapdoor`, { facing: ax === 'x' ? 'south' : 'east', half: 'bottom', open: true, powered: false, waterlogged: false });
    else if (mat === 'open') nb = null;
    else {                                            // wall: copy the nearest plain wall block along the wall, else above / below
      const steps = ax === 'x' ? [[1, 0, 0], [-1, 0, 0]] : [[0, 0, 1], [0, 0, -1]];
      for (let d = 1; d <= 4 && !nb; d++) for (const [dx, dy, dz] of [...steps, [0, 1, 0], [0, -1, 0]]) {
        const c = S.blocks.get(key3(x + dx * d, y + dy * d, z + dz * d)); if (solid(c)) { nb = c; break; }
      }
      nb = nb || B('stone_bricks');
    }
    out.set(k, nb);
  }
  for (const [k, nb] of out) { if (nb) S.blocks.set(k, nb); else S.blocks.delete(k); }
  if (['pane', 'bars', 'fence'].includes(mat)) fixConnections(S);
  return cells.length;
}
function _buildHouse(spec) {
  let s = { ...DEFAULT_SPEC, ...spec };
  if (!s._direct && ((s.plan !== undefined ? s.plan : 'rect') !== 'rect' || truthy(s.annexes))) return buildLayout(s);
  const angle = s.rotation || 0;
  if (angle) { const [w, d] = localFootprint(s.width, s.depth, angle); s = { ...s, width: w, depth: d, flush_walls: true }; }
  const hb = new HouseBuilder(s);
  const S = rotate(hb.build(), angle);
  if (angle) sealDoors(S, hb);
  return S;
}
