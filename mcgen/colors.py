"""Palette-driven house colors (指定颜色换色).

spec["colors"] = {"roof": ..., "wall": ..., "wall_ground": ..., "frame": ..., "base": ...}
Each value is a hex ("#a83a2c") or a Chinese color word ("红", "深棕", "米白" ...). Any subset may be
given; the rest keep the style palette.

For each slot the block colors come from mc_block_palette.json (average texture color, OKLab). The
nearest block that *fits the slot* wins:
  roof   blocks that have a full block, stairs and a slab (屋面要用到三种形状)
  frame  wood with a log / stem (axis), stripped variant, planks stairs, door, trapdoor
  wall   full building blocks (stone, planks, wool, concrete, terracotta, copper ...)
  base   stone-like blocks that also have stairs (front step)
Up to two companions of the same material class within a small color distance are mixed in
(weights 6:2:1), keeping the clustered weathering look.
"""
import json
import math
import os

_DATA = json.load(open(os.path.join(os.path.dirname(__file__), "data", "mc_block_palette.json"), encoding="utf-8"))
BLOCKS = {}
for b in _DATA["blocks"]:
    BLOCKS.setdefault(b["id"], b)
FULL = {b["id"]: b for b in _DATA["blocks"] if b["type"] == "full"}
IDS = {b["id"] for b in _DATA["blocks"]}

WORDS = {
    "白": "#ece8de", "米白": "#e6dcc4", "米": "#d8c79c", "米黄": "#d9c48a", "浅灰": "#a8a8a8", "灰": "#808080",
    "深灰": "#4a4a4a", "黑": "#1e1e22", "红": "#a83a2c", "砖红": "#9a5040", "深红": "#5e1e1e", "橙": "#c8682a",
    "黄": "#d8b84a", "金": "#e8c040", "绿": "#4f7a3a", "深绿": "#2f4f2a", "青": "#3a8a8a", "蓝": "#3a5aa0",
    "深蓝": "#283a6a", "浅蓝": "#7aa8d8", "紫": "#6a4a9a", "粉": "#e0a0b0", "棕": "#6a4a2a", "深棕": "#3a2818",
    "浅棕": "#a07a50", "木色": "#a0784a", "沙色": "#d8cb9b", "石色": "#7d7d7d",
}


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklab(hexs):
    h = hexs.lstrip("#")
    r, g, b = (_lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def de(a, b):
    return math.dist(a, b) * 100


def parse_color(v):
    v = str(v).strip()
    if v.startswith("#") and len(v) == 7:
        return v.lower()
    if v in WORDS:
        return WORDS[v]
    for k in sorted(WORDS, key=len, reverse=True):     # "偏红" / "红色" / "暗红色"
        if k in v:
            return WORDS[k]
    raise ValueError(f"无法识别的颜色：{v}（用 #rrggbb 或这些词：{'、'.join(WORDS)}）")


def _color(bid, face="side"):
    b = BLOCKS[bid]
    return (b["faces"].get(face) or b["faces"]["side"])["hex"]


# ------------------------------------------------------------------ slot options
def _full_for(base):
    for c in (base + "_planks", base + "s", base, base + "_block"):
        if c in FULL:
            return c
    return None


def _roof_options():
    out = []
    for b in _DATA["blocks"]:
        if b["type"] != "stairs" or b["new"]:
            continue
        base = b["id"][:-7]
        full = {"quartz": "quartz_block", "purpur": "purpur_block"}.get(base) or _full_for(base)
        slab = base + "_slab"
        if full and slab in IDS:
            out.append({"key": full, "cls": FULL[full]["material"], "hex": _color(full),
                        "roles": {"roof_full": full, "roof_stairs": b["id"], "roof_slab": slab}})
    return out


WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "crimson", "warped"]


def _frame_options():
    out = []
    for w in WOODS:
        stem = w in ("crimson", "warped")
        log = f"{w}_stem" if stem else f"{w}_log"
        common = {"wood_stairs": f"{w}_stairs", "trapdoor": f"{w}_trapdoor", "door": f"{w}_door", "floor": f"{w}_planks",
                  "fence": f"{w}_fence", "fence_gate": f"{w}_fence_gate"}
        for post, beam in ((log, f"stripped_{log}"), (f"stripped_{log}", f"stripped_{log}")):
            if post in FULL:
                out.append({"key": post, "cls": "wood", "hex": _color(post), "roles": {"post": post, "beam": beam, **common}})
    return out


