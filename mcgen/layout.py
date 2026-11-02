"""Multi-volume houses (体块组合): L / T / H / U / cross / cross_long (十字架 = X) / longhouse.

Every volume is an ordinary HouseBuilder house built in its own local frame (ridge along local x,
long side "north" = local front), then quarter-turned and moved into place. Volumes are merged with
a few rules so they read as one building:

  1. Dominance: the volume with the higher roof wins (ties: role rank, end cross-wings > main >
     middle wings > annexes). Lower volumes are placed first, higher ones override them.
  2. Perpendicular joint: a lower volume that runs into a higher one is cut off at the higher
     volume's ridge line, on the far side. Its roof then disappears under the higher roof and the
     two slopes meet in a valley. A lower volume that passes through on both sides is not cut
     (cross plans), its roof simply intersects the other roof.
  3. Parallel joint (longhouse byre): the lower volume is cut where it enters the higher one.
  4. Interior clearing: inside each volume's rooms (below its wall top) only its own blocks stay,
     so joined volumes open into each other with no stray walls, floors or roof bits.
  5. Windows that end up inside another volume, or face straight into another volume's blocks,
     become wall. Shutters, sills and lanterns of one volume inside another are removed.
  6. Door, chimney and ground are placed once for the whole house.
"""
import random

from . import transform
from .house import DEFAULT_SPEC, HouseBuilder, derive_seed, patch_noise, pick_u, seal_doors
from .structure import B, Structure

PLANS = ["rect", "longhouse", "L", "T", "H", "cross", "cross_long"]
PLAN_LABEL = {"rect": "长方形", "longhouse": "长屋（一字形 + 牲口棚）", "L": "L 型", "T": "T 型",
              "H": "H 型", "U": "H 型（只向后凸出）", "cross": "十字", "cross_long": "十字架（X 型）"}
RANK = {"tower": 3, "cross_wing": 2, "main": 1, "wing": 0, "cross": 0, "byre": -1, "annex": -2}
WINGS = ("main", "wing", "cross_wing", "cross")
QUARTER = {"north": 0, "east": 1, "south": 2, "west": 3}


class Volume:
    def __init__(self, role, rect, axis, front, **over):
        self.role, self.rect, self.axis, self.front, self.over = role, rect, axis, front, over
        self.rank = RANK[role]
        self.kind = role
        self.post = None

    @property
    def local_size(self):
        x0, x1, z0, z1 = self.rect
        return (x1 - x0 + 1, z1 - z0 + 1) if self.axis == "x" else (z1 - z0 + 1, x1 - x0 + 1)

    def ridge_line(self):
        x0, x1, z0, z1 = self.rect
        return (z0 + z1) / 2 if self.axis == "x" else (x0 + x1) / 2

    def contains(self, x, z, strict=False):
        x0, x1, z0, z1 = self.rect
        if strict:
            return x0 < x < x1 and z0 < z < z1
        return x0 <= x <= x1 and z0 <= z <= z1


def _parity(n, ref):
    return n if n % 2 == ref % 2 else n + 1


def choose_plan(spec, rng):
    W, D = spec["width"], spec["depth"]
    if W < 13:
        opts = [("rect", 3), ("L", 3), ("T", 1), ("longhouse", 1)]
    else:
        opts = [("rect", 2), ("L", 3), ("T", 2), ("longhouse", 1), ("H", 2), ("cross", 1), ("cross_long", 1)]
    total = sum(w for _, w in opts)
    r = rng.random() * total
    for name, w in opts:
        r -= w
        if r < 0:
            return name
    return opts[-1][0]


