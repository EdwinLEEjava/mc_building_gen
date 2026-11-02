"""Annexes (附属建筑), exterior only.

Volume annexes (built like any other volume, then merged):
  storage   披屋 / 储物间   single-storey lean-to, mono roof against the host wall, own door
  woodshed  柴房           open-front lean-to, firewood stacked inside
  stable    马厩           open-front lean-to, fence-gate front, hay and a stall divider
  smithy    铁匠铺         open-front lean-to on a gable end, anvil / furnaces / grindstone, own chimney
  tower     楼梯塔         narrow volume one storey taller than the main block, at the back

Components added after merging (they need the final door / wall positions):
  hood      门罩           small stair roof on brackets over the door
  porch     门廊           posts + little gable roof + raised floor in front of the door
  oriel     凸窗           upper-floor bay box on corbels, glass front, stair roof

`function` picks which annexes are likely; `annexes` (a list) overrides it.
"""
from .house import frame_positions, patch_noise, pick_u
from .structure import B

FUNCTIONS = {
    "dwelling": {"hood": 0.45, "porch": 0.25, "oriel": 0.5, "storage": 0.35, "woodshed": 0.3, "tower": 0.12},
    "smithy":   {"smithy": 1.0, "hood": 0.3, "woodshed": 0.4, "oriel": 0.2},
    "farm":     {"stable": 0.75, "woodshed": 0.5, "storage": 0.4, "porch": 0.3},
    "tavern":   {"porch": 0.7, "oriel": 0.6, "tower": 0.25, "stable": 0.35, "storage": 0.3},
}
FUNCTION_LABEL = {"dwelling": "住宅", "smithy": "铁匠铺", "farm": "农舍", "tavern": "酒馆"}
ANNEX_LABEL = {"storage": "披屋（储物）", "woodshed": "柴房", "stable": "马厩", "smithy": "铁匠铺",
               "tower": "楼梯塔", "hood": "门罩", "porch": "门廊", "oriel": "凸窗"}
LEAN_TOS = ("smithy", "stable", "storage", "woodshed")
OPEN_FRONT = ("smithy", "stable", "woodshed")


def resolve_annexes(spec, rng):
    want = spec.get("annexes", "auto")
    if isinstance(want, (list, tuple)):
        return list(want)
    if not want:
        return []
    func = spec.get("function", "dwelling")
    if func == "auto":
        func = rng.choice(list(FUNCTIONS))
    probs = FUNCTIONS[func]
    out = [k for k, p in probs.items() if rng.random() < p]
    if "porch" in out and "hood" in out:
        out.remove("hood")
    return out


