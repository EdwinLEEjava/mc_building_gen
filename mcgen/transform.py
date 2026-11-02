"""Angled (diagonal) buildings, following the classic "angled walls" step templates.

Every angle is a fixed step rhythm on the long walls (the eave side):
    12°  step every 5      15°  step every 4      20°  step every 3
    26°  step every 2      33°  step 2 then 1     45°  step every block
    57° / 64° / 70° / 75° / 78°  = 90° minus the above (same rhythms, other axis)
    negative angles tilt the other way

How: the house is built axis-aligned as usual, then every (x, z) column is moved with two
integer shears (rows, then columns). Each shear moves whole rows/columns by whole blocks, so the
mapping is one-to-one: no holes, no doubled blocks, and vertical structure (walls, roof
cross-sections, doors) moves as a unit.
  * long edge (x axis):  z' += floor(x' * q / p)          -> exactly the template rhythm
  * short edge (z axis): x' -= round(z * p*q / (p²+q²))   -> compensated so the two edges stay ~90°
Because the long edge gets longer in true length (factor k = sqrt(1 + (q/p)^2)) and the short
edge shorter (1/k), the builder pre-scales the local footprint so the finished house keeps the
requested true proportions.
"""
import math
import re

from .structure import Structure

# angle -> (p, q, rhythm label)
TEMPLATES = {
    12: (5, 1, "每 5 格一阶"),
    15: (4, 1, "每 4 格一阶"),
    20: (3, 1, "每 3 格一阶"),
    26: (2, 1, "每 2 格一阶"),
    33: (3, 2, "2 格、1 格交替"),
    45: (1, 1, "每格一阶"),
}
_POS = sorted(set(TEMPLATES) | {90 - a for a in TEMPLATES if a < 45})
SUPPORTED = [0] + _POS + [-a for a in _POS]   # negative = tilted the other way (mirror)


def template_for(angle):
    """Return (p, q, label, quarter_turns, sign) for a supported angle in (-90, 90)."""
    if angle == 0:
        return None
    mirror = angle < 0
    a = abs(angle)
    if a in TEMPLATES:
        p, q, label = TEMPLATES[a]
        quarter, sign = 0, 1
    elif (90 - a) in TEMPLATES:
        p, q, label = TEMPLATES[90 - a]
        quarter, sign = 1, -1
    else:
        raise ValueError(f"不支持的角度 {angle}°，可选：{SUPPORTED}")
    if mirror:
        quarter, sign = (3 if quarter else 0), -sign
    return p, q, label, quarter, sign


def stretch(angle):
    t = template_for(angle)
    if not t:
        return 1.0
    p, q = t[0], t[1]
    return math.sqrt(1 + (q / p) ** 2)


def local_footprint(width, depth, angle):
    """Local (pre-rotation) size so the rotated house keeps width x depth in true length.
    Long side is snapped to whole step periods so the wall ends on a full step (clean corner)."""
    t = template_for(angle)
    if not t:
        return width, depth
    p, q = t[0], t[1]
    k = stretch(angle)
    w = max(2 * p, p * round(width / k / p))
    d = max(5, round(depth * k))
    return w, d


# ---------------- block state transforms ----------------
_ROT = {"north": "east", "east": "south", "south": "west", "west": "north"}


def _rot90_state(state):
    """Quarter turn (x, z) -> (-z, x) for facing / axis / side-connection properties."""
    m = re.match(r"^([^\[]+)(?:\[(.*)\])?$", state)
    name, props = m.group(1), m.group(2)
    if not props:
        return state
    kv = dict(p.split("=") for p in props.split(","))
    out = {}
    for k, v in kv.items():
        if k == "facing" and v in _ROT:
            out[k] = _ROT[v]
        elif k == "axis" and v in ("x", "z"):
            out[k] = "z" if v == "x" else "x"
        elif k in _ROT:
            out[_ROT[k]] = v
        else:
            out[k] = v
    return name + "[" + ",".join(f"{k}={out[k]}" for k in sorted(out)) + "]"


def rotate(S, angle):
    t = template_for(angle)
    if not t:
        return S
    p, q, _, quarter, sign = t
    src = S.blocks
    for _ in range(quarter):
        src = {(-z, y, x): _rot90_state(st) for (x, y, z), st in src.items()}
    out = Structure()
    r2n, r2d = p * q, p * p + q * q
    for (x, y, z), st in src.items():
        x2 = x - sign * ((z * r2n + r2d // 2) // r2d)   # centred phase: short edge steps evenly
        z2 = z + sign * ((x2 * q) // p)
        out.blocks[(x2, y, z2)] = st
    fix_connections(out)
    return out


# ---------------- re-derive side connections after the move ----------------
_PARTIAL = ("_stairs", "_slab", "_trapdoor", "_door", "_pane", "_fence", "_wall", "lantern", "campfire",
            "torch", "_sign", "flower", "poppy", "dandelion", "cornflower", "fern", "grass[", "short_grass",
            "glass_pane", "_carpet", "chain", "air")
_DIRS = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}


def _full(st):
    return st is not None and not any(s in st for s in _PARTIAL) and not st.endswith("short_grass")


def fix_connections(S):
    for (x, y, z), st in list(S.blocks.items()):
        name = st.split("[")[0]
        pane = name.endswith("_pane") or name == "minecraft:iron_bars"
        fence = name.endswith("_fence")
        if not (pane or fence):
            continue
        props = {}
        for d, (dx, dz) in _DIRS.items():
            nb = S.blocks.get((x + dx, y, z + dz))
            nbn = nb.split("[")[0] if nb else ""
            same = (pane and (nbn.endswith("_pane") or nbn == "minecraft:iron_bars")) or \
                   (fence and (nbn.endswith("_fence") or nbn.endswith("_fence_gate")))
            props[d] = "true" if (same or _full(nb)) else "false"
        # fewer than two neighbours: keep the arms written into the state (no bare glass posts)
        if pane and sum(v == "true" for v in props.values()) < 2 and "[" in st:
            for pr in st[st.index("[") + 1:-1].split(","):
                k, _, v = pr.partition("=")
                if k in _DIRS and v == "true":
                    props[k] = "true"
        props["waterlogged"] = "false"
        S.blocks[(x, y, z)] = name + "[" + ",".join(f"{k}={props[k]}" for k in sorted(props)) + "]"