def plan_volumes(spec, plan, rng):
    """Return (main_width, volumes). Footprints are ground rects in global coords; main is
    (0..W-1, 0..D-1), ridge along x, front (door side) north."""
    W, D, F = spec["width"], spec["depth"], spec["floors"]
    vols = []

    def end_wing(right, pf, pb, wd):
        x0 = W - wd if right else 0
        return Volume("cross_wing", (x0, x0 + wd - 1, -pf, D - 1 + pb), "z", "east" if right else "west", floors=F)

    if plan == "L":
        wd = _parity(rng.choice([D, D + 2]), D)
        W = max(W, wd + 7)
        pf, pb = rng.randint(3, 6), rng.choice([0, 0, 1, 2])
        vols.append(end_wing(rng.random() < 0.5, pf, pb, wd))
    elif plan in ("H", "U"):       # "U" kept as an alias: an H whose wings only project backwards
        wd = _parity(rng.choice([D, D + 2]), D)
        W = max(W, 2 * wd + 5)
        if plan == "U":
            pf, pb = 0, rng.randint(4, 7)
        else:
            # seeded projections; at least one side clearly projects. pf = 0 gives the U-like variant
            pf, pb = rng.choice([0, 2, 3, 4, 5]), rng.choice([0, 2, 3, 4, 5])
            if max(pf, pb) < 3:
                pb = rng.randint(3, 5)
        vols += [end_wing(False, pf, pb, wd), end_wing(True, pf, pb, wd)]
    elif plan == "T":
        wd = _parity(max(5, D - rng.choice([2, 4])), D)
        W = max(W, wd + 8)
        cx = W // 2 + rng.choice([-2, -1, 0, 0, 1, 2])
        x0 = cx - wd // 2
        if rng.random() < 0.7:     # rear wing (the usual T)
            pb = rng.randint(4, 8)
            vols.append(Volume("wing", (x0, x0 + wd - 1, 0, D - 1 + pb), "z", "east", floors=max(1, F - rng.choice([0, 1]))))
        else:                      # gabled wing projecting to the street
            pf = rng.randint(3, 5)
            vols.append(Volume("wing", (x0, x0 + wd - 1, -pf, D - 1), "z", "east", floors=F))
    elif plan == "cross":
        a = rng.randint(3, 5)
        W = D + 2 * a
        vols.append(Volume("cross", (a, a + D - 1, -a, D - 1 + a), "z", "east", floors=F))
    elif plan == "cross_long":
        a = rng.randint(3, 4)
        b = rng.randint(2 * a + 1, 3 * a + 1)
        W = b + D + a
        if rng.random() < 0.5:     # long arm left or right
            vols.append(Volume("cross", (b, b + D - 1, -a, D - 1 + a), "z", "east", floors=F))
        else:
            vols.append(Volume("cross", (a, a + D - 1, -a, D - 1 + a), "z", "east", floors=F))
    elif plan == "longhouse":
        bl = rng.randint(5, 8)
        db = _parity(max(5, D - rng.choice([0, 2])), D)
        dz = (D - db) // 2
        vols.append(Volume("byre", (W - 1, W - 1 + bl, dz, dz + db - 1), "x", "north",
                           floors=1, jetty=False,
                           floor_height=spec["floor_height"] if F > 1 else max(3, spec["floor_height"] - 1)))
    main = Volume("main", (0, W - 1, 0, D - 1), "x", "north")
    return W, [main] + vols


def _rotate_q(blocks, q):
    for _ in range(q % 4):
        blocks = {(-z, y, x): transform._rot90_state(st) for (x, y, z), st in blocks.items()}
    return blocks


def build_volume(vol, spec, idx):
    Wl, Dl = vol.local_size
    seeds = dict(spec.get("seeds") or {})
    if idx:
        seeds.setdefault("windows", f"{spec['seed']}:{vol.role}{idx}")
        seeds.setdefault("dormers", f"{spec['seed']}:{vol.role}{idx}")
    vs = {**spec, "width": Wl, "depth": Dl, "plan": "rect", "rotation": 0, "ground": False,
          "chimney": False, "front_door": False, "dormers": 0, "seeds": seeds, **vol.over}
    if vs.get("floors", 1) < 2:
        vs["jetty"] = False
    hb = HouseBuilder(vs)
    S = hb.build()
    if vol.post:
        vol.post(hb, S)
    q = QUARTER[vol.front]
    blocks = _rotate_q(S.blocks, q)
    # where did the local ground rect go?
    corners = _rotate_q({(0, 0, 0): "a", (Wl - 1, 0, Dl - 1): "b"}, q)
    mx = min(k[0] for k in corners)
    mz = min(k[2] for k in corners)
    ox, oz = vol.rect[0] - mx, vol.rect[2] - mz
    vol.blocks = {(x + ox, y, z + oz): st for (x, y, z), st in blocks.items()}
    vol.hb = hb
    vol.wall_top = vs["floors"] * vs["floor_height"]
    vol.top = max(k[1] for k in vol.blocks)
    vol.spec = vs
    return vol