WALL_CLASSES = {"主世界石材", "下界石材", "末地石材", "木板", "羊毛", "混凝土", "混凝土粉末", "陶瓦", "铜"}
WALL_EXTRA = {"calcite", "packed_mud", "mud_bricks", "clay", "dripstone_block", "bone_block", "smooth_basalt",
              "white_terracotta", "terracotta", "honeycomb_block", "hay_block"}
WALL_SKIP = ("chiseled_", "_ore", "bulb", "grate", "gilded", "reinforced", "cracked_polished", "_pillar")


def _wall_options():
    out = []
    for bid, b in FULL.items():
        if b["new"] or any(t in bid for t in WALL_SKIP):
            continue
        if b["material"] in WALL_CLASSES or bid in WALL_EXTRA:
            out.append({"key": bid, "cls": b["material"], "hex": _color(bid), "roles": {"block": bid}})
    return out


STONE = {"主世界石材", "下界石材", "末地石材"}


def _base_options():
    return [{"key": o["key"], "cls": o["cls"], "hex": o["hex"],
             "roles": {"block": o["key"], "base_stairs": o["roles"]["roof_stairs"]}}
            for o in _roof_options() if o["cls"] in STONE]


OPTIONS = {"roof": _roof_options(), "frame": _frame_options(), "wall": _wall_options(), "base": _base_options()}
for opts in OPTIONS.values():
    for o in opts:
        o["lab"] = oklab(o["hex"])


_PRE = ("polished_", "cracked_", "mossy_", "smooth_", "cut_", "chiseled_", "cobbled_", "exposed_", "weathered_", "oxidized_")
_SUF = ("_bricks", "_brick", "_tiles", "_block", "_planks")


def core(bid):
    """Material family: stone_bricks / mossy_stone_bricks / cracked_stone_bricks -> stone."""
    changed = True
    while changed:
        changed = False
        for t in _PRE:
            if bid.startswith(t):
                bid, changed = bid[len(t):], True
        for t in _SUF:
            if bid.endswith(t):
                bid, changed = bid[:-len(t)], True
    return {"cobblestone": "stone", "bricks": "brick", "brick": "brick"}.get(bid, bid)


_DYES = ("light_blue", "light_gray", "white", "orange", "magenta", "yellow", "lime", "pink", "gray", "cyan",
         "purple", "blue", "brown", "green", "red", "black")
_DYED = ("_concrete_powder", "_concrete", "_wool", "_terracotta")


def family(o):
    """Mixing family: same material (stone / mossy / cracked stone bricks…) or same dye colour across
    concrete / concrete powder / wool / terracotta."""
    k = o["key"]
    for d in _DYES:
        if k.startswith(d + "_") and k[len(d):] in _DYED:
            return "dye:" + d
    return o["cls"] + ":" + core(k)


def pick(slot, hexs, companions=2, radius=6.0):
    """Nearest option for the slot + up to `companions` same-class neighbours within `radius` (ΔE*100)."""
    target = oklab(hexs)
    opts = sorted(OPTIONS[slot], key=lambda o: de(o["lab"], target))
    main = opts[0]
    comp = [o for o in opts[1:] if o["cls"] == main["cls"] and core(o["key"]) == core(main["key"])
            and de(o["lab"], main["lab"]) < radius and o["key"] != main["key"] and slot != "frame"][:companions]
    return [main] + comp, de(main["lab"], target)


def _weighted(chosen, role):
    ws = [6, 2, 1][:len(chosen)]
    return [(o["roles"][role], w) for o, w in zip(chosen, ws)]


# ------------------------------------------------------------------ ramps (色阶) for mixed slots
STYLES = {
    "cluster": "成片随机", "speckle": "细碎随机", "bottom_dark": "上浅下深", "top_dark": "上深下浅",
    "horizontal": "左右渐变", "weathered": "风化", "eave_dark": "檐口深", "ridge_dark": "屋脊深",
}
CURVES = ("linear", "ease_in", "ease_out", "ease_in_out", "step")
MIX_DEFAULT = {"range": 14, "count": 4, "style": "cluster", "jitter": 0.35, "scale": 2, "cross": False,
               "curve": "linear", "skip": 0.0}


def _L(o):
    return o["lab"][0] * 100


def _chroma_dist(a, b, hue=40):
    """Distance in the a,b plane (x100); for colourful targets, greys and other hues are excluded."""
    ca, cb = math.hypot(a[1], a[2]) * 100, math.hypot(b[1], b[2]) * 100
    if cb > 4:
        if ca < 2.5:
            return 99
        dh = abs(math.degrees(math.atan2(a[2], a[1]) - math.atan2(b[2], b[1]))) % 360
        if min(dh, 360 - dh) > hue:
            return 99
    return math.hypot(a[1] - b[1], a[2] - b[2]) * 100


