"""Proportion rules: sit between the LLM spec and the builder.

The spec says what the designer wants (size, floors, roof pitch). Before building, we
measure the resulting massing and, if any ratio is out of range, search for the smallest
change to the spec that brings it back in range. Every change is reported.

Measured quantities (blocks):
  wall_h   = floors * floor_height + 1 (foundation)
  span     = gable width the roof covers = depth + 2 * jetty steps + 2 * overhang
  roof_h   = rise from wall top to ridge (from the actual roof profile)

Ratios checked:
  roof_ratio  = roof_h / wall_h        roof vs body: neither a "hat" nor a "lid"
  gable_ratio = (wall_h + roof_h) / span   gable-end silhouette: not a tower, not a shed
  plan_ratio  = width / depth          footprint: ridge runs along the long side
"""
import itertools

from .house import DEFAULT_SPEC, HouseBuilder

# Bands per palette/style. "ideal" is what the search pulls toward.
STYLE_RULES = {
    "medieval_timber": {"roof_ratio": (0.45, 1.00, 0.80), "gable_ratio": (0.80, 1.80, 1.30), "plan_ratio": (1.0, 2.2)},
    "taiga_cabin":     {"roof_ratio": (0.50, 1.30, 0.95), "gable_ratio": (0.75, 1.60, 1.15), "plan_ratio": (1.0, 2.0)},
    "oak_cottage":     {"roof_ratio": (0.35, 1.05, 0.70), "gable_ratio": (0.70, 1.50, 1.05), "plan_ratio": (1.0, 2.4)},
}
DEFAULT_RULES = {"roof_ratio": (0.40, 1.20, 0.85), "gable_ratio": (0.75, 1.70, 1.20), "plan_ratio": (1.0, 2.2)}

# Roof styles have their own roof/body band: a barn's gambrel is meant to dominate, a shed's mono
# roof is meant to be low. (lo, hi, ideal); styles not listed use the palette's band.
ROOF_STYLE_BAND = {
    "gambrel": (0.60, 1.70, 1.20), "mansard": (0.40, 1.20, 0.80), "curved": (0.40, 1.30, 0.80),
    "elven": (0.60, 1.80, 1.20), "magical": (0.60, 2.00, 1.30), "temple": (0.40, 1.20, 0.80),
    "mono": (0.15, 1.10, 0.60), "butterfly": (0.20, 0.90, 0.50), "clerestory": (0.30, 1.10, 0.70),
    "m_shaped": (0.25, 0.90, 0.50),
}
# Styles whose shape ignores roof_pitch: never search or report a pitch for them.
PITCHLESS = {"gambrel", "mansard", "curved", "elven", "temple", "magical", "clerestory"}

# Cost of changing each design decision. Body height is cheapest to change, pitch is the most
# "visible" intent so it is changed last (a requested steep roof should get a taller house first).
COST = {"pitch": 5.0, "floors": 2.0, "floor_height": 1.0, "flare": 1.0, "jetty": 1.5}
PITCHES = ["low", "normal", "steep"]
LABEL = {"low": "缓坡（台阶）", "normal": "标准坡（楼梯）", "steep": "陡坡（方块+楼梯）"}


def measure(spec):
    s = {**DEFAULT_SPEC, **spec}
    k = 1.0
    if s.get("rotation"):
        # angled houses are built on a pre-scaled local footprint; the roof is built on the local
        # span, while the true gable width is the local span shrunk by the stretch factor
        from . import transform
        w, d = transform.local_footprint(s["width"], s["depth"], s["rotation"])
        s = {**s, "width": w, "depth": d}
        k = transform.stretch(spec["rotation"])
    hb = HouseBuilder(s)
    jet = (s["floors"] - 1) if s["jetty"] else 0
    span = s["depth"] + 2 * jet + 2 * s["roof_overhang"]
    pitch = s["roof_pitch"] if s["roof_pitch"] != "auto" else hb.resolve_pitch(span)
    roof_h = hb.roof_height(span, pitch)
    wall_h = s["floors"] * s["floor_height"] + 1
    return {
        "pitch": pitch, "span": span, "wall_h": wall_h, "roof_h": roof_h,
        "roof_ratio": roof_h / wall_h,
        "gable_ratio": (wall_h + roof_h) / (span / k),
        "plan_ratio": spec.get("width", s["width"]) / spec.get("depth", s["depth"]),
    }


def _violation(m, rules):
    v = 0.0
    for k in ("roof_ratio", "gable_ratio"):
        lo, hi, _ = rules[k]
        v += max(0.0, lo - m[k]) + max(0.0, m[k] - hi)
    return v


