"""Generate the sample builds (through the proportion rules) and embed them in the viewer page.
python build_viewer.py            -> web/mcgen.js, web/mcgen_data.json and viewer/index.html (the one build command)
python build_viewer.py --compare  -> viewer/compare.html (raw request vs. corrected, for screenshots)
"""
import base64, json, sys
from generate import generate

SAMPLES = [
    ("中世纪民居 · 要求陡坡", "medieval_steep"),
    ("中世纪民居 · 标准坡", "medieval_normal"),
    ("三层窄楼 · 要求缓坡", "townhouse_low"),
    ("9×15 小屋 · 要求陡坡", "cottage_rotated"),
    ("针叶林小屋 · 标准坡+飞檐", "taiga_cabin"),
    ("橡木村舍 · 缓坡", "oak_cottage"),
    ("中世纪民居 · 斜放 26°", "medieval_angled_26"),
    ("针叶林小屋 · 斜放 -15°", "taiga_angled_m15"),
    ("中世纪民居 · 老虎窗", "medieval_dormers"),
    ("指定配色（深灰屋顶 / 米黄墙 / 砖红一层）", "colors_custom"),
    ("混色（屋顶上浅下深 / 墙面风化 / 跨材质）", "colors_mix"),
    ("户型 · L 型", "plan_L"),
    ("户型 · T 型", "plan_T"),
    ("户型 · H 型", "plan_H"),
    ("户型 · 十字", "plan_cross"),
    ("户型 · 十字架（X 型）", "plan_X"),
    ("户型 · 长屋", "plan_longhouse"),
    ("户型 · 种子自动", "plan_auto"),
    ("功能 · 铁匠铺", "func_smithy"),
    ("功能 · 农舍", "func_farm"),
    ("功能 · 酒馆", "func_tavern"),
    ("功能 · 住宅（门廊 + 凸窗 + 披屋）", "func_dwelling"),
    ("谷仓 · 复折顶", "barn_gambrel"),
    ("附属小屋 · 单坡顶", "shed_mono"),
]


def entry(label, key, raw=False):
    from mcgen.house import HouseBuilder, DEFAULT_SPEC
    from mcgen.colors import current_roles
    spec = json.load(open(f"specs/{key}.json", encoding="utf-8"))
    path = f"out/{'raw_' if raw else ''}{key}.schem"
    final, report, _ = generate(spec, path, raw=raw)
    roles = current_roles(HouseBuilder({**DEFAULT_SPEC, **final}))
    return {"label": label, "file": path.split("/")[-1], "spec": final, "report": report, "roles": roles,
            "data": base64.b64encode(open(path, "rb").read()).decode()}


ROOF_CN = {"gable": "双坡", "gambrel": "复折（谷仓）", "mansard": "孟莎", "curved": "曲面", "saltbox": "盐盒（长短坡）",
           "mono": "单坡", "clerestory": "高侧窗", "m_shaped": "M 形", "butterfly": "蝴蝶", "elven": "精灵", "temple": "庙宇",
           "magical": "魔法"}
PALETTE_CN = {"medieval_timber": "中世纪木构", "taiga_cabin": "针叶林小屋", "oak_cottage": "橡木村舍"}
DORMER_CN = {"gable": "双坡", "steep": "陡坡", "low": "缓坡", "curved": "曲面", "mono": "单坡", "temple": "庙宇"}
CURVE_CN = {"linear": "均匀", "ease_in": "先慢后快", "ease_out": "先快后慢", "ease_in_out": "两头缓", "step": "分段"}


# styles whose shape ignores roof_pitch (saltbox has its own fixed profile too)
FIXED_PITCH = {"gambrel", "mansard", "curved", "elven", "temple", "magical", "clerestory", "saltbox"}
PITCH_CN = [("auto", "自动坡度"), ("low", "缓坡（台阶）"), ("normal", "标准坡（楼梯）"), ("steep", "陡坡（方块+楼梯）")]


def roof_groups():
    """One merged roof menu: styles with adjustable pitch list their pitches; fixed-profile styles are grouped."""
    from mcgen.house import HouseBuilder
    out = []
    for st in HouseBuilder.ROOF_STYLES:
        if st not in FIXED_PITCH:
            out.append([ROOF_CN[st], [[f"{st}|{p}", f"{ROOF_CN[st]} · {cn}"] for p, cn in PITCH_CN]])
    out.append(["固定坡度的造型", [[f"{st}|normal", ROOF_CN[st]] for st in HouseBuilder.ROOF_STYLES if st in FIXED_PITCH]])
    return out