def _crop(lower, higher):
    """Cut the lower volume where it runs into a higher one (rules 2 and 3)."""
    if lower.axis == higher.axis or lower.role not in WINGS or higher.role not in WINGS:
        # parallel joint, or an annex / tower: drop everything strictly inside the higher volume
        lower.blocks = {k: v for k, v in lower.blocks.items() if not higher.contains(k[0], k[2], strict=True)}
        return
    r = higher.ridge_line()
    ax = 2 if higher.axis == "x" else 0          # coordinate across the higher ridge
    along = 0 if higher.axis == "x" else 2
    hx0, hx1, hz0, hz1 = higher.rect
    lo_al, hi_al = ((hx0, hx1) if along == 0 else (hz0, hz1))
    x0, x1, z0, z1 = lower.rect
    a0, a1 = (z0, z1) if ax == 2 else (x0, x1)
    h0, h1 = (hz0, hz1) if ax == 2 else (hx0, hx1)
    before, after = a0 < h0, a1 > h1             # does the lower volume stick out on each side?
    if before and after:
        return                                    # passes through: intersecting roofs, no cut
    keep_low = before or not after
    def keep(k):
        if not (lo_al - 2 <= k[along] <= hi_al + 2):
            return True
        return k[ax] <= r if keep_low else k[ax] >= r
    lower.blocks = {k: v for k, v in lower.blocks.items() if keep(k)}
    # the lower volume's rooms now end at the ridge line
    x0, x1, z0, z1 = lower.rect
    ri = int(r)
    if ax == 0:
        lower.rect = (x0, min(x1, ri), z0, z1) if keep_low else (max(x0, -(-r // 1)), x1, z0, z1)
    else:
        lower.rect = (x0, x1, z0, min(z1, ri)) if keep_low else (x0, x1, max(z0, -(-r // 1)), z1)
    lower.rect = tuple(int(c) for c in lower.rect)


def _is_window(st):
    return "glass" in st


def _is_decor(st):
    return any(t in st for t in ("_trapdoor", "lantern"))


def build_layout(spec):
    from .annex import resolve_annexes, plan_annex_volumes, LEAN_TOS
    s = {**DEFAULT_SPEC, **spec}
    rng = random.Random(derive_seed(s["seed"], "layout"))
    arng = random.Random(derive_seed(s["seed"], "annexes"))
    plan = s.get("plan", "auto")
    if plan == "auto":
        plan = choose_plan(s, rng)
    kinds = resolve_annexes(s, arng)
    angle = s.get("rotation", 0) or 0
    if plan == "rect" and not kinds:
        return HouseBuilder_rect(s)
    if angle:
        w, d = transform.local_footprint(s["width"], s["depth"], angle)
        s = {**s, "width": w, "depth": d, "flush_walls": True}
    if plan == "rect":
        W, vols = s["width"], [Volume("main", (0, s["width"] - 1, 0, s["depth"] - 1), "x", "north")]
    else:
        W, vols = plan_volumes(s, plan, rng)
    s = {**s, "width": W}
    placed = plan_annex_volumes(s, kinds, vols, arng, Volume)
    # dormers only on the main block, kept clear of everything attached to it
    avoid = [(v.rect[0] - 2, v.rect[1] + 2) for v in vols[1:] if v.role != "annex"]
    vols[0].over.update(dormers=spec.get("dormers", DEFAULT_SPEC["dormers"]), dormer_avoid=avoid)
    for i, v in enumerate(vols):
        build_volume(v, s, i)
    main = vols[0]

    # 1-3: dominance and cropping
    order = sorted(vols, key=lambda v: (v.top, v.rank))
    for i, lo in enumerate(order):
        for hi in order[i + 1:]:
            if _overlap(lo, hi):
                _crop(lo, hi)

    # merge, lower first
    S = Structure()
    origin = {}
    for v in order:
        for k, st in v.blocks.items():
            S.blocks[k] = st
            origin[k] = v

    # 4: interior clearing
    for v in vols:
        x0, x1, z0, z1 = v.rect
        for k in list(S.blocks):
            x, y, z = k
            if 1 <= y < v.wall_top and x0 < x < x1 and z0 < z < z1 and origin[k] is not v:
                if k in v.blocks:            # v's own block was overridden here: put it back
                    S.blocks[k] = v.blocks[k]
                    origin[k] = v
                else:
                    del S.blocks[k]
                    origin.pop(k, None)

    # 5: covered windows / stray decor
    for k, st in list(S.blocks.items()):
        v = origin.get(k)
        if v is None:
            continue
        x, y, z = k
        others = [w for w in vols if w is not v and w.contains(x, z) and y <= w.top]
        if _is_decor(st) and others:
            # drop it, but give the cell back to another volume that has a block here (its wall)
            under = next((w for w in reversed(order) if w is not v and k in w.blocks), None)
            if under is not None:
                S.blocks[k] = under.blocks[k]; origin[k] = under
            else:
                del S.blocks[k]; origin.pop(k, None)
            continue
        if _is_window(st):
            faced = any(origin.get((x + dx, y, z + dz)) not in (None, v)
                        and not v.contains(x + dx, z + dz) for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if others or faced:
                slot = "infill_ground" if y < v.spec["floor_height"] else "infill_upper"
                u = patch_noise(x, y, z, v.hb.seeds["materials"], slot, 2)
                S.blocks[k] = "minecraft:" + pick_u(u, v.hb.p[slot]) if not isinstance(v.hb.p[slot], str) else B(v.hb.p[slot])

    # 6: door, porch / hood, oriel, chimney, ground
    hb = main.hb
    door = place_door(S, origin, main, vols)
    from .annex import add_hood, add_porch, add_oriel
    if door:
        under_jetty = door["dir"] == "north" and main.spec.get("jetty") and main.spec["floors"] > 1
        if under_jetty:
            x, z = door["pos"]
            S.blocks[(x, main.spec["floor_height"] - 1, -1)] = B("lantern", hanging=True, waterlogged=False)
        if "porch" in kinds and not under_jetty:
            add_porch(S, door, main, arng); placed.append("porch")
        elif "hood" in kinds and not under_jetty:
            add_hood(S, door, main); placed.append("hood")
    if "oriel" in kinds and add_oriel(S, main, vols, door, arng):
        placed.append("oriel")
    if s.get("chimney", True):
        place_chimney(S, main, [v for v in vols if v.role != "annex"], rng)
    if s.get("ground", True):
        place_ground(S, vols, hb, door["step"] + (door["dir"],) if door else None)
    S.layout = {"plan": plan, "annexes": placed, "function": s.get("function", "dwelling"),
                "volumes": [(v.kind, v.rect, v.axis, v.spec["floors"], v.spec["floor_height"]) for v in vols]}

    if angle:
        S = transform.rotate(S, angle)
        seal_doors(S, hb)
        S.layout = {"plan": plan, "annexes": placed, "function": s.get("function", "dwelling")}
    return S


def HouseBuilder_rect(s):
    from .house import build_house
    return build_house({**s, "plan": "rect", "_direct": True})


def _overlap(a, b):
    ax0, ax1, az0, az1 = a.rect
    bx0, bx1, bz0, bz1 = b.rect
    return ax0 <= bx1 and bx0 <= ax1 and az0 <= bz1 and bz0 <= az1


DIRS = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}
_NOT_WALL = ("_log", "_door", "_trapdoor", "_stairs", "_slab", "lantern", "glass_pane", "campfire")


def place_door(S, origin, main, vols):
    """Front door on an exposed ground-floor wall that opens into a room. Prefers the main
    volume's street (north) side near its middle, then its other sides, then other volumes."""
    others = [v for v in vols if v is not main]
    inside_any = lambda x, z: any(v.contains(x, z, strict=True) for v in vols)
    on_or_in = lambda x, z: any(v.contains(x, z) for v in vols)
    mx = (main.rect[0] + main.rect[1]) / 2
    best = None
    for (x, y, z), st in S.blocks.items():
        if y != 1 or any(t in st for t in _NOT_WALL) or "glass" in st:
            continue
        up = S.blocks.get((x, 2, z), "")
        if not up or any(t in up for t in _NOT_WALL):
            continue
        v = origin.get((x, y, z))
        if v is None:
            continue
        for name, (dx, dz) in DIRS.items():
            if not inside_any(x - dx, z - dz) or (x - dx, 1, z - dz) in S.blocks:
                continue                                  # must open into a room
            # walk outward through an optional recess to open air outside every footprint
            cx, cz, ok = x + dx, z + dz, False
            for _ in range(2):
                if (cx, 1, cz) in S.blocks or (cx, 2, cz) in S.blocks:
                    break
                if not on_or_in(cx, cz):
                    ok = True
                    break
                cx, cz = cx + dx, cz + dz
            if not ok:
                continue
            # posts either side of a recess are fine; the door cell itself must be wall
            score = (0 if v is main else 2) + (0 if name == "north" else 1) + abs(x - mx) * 0.05
            if best is None or score < best[0]:
                best = (score, x, z, name)
    if best is None:
        return None
    _, x, z, name = best
    dx, dz = DIRS[name]
    p = main.hb.p
    S.blocks[(x, 1, z)] = B(p["door"], facing=name, half="lower", hinge="left", open=False, powered=False)
    S.blocks[(x, 2, z)] = B(p["door"], facing=name, half="upper", hinge="left", open=False, powered=False)
    # clear sills / shutters in front, step down from the foundation
    cx, cz = x + dx, z + dz
    for _ in range(3):
        for lat in (-1, 0, 1):
            lx, lz = (cx + lat, cz) if dz else (cx, cz + lat)
            for yy in (1, 2, 3):
                if "_trapdoor" in S.blocks.get((lx, yy, lz), ""):
                    del S.blocks[(lx, yy, lz)]
        if (cx, 0, cz) not in S.blocks:
            back = {"north": "south", "south": "north", "east": "west", "west": "east"}[name]
            S.blocks[(cx, 0, cz)] = B(main.hb._base_stairs(), facing=back, half="bottom", shape="straight", waterlogged=False)
            break
        cx, cz = cx + dx, cz + dz
    return {"pos": (x, z), "dir": name, "step": (cx, cz)}


def place_chimney(S, main, vols, rng):
    D = main.rect[3] + 1
    others = [v for v in vols if v is not main]
    xs = [x for x in range(main.rect[0] + 2, main.rect[1] - 1) if not any(v.rect[0] - 1 <= x <= v.rect[1] + 1 for v in others)]
    if not xs:
        return
    x = rng.choice([xs[0], xs[-1], xs[len(xs) // 2]])
    z = D // 2 + 1
    top = max([k[1] for k in S.blocks if k[0] == x and k[2] == z] + [main.wall_top])
    p, seed = main.hb.p, main.hb.seeds["materials"]
    for y in range(1, top + 3):
        S.blocks[(x, y, z)] = "minecraft:" + pick_u(patch_noise(x, y, z, seed, "chimney", 1), p["chimney"])
    S.blocks[(x, top + 3, z)] = B("campfire", facing="north", lit=True, signal_fire=False, waterlogged=False)


def place_ground(S, vols, hb, door_x):
    xs = [v.rect[0] for v in vols] + [v.rect[1] for v in vols]
    zs = [v.rect[2] for v in vols] + [v.rect[3] for v in vols]
    pad = 3
    p, seed = hb.p, hb.seeds["materials"]
    for x in range(min(xs) - pad, max(xs) + pad + 1):
        for z in range(min(zs) - pad - 1, max(zs) + pad + 1):
            if (x, -1, z) not in S.blocks:
                S.blocks[(x, -1, z)] = "minecraft:" + pick_u(patch_noise(x, -1, z, seed, "ground", 3), p["ground"])
    if door_x is not None:
        cx, cz, name = door_x
        dx, dz = DIRS[name]
        for i in range(1, pad + 2):
            S.blocks[(cx + dx * i, -1, cz + dz * i)] = B(p["path"])
    near = lambda x, z: any(v.rect[0] - 1 <= x <= v.rect[1] + 1 and v.rect[2] - 2 <= z <= v.rect[3] + 1 for v in vols)
    plants = ["short_grass", "short_grass", "short_grass", "poppy", "dandelion", "cornflower", "fern"]
    for (x, y, z), st in sorted(S.blocks.items()):
        if y == -1 and "grass_block" in st and not near(x, z) and (x, 0, z) not in S.blocks:
            if hb.rng_plants.random() < 0.18:
                S.blocks[(x, 0, z)] = B(hb.rng_plants.choice(plants))
