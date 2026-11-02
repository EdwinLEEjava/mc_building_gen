// ---------------------------------------------------------------------------------------------
// proportions.py + generate.py + api
// ---------------------------------------------------------------------------------------------
const STYLE_RULES = {
  medieval_timber: { roof_ratio: [0.45, 1.00, 0.80], gable_ratio: [0.80, 1.80, 1.30], plan_ratio: [1.0, 2.2] },
  taiga_cabin: { roof_ratio: [0.50, 1.30, 0.95], gable_ratio: [0.75, 1.60, 1.15], plan_ratio: [1.0, 2.0] },
  oak_cottage: { roof_ratio: [0.35, 1.05, 0.70], gable_ratio: [0.70, 1.50, 1.05], plan_ratio: [1.0, 2.4] },
};
const DEFAULT_RULES = { roof_ratio: [0.40, 1.20, 0.85], gable_ratio: [0.75, 1.70, 1.20], plan_ratio: [1.0, 2.2] };
const ROOF_STYLE_BAND = {
  gambrel: [0.60, 1.70, 1.20], mansard: [0.40, 1.20, 0.80], curved: [0.40, 1.30, 0.80], elven: [0.60, 1.80, 1.20], magical: [0.60, 2.00, 1.30],
  temple: [0.40, 1.20, 0.80], mono: [0.15, 1.10, 0.60], butterfly: [0.20, 0.90, 0.50], clerestory: [0.30, 1.10, 0.70], m_shaped: [0.25, 0.90, 0.50],
};
const PITCHLESS = new Set(['gambrel', 'mansard', 'curved', 'elven', 'temple', 'magical', 'clerestory']);
const COST = { pitch: 5.0, floors: 2.0, floor_height: 1.0, flare: 1.0, jetty: 1.5 };
const PITCHES = ['low', 'normal', 'steep'];
const PITCH_LABEL = { low: '缓坡（台阶）', normal: '标准坡（楼梯）', steep: '陡坡（方块+楼梯）' };
// str(float) for numbers that come from the rule tables (Python prints 1.0 / 0.45 / 1.9)
const pyFloatStr = x => Number.isInteger(x) ? x.toFixed(1) : String(x);

function measure(spec) {
  let s = { ...DEFAULT_SPEC, ...spec }, k = 1.0;
  if (s.rotation) {
    const [w, d] = localFootprint(s.width, s.depth, s.rotation);
    s = { ...s, width: w, depth: d };
    k = stretch(spec.rotation);
  }
  const hb = new HouseBuilder(s);
  const jet = s.jetty ? s.floors - 1 : 0;
  const span = s.depth + 2 * jet + 2 * s.roof_overhang;
  const pitch = s.roof_pitch !== 'auto' ? s.roof_pitch : hb.resolvePitch(span);
  const roofH = hb.roofHeight(span, pitch), wallH = s.floors * s.floor_height + 1;
  return {
    pitch, span, wall_h: wallH, roof_h: roofH, roof_ratio: roofH / wallH, gable_ratio: (wallH + roofH) / (span / k),
    plan_ratio: (spec.width !== undefined ? spec.width : s.width) / (spec.depth !== undefined ? spec.depth : s.depth),
  };
}
function violation(m, rules) {
  let v = 0.0;
  for (const k of ['roof_ratio', 'gable_ratio']) { const [lo, hi] = rules[k]; v += Math.max(0.0, lo - m[k]) + Math.max(0.0, m[k] - hi); }
  return v;
}
function solve(spec) {
  const s = { ...DEFAULT_SPEC, ...spec };
  const rules = { ...(STYLE_RULES[s.palette] || DEFAULT_RULES) };
  const style = s.roof_style !== undefined ? s.roof_style : 'gable';
  if (style in ROOF_STYLE_BAND) {
    rules.roof_ratio = ROOF_STYLE_BAND[style];
    rules.gable_ratio = [rules.gable_ratio[0], Math.max(rules.gable_ratio[1], 1.9), rules.gable_ratio[2]];
  }
  const report = [];
  const [, hi] = rules.plan_ratio;
  if (s.depth > s.width) { [s.width, s.depth] = [s.depth, s.width]; report.push(`平面：进深大于面宽，已对调，使屋脊沿长边（${s.width}×${s.depth}）`); }
  if (s.width / s.depth > hi) {
    const nw = Math.trunc(s.depth * hi);
    report.push(`平面：长宽比 ${fmt(s.width / s.depth)} 过于狭长，面宽 ${s.width} → ${nw}`);
    s.width = nw;
  }
  const req = { ...s };
  let reqPitch = s.roof_pitch, pitchOpts;
  if (PITCHLESS.has(style)) { reqPitch = s.roof_pitch = 'normal'; pitchOpts = ['normal']; }
  else pitchOpts = reqPitch === 'auto' ? PITCHES : [reqPitch, ...PITCHES.filter(p => p !== reqPitch)];
  const uniqSorted = a => [...new Set(a)].sort((x, y) => x - y);
  const floorsOpts = uniqSorted([0, 1, -1, 2].map(d => Math.max(1, Math.min(3, s.floors + d))));
  const fhOpts = uniqSorted([s.floor_height, 4, 5]);
  const flareOpts = [s.flared_eave, !s.flared_eave], jettyOpts = [s.jetty, !s.jetty];
  let best = null;
  for (const pitch of pitchOpts) for (const floors of floorsOpts) for (const fh of fhOpts) for (const flare of flareOpts) for (const jetty of jettyOpts) {
    const cand = { ...s, roof_pitch: pitch, floors, floor_height: fh, flared_eave: flare, jetty };
    const m = measure(cand);
    if (flare && (m.pitch === 'low' || style !== 'gable')) continue;
    let cost = 0.0;
    if (reqPitch !== 'auto' && pitch !== reqPitch) cost += COST.pitch * Math.abs(PITCHES.indexOf(pitch) - PITCHES.indexOf(reqPitch));
    cost += COST.floors * Math.abs(floors - req.floors);
    cost += COST.floor_height * Math.abs(fh - req.floor_height);
    cost += COST.flare * (flare !== req.flared_eave ? 1 : 0);
    cost += COST.jetty * ((jetty !== req.jetty) ? 1 : 0) * (floors > 1 ? 1 : 0);
    for (const [k, w] of [['roof_ratio', 4.0], ['gable_ratio', 2.0]]) cost += w * Math.abs(m[k] - rules[k][2]);
    const v = violation(m, rules), key = [v > 1e-9, v, cost];
    if (best === null || cmp(key, best[0]) < 0) best = [key, cand, m];
  }
  const [[, viol], out, m] = best;
  const m0 = measure(req);
  if (reqPitch === 'auto') { report.push(`屋顶：自动选择 ${PITCH_LABEL[m.pitch]}`); out.roof_pitch = m.pitch; }
  else if (out.roof_pitch !== reqPitch) report.push(`屋顶：${PITCH_LABEL[reqPitch]} 在这个体量下比例失调，改为 ${PITCH_LABEL[out.roof_pitch]}`);
  if (out.floors !== req.floors) report.push(`房体：层数 ${req.floors} → ${out.floors}（让房体配得上屋顶）`);
  if (out.floor_height !== req.floor_height) report.push(`房体：层高 ${req.floor_height} → ${out.floor_height}`);
  if (out.jetty !== req.jetty && out.floors > 1) report.push('房体：' + (!out.jetty ? '取消上层出挑，收窄山墙跨度' : '加上层出挑'));
  if (out.flared_eave !== req.flared_eave) report.push('屋顶：' + (out.flared_eave ? '加飞檐，压低屋顶高度' : '去掉飞檐'));
  if (report.length || viol) report.push(
    `比例：屋顶/房体 ${fmt(m0.roof_ratio, 2)} → ${fmt(m.roof_ratio, 2)}（合理 ${pyFloatStr(rules.roof_ratio[0])}–${pyFloatStr(rules.roof_ratio[1])}），`
    + `山墙高/宽 ${fmt(m0.gable_ratio, 2)} → ${fmt(m.gable_ratio, 2)}（合理 ${pyFloatStr(rules.gable_ratio[0])}–${pyFloatStr(rules.gable_ratio[1])}）`);
  const ang = out.rotation || 0;
  if (ang) {
    const [p_, , label] = templateFor(ang), [w, d] = localFootprint(out.width, out.depth, ang);
    report.push(`斜向 ${ang}°：长边${label}；按 ${w}×${d} 搭建后斜放，真实尺寸约 ${out.width}×${out.depth}，长边取 ${p_} 的整数倍，墙角落在完整台阶上`);
  }
  if (viol) report.push('警告：找不到完全满足比例的方案，已取最接近的一种');
  return [out, report, m];
}