def gen_bundle():
    """Generator sources + option lists for the in-browser (Pyodide) generator."""
    import glob, os
    from mcgen.house import DEFAULT_SPEC, HouseBuilder
    from mcgen.layout import PLAN_LABEL
    from mcgen.annex import FUNCTION_LABEL, ANNEX_LABEL
    from mcgen.colors import STYLES, CURVES, MIX_DEFAULT
    rot = [0, 12, 15, 20, 26, 33, 45, 57, 64, 70, 75, 78]
    meta = {
        "defaults": {**DEFAULT_SPEC, "seeds": None},
        "palettes": [[k, PALETTE_CN.get(k, k)] for k in __import__("mcgen.palettes", fromlist=["x"]).PALETTES],
        "plans": [["auto", "由种子决定"]] + [[k, v] for k, v in PLAN_LABEL.items() if k != "U"],
        "roof_groups": roof_groups(),
        "pitchless": sorted(FIXED_PITCH),
        "pitches": [["auto", "自动"], ["low", "缓坡（台阶）"], ["normal", "标准（楼梯）"], ["steep", "陡坡（方块+楼梯）"]],
        "functions": [["auto", "由种子决定"]] + [[k, v] for k, v in FUNCTION_LABEL.items()],
        "rotations": [[a, f"{a}°" if a else "不斜放"] for a in rot] + [[-a, f"-{a}°"] for a in rot[1:]],
        "dormers": [["auto", "由种子决定"], [0, "不加"], [1, "1 个"], [2, "2 个"], [3, "3 个"], [4, "4 个"]],
        "dormer_styles": [["auto", "由种子决定"]] + [[k, DORMER_CN.get(k, k)] for k in HouseBuilder.DORMER_STYLES],
        "annexes": [[k, v] for k, v in ANNEX_LABEL.items()],
        "styles": [[k, v] for k, v in STYLES.items()],
        "curves": [[k, CURVE_CN[k]] for k in CURVES],
        "mix_default": MIX_DEFAULT,
        "default_colors": {"roof": "#4a4a4a", "wall": "#e8e2d4", "wall_ground": "#8a8a8a", "frame": "#3d2a1a", "base": "#7e7f7c"},
    }
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_js", "web/build_js.py")
    bj = importlib.util.module_from_spec(spec); spec.loader.exec_module(bj)
    return {"data": bj.data(), "meta": meta}


def gen_js():
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_js", "web/build_js.py")
    bj = importlib.util.module_from_spec(spec); spec.loader.exec_module(bj)
    js = bj.bundle()
    assert "</script" not in js.lower()
    return js


if __name__ == "__main__":
    import os, subprocess
    os.makedirs("out", exist_ok=True)
    # one command builds everything: web/mcgen.js + web/mcgen_data.json (for Node / the tests) and the viewer page
    subprocess.run([sys.executable, "web/build_js.py"], check=True)
    compare = "--compare" in sys.argv
    if compare:
        items = []
        for label, key in SAMPLES[:4]:
            items.append(entry(label + "（原始）", key, raw=True))
            items.append(entry(label + "（校正后）", key))
        out = "viewer/compare.html"
    else:
        items = [entry(l, k) for l, k in SAMPLES]
        out = "viewer/index.html"
    t = open("viewer/template.html", encoding="utf-8").read()
    t = t.replace("/*SAMPLES*/[]", json.dumps(items, ensure_ascii=False))
    from mcgen.colors import export_for_viewer
    t = t.replace("/*RECOLOR*/null", json.dumps(export_for_viewer(), ensure_ascii=False, separators=(",", ":")))
    t = t.replace("/*MCGEN_JS*/", gen_js())
    t = t.replace("/*CATHEDRAL_STYLE_CONTROLS*/", open("viewer/cathedral-style-controls.js", encoding="utf-8").read())
    t = t.replace("/*GEN*/null", json.dumps(gen_bundle(), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
    open(out, "w", encoding="utf-8").write(t)
    for it in items:
        print(it["file"], "|", "; ".join(it["report"]) or "通过")