# ---------------------------------------------------------------- volume annexes
def plan_annex_volumes(spec, kinds, vols, rng, Volume):
    """Add lean-to / tower volumes on free walls of the main block. Returns the kinds placed."""
    main = vols[0]
    x0, x1, z0, z1 = main.rect
    W, D = x1 - x0 + 1, z1 - z0 + 1
    others = vols[1:]
    F, fh = spec["floors"], spec["floor_height"]
    main_top = F * fh
    west_free = all(v.rect[0] > x0 + 1 for v in others)
    east_free = all(v.rect[1] < x1 - 1 for v in others)
    # free stretch of the back wall: not covered by anything that reaches behind the main block
    back = [x for x in range(x0 + 1, x1) if not any(v.rect[0] - 1 <= x <= v.rect[1] + 1 and v.rect[3] > z1 for v in others)]
    segs, cur = [], []
    for x in back:
        if cur and x != cur[-1] + 1:
            segs.append(cur); cur = []
        cur.append(x)
    if cur:
        segs.append(cur)
    placed = []

    def lean_spec(kind, Dl):
        span = Dl + 2
        fha = max(3, min(4, main_top - span // 2 - 1))
        return dict(floors=1, floor_height=fha, jetty=False, roof_style="mono", roof_pitch="normal",
                    front_door=(kind == "storage"), dormers=0)

    order = sorted([k for k in kinds if k in LEAN_TOS], key=lambda k: 0 if k == "smithy" else 1)
    ends = [e for e, free in (("west", west_free), ("east", east_free)) if free]
    rng.shuffle(ends)
    for kind in order:
        d = {"smithy": rng.choice([4, 5]), "stable": 4, "woodshed": 3, "storage": rng.choice([3, 4])}[kind]
        Dl = d + 1
        want_l = {"smithy": 7, "stable": rng.choice([7, 9]), "woodshed": 5, "storage": rng.choice([5, 7])}[kind]
        use_end = ends and (kind in ("smithy", "stable") or not segs)
        if use_end:
            end = ends.pop(0)
            l = min(want_l, D - 2)
            if l < 5:
                continue
            zc = z0 + (D - l) // 2
            if end == "west":
                rect = (x0 - d, x0, zc, zc + l - 1)
            else:
                rect = (x1, x1 + d, zc, zc + l - 1)
            v = Volume("annex", rect, "z", end, **lean_spec(kind, Dl))
        else:
            segs.sort(key=len, reverse=True)
            if not segs or len(segs[0]) < 5:
                continue
            seg = segs.pop(0)
            l = min(want_l, len(seg))
            if l % 2 == 0:
                l -= 1
            if l < 5:
                continue
            start = seg[0] + rng.randint(0, len(seg) - l)
            rest_l, rest_r = seg[:start - seg[0]], seg[start - seg[0] + l:]
            segs += [s for s in (rest_l[:-1], rest_r[1:]) if len(s) >= 5]
            rect = (start, start + l - 1, z1, z1 + d)
            v = Volume("annex", rect, "x", "south", **lean_spec(kind, Dl))
        v.kind = kind
        v.post = _LOCAL_POST[kind]
        vols.append(v)
        placed.append(kind)

    if "tower" in kinds and segs:
        segs.sort(key=len, reverse=True)
        seg = segs[0]
        if len(seg) >= 7:
            cx = seg[len(seg) // 2]
            tw = 5
            rect = (cx - tw // 2, cx + tw // 2, z1 - 1, z1 + 3)
            style = rng.choice(["gable", "gable", "magical"])
            v = Volume("tower", rect, "x", "south", floors=F + 1, jetty=False, roof_style=style,
                       roof_pitch="steep", front_door=False, dormers=0)
            v.kind = "tower"
            vols.append(v)
            placed.append("tower")
    return placed


def _open_front(hb, S):
    W = hb.spec["width"]
    fh = hb.spec["floor_height"]
    flush = bool(hb.spec.get("flush_walls"))
    for x in range(1, W - 1):
        for y in range(1, fh):
            for z in ((0,) if flush else (0, 1)):
                st = S.blocks.get((x, y, z), "")
                if z == 0 and "_log" in st and not flush:
                    continue                       # keep the frame posts standing
                S.blocks.pop((x, y, z), None)


def _post_smithy(hb, S):
    _open_front(hb, S)
    W, D = hb.spec["width"], hb.spec["depth"]
    back = D - 2
    S.set(2, 1, back, B("blast_furnace", facing="north", lit=True))
    S.set(3, 1, back, B("furnace", facing="north", lit=True))
    S.set(W // 2, 1, 2, B("anvil", facing="east"))
    S.set(W - 3, 1, back, B("grindstone", face="floor", facing="north"))
    S.set(W - 3, 1, 2, B("cauldron"))
    # forge chimney through the lean-to roof
    cx, cz = 1, back
    top = max([k[1] for k in S.blocks if k[0] == cx and k[2] == cz] + [hb.spec["floor_height"]])
    for y in range(1, top + 3):
        S.set(cx, y, cz, B(pick_u(patch_noise(cx, y, cz, hb.seeds["materials"], "chimney", 1), hb.p["chimney"])))
    S.set(cx, top + 3, cz, B("campfire", facing="north", lit=True, signal_fire=False, waterlogged=False))


def _post_stable(hb, S):
    _open_front(hb, S)
    W, D = hb.spec["width"], hb.spec["depth"]
    wood = hb._wood_stairs()[:-7]
    for x in range(1, W - 1):
        if "_log" not in S.blocks.get((x, 1, 0), ""):
            S.set(x, 1, 0, B(f"{wood}_fence_gate", facing="north", in_wall=False, open=False, powered=False))
    for z in range(2, D - 1):
        S.set(W // 2, 1, z, B(f"{wood}_fence", north=z > 2, south=z < D - 2, east=False, west=False, waterlogged=False))
    for x, y in ((1, 1), (1, 2), (2, 1), (W - 2, 1)):
        S.set(x, y, D - 2, B("hay_block", axis="y"))


def _post_woodshed(hb, S):
    _open_front(hb, S)
    W, D = hb.spec["width"], hb.spec["depth"]
    for x in range(1, W - 1):
        for z in range(max(2, D - 3), D - 1):
            for y in (1, 2):
                S.set(x, y, z, B("spruce_log", axis="z"))
        if x % 2:
            S.set(x, 3, D - 2, B("spruce_log", axis="z"))
    S.set(W // 2, 1, 1 if not hb.spec.get("flush_walls") else 1, B("oak_log", axis="y"))   # chopping block


def _post_storage(hb, S):
    D = hb.spec["depth"]
    S.set(1, 1, D - 2, B("barrel", facing="up", open=False))
    S.set(2, 1, D - 2, B("barrel", facing="up", open=False))


_LOCAL_POST = {"smithy": _post_smithy, "stable": _post_stable, "woodshed": _post_woodshed, "storage": _post_storage}


# ---------------------------------------------------------------- post-merge components
_BACK = {"north": "south", "south": "north", "east": "west", "west": "east"}
_DIRS = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}


def _outside_cell(door, main):
    (x, z), name = door["pos"], door["dir"]
    dx, dz = _DIRS[name]
    cx, cz = x + dx, z + dz
    while main.contains(cx, cz):
        cx, cz = cx + dx, cz + dz
    return cx, cz


def _lat(name):
    return (1, 0) if name in ("north", "south") else (0, 1)


def hb_trap(main):
    return main.hb.p["trapdoor"]


def add_hood(S, door, main):
    name = door["dir"]
    cx, cz = _outside_cell(door, main)
    lx, lz = _lat(name)
    wood = main.hb._wood_stairs()
    back = _BACK[name]
    # a thin stair hood over the door, held by two open-trapdoor brackets against the wall
    for t in (-1, 0, 1):
        S.blocks[(cx + lx * t, 3, cz + lz * t)] = B(wood, facing=back, half="bottom", shape="straight", waterlogged=False)
    trap = hb_trap(main)
    for t in (-1, 1):
        if (cx + lx * t, 2, cz + lz * t) not in S.blocks:
            S.blocks[(cx + lx * t, 2, cz + lz * t)] = B(trap, facing=name, half="top", open=False, powered=False, waterlogged=False)


def add_porch(S, door, main, rng):
    name = door["dir"]
    dx, dz = _DIRS[name]
    cx, cz = _outside_cell(door, main)
    lx, lz = _lat(name)
    hb = main.hb
    pd = rng.choice([2, 3])
    base = max(3, min(4, main.wall_top - 2))
    main = lambda e: e if isinstance(e, str) else max(e, key=lambda nw: nw[1])[0]
    stairs, full, slab = main(hb.p["roof_stairs"]), main(hb.p["roof_full"]), main(hb.p["roof_slab"])
    seed = hb.seeds["materials"]
    at = lambda r, t: (cx + dx * r + lx * t, cz + dz * r + lz * t)
    # floor + step
    for r in range(pd):
        for t in range(-2, 3):
            x, z = at(r, t)
            S.blocks[(x, 0, z)] = "minecraft:" + pick_u(patch_noise(x, 0, z, seed, "base", 2), hb.p["base"])
            for y in (1, 2, 3):
                st = S.blocks.get((x, y, z), "")
                if "_trapdoor" in st or "lantern" in st:
                    del S.blocks[(x, y, z)]
    x, z = at(pd, 0)
    S.blocks[(x, 0, z)] = B(hb._base_stairs(), facing=_BACK[name], half="bottom", shape="straight", waterlogged=False)
    # posts
    for t in (-2, 2):
        x, z = at(pd - 1, t)
        for y in range(1, base):
            S.blocks[(x, y, z)] = hb.log("post", "y")
    # little gable roof, ridge pointing outward; the last row is the overhang outline
    for r in range(pd + 1):
        cells = [(-2, 0, "s"), (2, 0, "s"), (-1, 1, "s"), (1, 1, "s"), (0, 2, "slab")]
        if r < pd:
            cells += [(-1, 0, "f"), (1, 0, "f"), (0, 0, "f"), (0, 1, "f")]
        for t, dy, kind in cells:
            x, z = at(r, t)
            if kind == "s":
                face = ("east" if t < 0 else "west") if lx else ("south" if t < 0 else "north")
                st = B(stairs, facing=face, half="bottom", shape="straight", waterlogged=False)
            elif kind == "slab":
                st = B(slab, type="bottom", waterlogged=False)
            elif r == pd - 1 and dy == 0:
                st = hb.log("beam", "x" if lx else "z")   # tie beam on top of the posts, in the roof's first course
            else:
                st = B(full)
            S.blocks[(x, base + dy, z)] = st


def add_oriel(S, main, vols, door, rng):
    hb, sp = main.hb, main.spec
    F, h = sp["floors"], sp["floor_height"]
    if F < 2:
        return False
    k = F - 1
    y0 = k * h
    j = k if sp["jetty"] else 0
    zo = -j - 1
    W0 = main.local_size[0]
    xs = frame_positions(0, W0 - 1, sp["post_spacing"])
    others = [v for v in vols if v is not main]
    bays = []
    for a, b in zip(xs, xs[1:]):
        n = b - a - 1
        if n < 3 or n > 5 or a < main.rect[0] or b > main.rect[1]:
            continue
        if any(v.rect[0] - 1 <= b and a <= v.rect[1] + 1 and v.rect[2] <= 0 for v in others):
            continue
        if door and door["dir"] == "north" and a - 3 <= door["pos"][0] <= b + 3:
            continue          # keep clear of the door's porch / hood
        bays.append((a, b))
    if not bays:
        return False
    mid = (main.rect[0] + main.rect[1]) / 2
    bays.sort(key=lambda ab: abs((ab[0] + ab[1]) / 2 - mid))
    a, b = bays[0] if rng.random() < 0.6 else rng.choice(bays)
    wood = hb._wood_stairs()
    glass = hb.window_block("x")
    seed = hb.seeds["materials"]
    for y in range(y0 + 1, y0 + h):
        for x in (a, b):
            S.blocks[(x, y, zo)] = hb.log("post", "y")
        for x in range(a + 1, b):
            if y == y0 + 1:
                S.blocks[(x, y, zo)] = "minecraft:" + pick_u(patch_noise(x, y, zo, seed, "infill_upper", 2), hb.p["infill_upper"]) \
                    if not isinstance(hb.p["infill_upper"], str) else B(hb.p["infill_upper"])
            else:
                S.blocks[(x, y, zo)] = glass
    for x in range(a, b + 1):
        S.blocks[(x, y0, zo)] = hb.log("beam", "x")
        S.blocks[(x, y0 - 1, zo)] = B(wood, facing="south", half="top", shape="straight", waterlogged=False)
        S.blocks[(x, y0 + h, zo)] = B(wood, facing="south", half="bottom", shape="straight", waterlogged=False)
    return True