// generate.py: spec -> structure + report
function generate(spec, raw = false) {
  let report = [];
  const req = spec;
  if (!raw) [spec, report] = solve(spec);
  const S = buildHouse(spec);
  let ramps = {};
  if (truthy(spec.colors)) {
    const [pal, rep] = applyColors(PALETTES[spec.palette !== undefined ? spec.palette : 'medieval_timber'], spec.colors);
    report = report.concat(rep); ramps = pal._ramps || {};
  }
  const lay = S.layout;
  if (lay) {
    report.push(`户型：${PLAN_LABEL[lay.plan]}` + (spec.plan === 'auto' ? '（由种子选出）' : ''));
    if (lay.annexes !== undefined && lay.annexes !== null) {
      const func = FUNCTION_LABEL[lay.function] || lay.function;
      const ann = lay.annexes.map(a => ANNEX_LABEL[a]).join('、') || '无';
      report.push(`功能：${func}；附属建筑：${ann}`);
    }
  }
  { const [wm, wv] = windowChoice(spec);
    if (!(wm === 'pane' && wv === 'clear')) {
      const vl = WINDOW_VARIANTS[wm].options[wv];
      report.push(`窗户：${WINDOW_MATERIALS[wm]}` + (WINDOW_VARIANTS[wm].label ? ` · ${vl}` : '')
        + (spec.rotation && ['pane', 'bars', 'fence', 'trapdoor'].includes(wm) ? '；斜放房屋的墙是错阶的，这类薄窗可能在台阶处露缝' : ''));
    } }
  const roles = currentRoles(new HouseBuilder({ ...DEFAULT_SPEC, ...spec }));
  // sizes that came out different from what was asked, with the reason (shown next to the field in the viewer)
  const adjust = [], why = (words, dflt) => (report.find(l => words.some(w => l.includes(w))) || dflt).replace(/^[^：]*：/, '');
  for (const [k, words] of [['width', ['面宽', '对调']], ['depth', ['进深', '对调']], ['floors', ['层数', '层']], ['floor_height', ['层高']]])
    if (req[k] !== undefined && req[k] !== null && spec[k] !== undefined && +req[k] !== +spec[k]) adjust.push({ key: k, got: spec[k], why: why(words, '生成器为了比例或结构自动调整') });
  // a seed-chosen plan widening the house is not a setting the user asked for, so no warning then
  if (lay && lay.width && lay.width > spec.width && req.plan !== 'auto' && req.plan !== undefined) adjust.push({ key: 'width', got: lay.width, why: `${PLAN_LABEL[lay.plan]}户型的两翼需要面宽至少 ${lay.width}，已加宽；想保持原宽可以把户型改成长方形` });
  return { structure: S, spec, report, ramps, roles, adjust };
}