def build_ramp(slot, hexs, rng_L, count, cross):
    """Ramp of `count` options sorted dark -> light whose lightness spans about `rng_L` (OKLab L x100)
    around the target color. Same material family by default; `cross` admits any material whose
    hue/chroma is close, and the merged set is sorted by lightness again."""
    target = oklab(hexs)
    opts = OPTIONS[slot]
    main = min(opts, key=lambda o: de(o["lab"], target))
    tL = target[0] * 100
    lo, hi = tL - rng_L / 2, tL + rng_L / 2
    inside = lambda o: lo - 1 <= _L(o) <= hi + 1
    if cross:   # widen the hue/chroma tolerance until the ramp can be filled (cap keeps the hue)
        for tol, hue in ((4, 30), (5.5, 35), (7, 40), (8.5, 45), (10, 55), (12, 65)):
            pool = [o for o in opts if _chroma_dist(o["lab"], target, hue) < tol and inside(o)]
            if len(pool) >= count:
                break
    else:
        pool = [o for o in opts if family(o) == family(main) and inside(o)]
    if main not in pool:
        pool.append(main)
    pool.sort(key=_L)                                   # (second) lightness sort across materials
    # pick count blocks spread evenly in lightness across the pool, always keeping the main block
    chosen = [main]
    if len(pool) > 1 and count > 1:
        a, b = _L(pool[0]), _L(pool[-1])
        for i in range(count):
            want = a + (b - a) * i / (count - 1)
            # skip near-duplicates (ΔE < 1.2): they would read as one block and waste a ramp step
            free = [o for o in pool if o not in chosen and all(de(o["lab"], c["lab"]) >= 1.2 for c in chosen)]
            cand = min(free, key=lambda o: abs(_L(o) - want), default=None)
            if cand is None or len(chosen) >= count:
                break
            chosen.append(cand)
    ramp = sorted(chosen, key=_L)
    steps = [de(x["lab"], y["lab"]) for x, y in zip(ramp, ramp[1:])]
    return ramp, main, de(main["lab"], target), steps


def mix_config(v):
    """Normalise a slot value: plain color string -> legacy (None); dict -> full mix config."""
    if isinstance(v, str):
        return None
    cfg = {**MIX_DEFAULT, **v}
    if cfg["style"] not in STYLES:
        raise ValueError(f"未知的混色样式 {cfg['style']}，可选：{list(STYLES)}")
    return cfg


def _ramp_weights(ramp, main):
    """For random styles: weight peaks at the main block and falls off with lightness distance."""
    m = _L(main)
    return [max(1, round(8 * math.exp(-((_L(o) - m) / 6) ** 2))) for o in ramp]