def solve(spec):
    """Return (adjusted_spec, report_lines, metrics)."""
    s = {**DEFAULT_SPEC, **spec}
    rules = dict(STYLE_RULES.get(s["palette"], DEFAULT_RULES))
    style = s.get("roof_style", "gable")
    if style in ROOF_STYLE_BAND:
        rules["roof_ratio"] = ROOF_STYLE_BAND[style]
        rules["gable_ratio"] = (rules["gable_ratio"][0], max(rules["gable_ratio"][1], 1.9), rules["gable_ratio"][2])
    report = []

    # 1. footprint: ridge along the long side, length/depth within band
    lo, hi = rules["plan_ratio"]
    if s["depth"] > s["width"]:
        s["width"], s["depth"] = s["depth"], s["width"]
        report.append(f"平面：进深大于面宽，已对调，使屋脊沿长边（{s['width']}×{s['depth']}）")
    if s["width"] / s["depth"] > hi:
        new_w = int(s["depth"] * hi)
        report.append(f"平面：长宽比 {s['width'] / s['depth']:.1f} 过于狭长，面宽 {s['width']} → {new_w}")
        s["width"] = new_w

    # 2. massing: search the smallest change that puts roof/body/gable ratios in band
    req = dict(s)
    req_pitch = s["roof_pitch"]
    if style in PITCHLESS:
        req_pitch = s["roof_pitch"] = "normal"
        pitch_opts = ["normal"]
    else:
        pitch_opts = PITCHES if req_pitch == "auto" else [req_pitch] + [p for p in PITCHES if p != req_pitch]
    floors_opts = sorted({max(1, min(3, s["floors"] + d)) for d in (0, 1, -1, 2)})
    fh_opts = sorted({s["floor_height"], 4, 5})
    flare_opts = [s["flared_eave"], not s["flared_eave"]]
    jetty_opts = [s["jetty"], not s["jetty"]]

    best = None
    for pitch, floors, fh, flare, jetty in itertools.product(pitch_opts, floors_opts, fh_opts, flare_opts, jetty_opts):
        cand = {**s, "roof_pitch": pitch, "floors": floors, "floor_height": fh, "flared_eave": flare, "jetty": jetty}
        m = measure(cand)
        if flare and (m["pitch"] == "low" or style != "gable"):
            continue  # flare only applies to gable roofs, and there is no course shallower than slabs
        cost = 0.0
        if req_pitch != "auto" and pitch != req_pitch:
            cost += COST["pitch"] * abs(PITCHES.index(pitch) - PITCHES.index(req_pitch))
        cost += COST["floors"] * abs(floors - req["floors"])
        cost += COST["floor_height"] * abs(fh - req["floor_height"])
        cost += COST["flare"] * (flare != req["flared_eave"])
        cost += COST["jetty"] * (jetty != req["jetty"]) * (floors > 1)
        for k, w in (("roof_ratio", 4.0), ("gable_ratio", 2.0)):
            cost += w * abs(m[k] - rules[k][2])
        key = (_violation(m, rules) > 1e-9, _violation(m, rules), cost)
        if best is None or key < best[0]:
            best = (key, cand, m)

    (_, viol, _), out, m = best
    m0 = measure(req)
    if req_pitch == "auto":
        out_pitch = m["pitch"]
        report.append(f"屋顶：自动选择 {LABEL[out_pitch]}")
        out["roof_pitch"] = out_pitch
    elif out["roof_pitch"] != req_pitch:
        report.append(f"屋顶：{LABEL[req_pitch]} 在这个体量下比例失调，改为 {LABEL[out['roof_pitch']]}")
    if out["floors"] != req["floors"]:
        report.append(f"房体：层数 {req['floors']} → {out['floors']}（让房体配得上屋顶）")
    if out["floor_height"] != req["floor_height"]:
        report.append(f"房体：层高 {req['floor_height']} → {out['floor_height']}")
    if out["jetty"] != req["jetty"] and out["floors"] > 1:
        report.append("房体：" + ("取消上层出挑，收窄山墙跨度" if not out["jetty"] else "加上层出挑"))
    if out["flared_eave"] != req["flared_eave"]:
        report.append("屋顶：" + ("加飞檐，压低屋顶高度" if out["flared_eave"] else "去掉飞檐"))
    if report or viol:
        report.append(
            f"比例：屋顶/房体 {m0['roof_ratio']:.2f} → {m['roof_ratio']:.2f}"
            f"（合理 {rules['roof_ratio'][0]}–{rules['roof_ratio'][1]}），"
            f"山墙高/宽 {m0['gable_ratio']:.2f} → {m['gable_ratio']:.2f}"
            f"（合理 {rules['gable_ratio'][0]}–{rules['gable_ratio'][1]}）")
    ang = out.get("rotation", 0) or 0
    if ang:
        from . import transform
        p_, q_, label, quarter, _ = transform.template_for(ang)
        w, d = transform.local_footprint(out["width"], out["depth"], ang)
        report.append(f"斜向 {ang}°：长边{label}；按 {w}×{d} 搭建后斜放，真实尺寸约 {out['width']}×{out['depth']}，"
                      f"长边取 {p_} 的整数倍，墙角落在完整台阶上")
    if viol:
        report.append("警告：找不到完全满足比例的方案，已取最接近的一种")
    return out, report, m
