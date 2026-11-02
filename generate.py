"""Usage: python generate.py spec.json out.schem [--raw]

spec.json is the high-level design an LLM would output (see mcgen/house.py DEFAULT_SPEC).
By default the spec first passes through the proportion rules (mcgen/proportions.py);
--raw skips them (useful for before/after comparisons).
"""
import json
import sys

from mcgen.house import build_house
from mcgen.proportions import solve


def generate(spec, out, raw=False):
    report = []
    if not raw:
        spec, report, _ = solve(spec)
    S = build_house(spec)
    if spec.get("colors"):
        from mcgen.colors import apply_colors
        from mcgen.palettes import PALETTES
        report += apply_colors(PALETTES[spec.get("palette", "medieval_timber")], spec["colors"])[1]
    lay = getattr(S, "layout", None)
    if lay:
        from mcgen.layout import PLAN_LABEL
        report.append(f"户型：{PLAN_LABEL[lay['plan']]}" + (f"（由种子选出）" if spec.get("plan") == "auto" else ""))
        if lay.get("annexes") is not None:
            from mcgen.annex import ANNEX_LABEL, FUNCTION_LABEL
            func = FUNCTION_LABEL.get(lay.get("function"), lay.get("function"))
            ann = "、".join(ANNEX_LABEL[a] for a in lay["annexes"]) or "无"
            report.append(f"功能：{func}；附属建筑：{ann}")
    W, H, L, n = S.save_schem(out)
    return spec, report, (W, H, L, len(S.blocks))


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    final, report, (W, H, L, nb) = generate(spec, sys.argv[2], raw="--raw" in sys.argv)
    print(f"{sys.argv[2]}: {W}x{H}x{L}, {nb} blocks")
    for r in report:
        print("  ·", r)
