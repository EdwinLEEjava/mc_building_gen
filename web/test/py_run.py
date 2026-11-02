import json, sys, traceback
sys.path.insert(0, '.')
from mcgen.proportions import solve
from mcgen.house import build_house
from mcgen.colors import apply_colors
from mcgen.palettes import PALETTES
from mcgen.layout import PLAN_LABEL
from mcgen.annex import ANNEX_LABEL, FUNCTION_LABEL
out = []
for sp in json.load(open('web/test/specs.json')):
    try:
        final, report, _ = solve(sp)
        S = build_house(final)
        if final.get('colors'):
            report += apply_colors(PALETTES[final.get('palette', 'medieval_timber')], final['colors'])[1]
        lay = getattr(S, 'layout', None)
        if lay:
            report.append(f"户型：{PLAN_LABEL[lay['plan']]}" + ("（由种子选出）" if final.get("plan") == "auto" else ""))
            if lay.get('annexes') is not None:
                func = FUNCTION_LABEL.get(lay.get('function'), lay.get('function'))
                report.append(f"功能：{func}；附属建筑：{'、'.join(ANNEX_LABEL[a] for a in lay['annexes']) or '无'}")
        out.append({'ok': True, 'blocks': {f'{x},{y},{z}': v for (x, y, z), v in S.blocks.items()}, 'report': report})
    except Exception as e:
        out.append({'ok': False, 'error': f'{type(e).__name__}: {e}'})
json.dump(out, open('web/test/py.json', 'w'), ensure_ascii=False)
print('done', sum(o['ok'] for o in out), 'ok of', len(out))