def apply_colors(palette, colors):
    """Return (new_palette, report_lines). Palette slots become weighted lists in ramp order (dark ->
    light); slots with a mix config also get palette["_mix"][slot] for the position-based styles."""
    if not colors:
        return palette, []
    p = dict(palette)
    p["_mix"] = dict(palette.get("_mix", {}))
    p["_ramps"] = dict(palette.get("_ramps", {}))
    rep = []
    label = {"roof": "屋顶", "wall": "墙面", "wall_ground": "一层墙面", "frame": "木构", "base": "基座"}
    kind = {"roof": "roof", "wall": "wall", "wall_ground": "wall", "frame": "frame", "base": "base"}
    targets = {"roof": ("roof_full", "roof_stairs", "roof_slab"), "wall": ("infill_upper", "infill_ground"),
               "wall_ground": ("infill_ground",), "base": ("base",)}
    roles = {"roof_full": "roof_full", "roof_stairs": "roof_stairs", "roof_slab": "roof_slab",
             "infill_upper": "block", "infill_ground": "block", "base": "block"}

    for slot in ("roof", "frame", "wall", "wall_ground", "base"):
        if slot not in colors or colors[slot] in (None, ""):
            continue
        v = colors[slot]
        cfg = mix_config(v)
        raw = v if isinstance(v, str) else v.get("color")
        hexs = parse_color(raw) if raw else None
        if slot == "frame":
            ch, d = pick("frame", hexs or "#6a4a2a")
            r = ch[0]["roles"]
            p.update(post=r["post"], beam=r["beam"], wood_stairs=r["wood_stairs"], trapdoor=r["trapdoor"], door=r["door"], floor=r["floor"])
            rep.append(f"配色·{label[slot]} {hexs} → {BLOCKS[ch[0]['key']]['cn']}（色差 ΔE {d:.1f}）")
            continue
        if cfg is None:                                   # plain color: nearest + close companions (6:2:1)
            ch, d = pick(kind[slot], hexs)
            ramp, weights, main, steps = ch, [6, 2, 1][:len(ch)], ch[0], []
        else:
            if hexs is None:   # no color: keep the style palette's own blocks, just sort them into a ramp
                hexs = _palette_hex(palette, targets[slot][0], kind[slot])
            ramp, main, d, steps = build_ramp(kind[slot], hexs, cfg["range"], int(cfg["count"]), bool(cfg["cross"]))
            weights = _ramp_weights(ramp, main)
        for t in targets[slot]:
            p[t] = [(o["roles"][roles[t]], w) for o, w in zip(ramp, weights)]
            if cfg is not None:
                p["_mix"][t] = {**cfg, "group": slot}
            else:
                p["_mix"].pop(t, None)
        if slot == "base":
            p["base_stairs"] = main["roles"]["base_stairs"]
            p["chimney"] = list(p["base"])
        p["_ramps"][slot] = [{"id": o["key"], "cn": BLOCKS[o["key"]]["cn"], "hex": o["hex"], "L": round(_L(o), 1)} for o in ramp]
        names = " → ".join(BLOCKS[o["key"]]["cn"] for o in ramp)
        warn = "；原版没有更接近这个颜色的方块" if d > 8 else ""
        if cfg is None:
            rep.append(f"配色·{label[slot]} {hexs} → {names}（主色差 ΔE {d:.1f}{warn}）")
        else:
            st = "、".join(f"{x:.1f}" for x in steps) or "—"
            span = _L(ramp[-1]) - _L(ramp[0])
            rep.append(f"配色·{label[slot]} {hexs}｜{STYLES[cfg['style']]}｜色阶（暗→亮）：{names}；"
                       f"明暗跨度 {span:.1f}，相邻色差 {st}{'；已允许跨材质' if cfg['cross'] else ''}{warn}")
            if len(ramp) < int(cfg["count"]):
                rep.append(f"　提示：{label[slot]}在这个明暗范围内只找到 {len(ramp)} 种" +
                           ("色相相近的方块，可以加大明暗范围" if cfg["cross"] else "同家族方块，可以加大明暗范围或打开跨材质"))
    return p, rep


def _palette_hex(palette, slot, kind):
    """Average color of a style palette slot (weighted), used as ramp center when only a style is given."""
    e = palette[slot]
    items = [(e, 1)] if isinstance(e, str) else e
    tot = sum(w for _, w in items)
    acc = [0.0, 0.0, 0.0]
    for name, w in items:
        o = next((o for o in OPTIONS[kind] if any(r == name for r in o["roles"].values())), None)
        h = o["hex"] if o else BLOCKS.get(name, {}).get("hex", "#808080")
        for i in range(3):
            acc[i] += int(h[1 + 2 * i:3 + 2 * i], 16) * w / tot
    return "#" + "".join(f"{round(c):02x}" for c in acc)


def _ids(v):
    return [v] if isinstance(v, str) else [n for n, _ in v]


def current_roles(hb):
    """Which block ids fill each recolorable role in a built house (for the viewer's live recolor)."""
    p = hb.p
    ws = hb._wood_stairs()
    wood = ws[:-7]
    return {
        "roof": {"roof_full": _ids(p["roof_full"]), "roof_stairs": _ids(p["roof_stairs"]), "roof_slab": _ids(p["roof_slab"])},
        "wall": {"block": _ids(p["infill_upper"])},
        "wall_ground": {"block": _ids(p["infill_ground"])},
        "frame": {"post": _ids(p["post"]), "beam": _ids(p["beam"]), "wood_stairs": [ws], "trapdoor": _ids(p["trapdoor"]),
                  "door": _ids(p["door"]), "floor": _ids(p["floor"]), "fence": [wood + "_fence"], "fence_gate": [wood + "_fence_gate"]},
        "base": {"block": _ids(p["base"]), "base_stairs": [hb._base_stairs()]},
    }


def export_for_viewer():
    """Slot options + block colors, for the viewer's live recolor."""
    slim = {s: [{"key": o["key"], "cls": o["cls"], "hex": o["hex"], "roles": o["roles"], "cn": BLOCKS[o["key"]]["cn"]}
                for o in opts] for s, opts in OPTIONS.items()}
    cols = {bid: [b["faces"]["side"]["hex"], b["faces"].get("top", b["faces"]["side"])["hex"]] for bid, b in BLOCKS.items()}
    return {"options": slim, "colors": cols, "words": WORDS}
