"""Parametric half-timber house built from reusable components.

Coordinates: x = width (east +), y = up, z = depth (south +). Front door faces north (-z).
The spec is the "LLM output" layer: high-level design decisions only.
Every block-level detail (depth, trims, block states) is handled here in code.
"""
import hashlib
import math
import random
import re

from .palettes import PALETTES
from .structure import B, Structure
from . import transform

DEFAULT_SPEC = {
    "palette": "medieval_timber",
    "width": 11,          # x, outer frame of ground floor
    "depth": 9,           # z
    "floors": 2,
    "floor_height": 4,    # beam-to-beam
    "jetty": True,        # each upper floor overhangs 1 block on the long sides
    "post_spacing": 5,
    "roof_overhang": 1,
    "roof_style": "gable",  # gable / gambrel / mansard / curved / saltbox / mono / clerestory / m_shaped / butterfly / elven / temple / magical
    "roof_pitch": "auto",   # low (台阶) / normal (楼梯) / steep (方块+楼梯) / auto
    "flared_eave": False,   # 飞檐: eave courses one pitch shallower
    "chimney": True,
    "ground": True,       # grass skirt + path + plants for context
    "seed": 1,             # master seed; split into independent streams (windows / materials / plants)
    "seeds": None,
    "eave_trim": "auto",   # 檐口下的倒置楼梯收边：auto = 只有陡坡双坡顶才加
    "underside_stairs": False,  # 屋顶底面用倒置楼梯补成斜面（默认不用，底面为满方块台阶，和山墙齐平）
    "colors": None,        # 指定颜色换色：{"roof": "#a83a2c", "wall": "米白", "wall_ground": ..., "frame": "深棕", "base": "灰"}
    "dormers": "auto",     # 老虎窗：auto = 由种子决定数量和位置 / 0 = 不加 / 数字 = 正面坡上的个数
    "dormer_style": "auto",
    "dormer_gap": "auto",  # 相邻老虎窗之间的间距（挑檐到挑檐的空格数）；auto = 均匀分布在整个坡面  # gable / steep / low / curved / mono / temple；auto = 由种子选一种
    "plan": "auto",        # 户型：auto / rect / longhouse / L / T / H / U / cross / cross_long（十字架 = X 型）
    "function": "dwelling",  # 功能：dwelling 住宅 / smithy 铁匠铺 / farm 农舍 / tavern 酒馆 / auto
    "annexes": "auto",     # 附属建筑：auto = 按功能随机 / [] 不加 / 列表指定，如 ["smithy", "porch", "oriel"]
    "rotation": 0,         # 斜向角度：0 / 12 / 15 / 20 / 26 / 33 / 45 / 57 / 64 / 70 / 75 / 78（见 transform.py）         # optional per-stream override, e.g. {"materials": 42}
}

OUT = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}


def derive_seed(seed, aspect):
    """Stable (process-independent) sub-seed for one aspect of the build."""
    return int.from_bytes(hashlib.sha256(f"{seed}:{aspect}".encode()).digest()[:8], "big")


def _h(*vals):
    """Deterministic hash of ints/strings -> float in [0, 1)."""
    d = hashlib.blake2b(repr(vals).encode(), digest_size=8).digest()
    return int.from_bytes(d, "big") / 2 ** 64


def patch_noise(x, y, z, seed, key, scale):
    """Uniform value per jittered cell: blocks cluster into irregular patches of about `scale`
    blocks, while the overall share of each material still follows the palette weights."""
    if scale <= 1:
        return _h(seed, key, x, y, z)
    j = [_h(seed, key, "j", a, x, y, z) * scale * 0.7 for a in range(3)]
    cell = (int((x + j[0]) // scale), int((y + j[1]) // scale), int((z + j[2]) // scale))
    return _h(seed, key, *cell)


def pick_u(u, entry):
    total = sum(w for _, w in entry)
    r = u * total
    for name, w in entry:
        r -= w
        if r < 0:
            return name
    return entry[-1][0]


def frame_positions(a, b, spacing):
    L = b - a
    n = max(1, int(L / spacing + 0.5))
    return sorted({a + round(k * L / n) for k in range(n + 1)})


def ring(x0, x1, z0, z1):
    for x in range(x0, x1 + 1):
        yield x, z0
        yield x, z1
    for z in range(z0 + 1, z1):
        yield x0, z
        yield x1, z


class HouseBuilder:
    def __init__(self, spec):
        self.spec = {**DEFAULT_SPEC, **spec}
        self.p = PALETTES[self.spec["palette"]]
        from .colors import apply_colors
        self.p, self.color_report = apply_colors(self.p, self.spec.get("colors"))
        # One master seed, split into independent streams so changing one aspect (e.g. window
        # rules) never reshuffles another (e.g. wall weathering). "seeds" can override any stream.
        seeds = {a: derive_seed(self.spec["seed"], a) for a in ("windows", "materials", "plants", "dormers")}
        seeds.update({a: derive_seed(v, a) for a, v in (self.spec.get("seeds") or {}).items()})
        self.seeds = seeds
        self.rng = random.Random(seeds["windows"])          # facade decisions
        self.rng_plants = random.Random(seeds["plants"])    # ground plants
        self.rng_dormers = random.Random(seeds["dormers"])  # dormer count / positions
        self.S = Structure()

    # ---- helpers -------------------------------------------------------
    def m(self, slot):
        """Material for a palette slot. Mixed slots return a placeholder that is resolved after
        building from the block's position (seeded, clustered noise), see resolve_materials()."""
        entry = self.p[slot]
        return entry if isinstance(entry, str) else "@" + slot

    # slots that should share the same patches (a dark patch on the roof covers stairs and blocks alike)
    NOISE_GROUP = {"roof_stairs": "roof", "roof_full": "roof", "roof_slab": "roof"}
    # patch size in blocks per slot group: larger = bigger, calmer patches
    NOISE_SCALE = {"roof": 3, "ground": 3, "base": 2, "infill_ground": 2, "infill_upper": 2, "chimney": 1}

    def resolve_materials(self):
        """Replace slot placeholders by real blocks. Plain slots: clustered weighted noise. Slots with a
        mix config (spec colors as dicts): position-based styles over a dark -> light ramp."""
        pat = re.compile(r"minecraft:@([a-z_]+)")
        mixes = self.p.get("_mix", {})
        todo = [(pos, st, pat.search(st).group(1)) for pos, st in self.S.blocks.items() if "@" in st]
        ctx = self._mix_context(todo, mixes) if mixes else {}
        for pos, st, slot in todo:
            entry = self.p[slot]
            if slot in mixes and not isinstance(entry, str):
                i = self._mix_index(pos, slot, mixes[slot], ctx, len(entry))
                name = entry[i][0]
            else:
                group = self.NOISE_GROUP.get(slot, slot)
                u = patch_noise(*pos, self.seeds["materials"], group, self.NOISE_SCALE.get(group, 2))
                name = pick_u(u, entry)
            self.S.blocks[pos] = pat.sub("minecraft:" + name, st)

    # ---- position-based mixing --------------------------------------------------
    def _mix_context(self, todo, mixes):
        """Extents per mix group and the opening cells (windows / doors) for weathering."""
        ext = {}
        for (x, y, z), _, slot in todo:
            g = mixes.get(slot, {}).get("group")
            if g is None:
                continue
            e = ext.setdefault(g, [x, x, y, y, z, z])
            e[0], e[1] = min(e[0], x), max(e[1], x)
            e[2], e[3] = min(e[2], y), max(e[3], y)
            e[4], e[5] = min(e[4], z), max(e[5], z)
        openings = {k for k, v in self.S.blocks.items() if "glass" in v or "_door[" in v}
        return {"ext": ext, "open": openings}

    @staticmethod
    def _ease(t, curve):
        if curve == "ease_in":
            return t * t
        if curve == "ease_out":
            return 1 - (1 - t) ** 2
        if curve == "ease_in_out":
            return t * t * (3 - 2 * t)
        return t

    def _mix_index(self, pos, slot, cfg, ctx, n):
        x, y, z = pos
        seed = self.seeds["materials"]
        g = cfg["group"]
        x0, x1, y0, y1, z0, z1 = ctx["ext"].get(g, (x, x, y, y, z, z))
        hy = (y - y0) / max(1, y1 - y0)
        jit = float(cfg.get("jitter", 0.35))
        scale = max(1, int(cfg.get("scale", 2)))
        clump = patch_noise(x, y, z, seed, "mix:" + g, scale)          # 0..1, clustered
        fine = patch_noise(x, y, z, seed, "mixf:" + g, 1)
        style = cfg["style"]
        if style in ("cluster", "speckle"):
            u = clump if style == "cluster" else fine
            entry = self.p[slot]
            return [k for k, (nm, _) in enumerate(entry) if nm == pick_u(u, entry)][0]
        if style == "bottom_dark" or style == "eave_dark":
            t = hy
        elif style == "top_dark" or style == "ridge_dark":
            t = 1 - hy
        elif style == "horizontal":
            along = (x - x0) / max(1, x1 - x0) if (x1 - x0) >= (z1 - z0) else (z - z0) / max(1, z1 - z0)
            t = along
        else:   # weathered: dark at the base, at corners, around openings and in drip lines under windows
            dark = (1 - hy) ** 2 * 0.9
            corner = min(abs(x - x0), abs(x - x1)) <= 0 or min(abs(z - z0), abs(z - z1)) <= 0
            cx = min(abs(x - x0), abs(x - x1)) <= 1 and min(abs(z - z0), abs(z - z1)) <= 1
            if cx:
                dark = max(dark, 0.6)
            op = ctx["open"]
            near = any((x + dx, y + dy, z + dz) in op for dx in (-1, 0, 1) for dz in (-1, 0, 1) for dy in (-1, 0, 1))
            if near:
                dark = max(dark, 0.55)
            if any((x + dx, y + dy, z + dz) in op for dy in (1, 2, 3) for dx, dz in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))):
                dark = max(dark, 0.7 - 0.1 * min(dy for dy in (1, 2, 3)
                                                if any((x + dx, y + dy, z + dz) in op for dx, dz in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))))
            t = 1 - dark
            t = 0.55 * t + 0.45 * clump          # weathered surfaces are still clustered, not banded
        t = self._ease(min(1.0, max(0.0, t)), cfg.get("curve", "linear"))
        t += jit * (clump - 0.5)                  # ragged, clumpy band edges (no "sandwich" stripes)
        if cfg.get("curve") == "step":
            t = round(t * (n - 1)) / max(1, n - 1)
        i = int(round(min(1.0, max(0.0, t)) * (n - 1)))
        skip = float(cfg.get("skip", 0) or 0)
        if skip and fine < skip:                  # occasional step skip for local contrast
            i = min(n - 1, max(0, i + (2 if fine < skip / 2 else -2)))
        return i

    def log(self, slot, axis):
        return B(self.p[slot], axis=axis)

    # ---- components ----------------------------------------------------
    def foundation(self, rect):
        x0, x1, z0, z1 = rect
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                self.S.set(x, 0, z, B(self.m("base")))

    def storey(self, k, outer, y0, h, infill_slot, front_door):
        S, p = self.S, self.p
        storey_k = k
        x0, x1, z0, z1 = outer
        ix0, ix1, iz0, iz1 = x0 + 1, x1 - 1, z0 + 1, z1 - 1
        # Angled houses use flush walls: posts and infill share one plane. A one-block recess turns
        # into diagonal offsets once the walls step, leaving posts floating beside the wall.
        flush = bool(self.spec.get("flush_walls"))
        sp = self.spec["post_spacing"]
        xs = frame_positions(x0, x1, sp)
        zs = frame_positions(z0, z1, sp)

        # ordered (dict as an ordered set): iteration order must not depend on hashing, so the JS port
        # inserts blocks in exactly the same order
        posts = dict.fromkeys([(x, z0) for x in xs] + [(x, z1) for x in xs] + [(x0, z) for z in zs] + [(x1, z) for z in zs])
        # single 1-wide corner post (a 2-wide L corner reads as too heavy for half-timber)
        corner_fill = set()
        for cx, cz, dx, dz in [(x0, z0, 1, 1), (x1, z0, -1, 1), (x0, z1, 1, -1), (x1, z1, -1, -1)]:
            corner_fill |= {(cx + dx, cz), (cx, cz + dz)}
        corner_fill -= set(posts)
        if flush:
            corner_fill = set()

        # floor (whole inner rect), sill beam ring at y0 where nothing below already
        for x in range(ix0, ix1 + 1):
            for z in range(iz0, iz1 + 1):
                S.set_if_empty(x, y0, z, B(p["floor"]))
        for x in range(ix0 + 1, ix1):
            for z in range(iz0 + 1, iz1):
                S.set(x, y0, z, B(p["floor"]))
        for x, z in ring(x0, x1, z0, z1):
            S.set_if_empty(x, y0, z, self.log("beam", "x" if z in (z0, z1) else "z"))

        # recessed infill wall on the inner ring; timber posts on the outer ring
        for y in range(y0 + 1, y0 + h):
            for x, z in (ring(x0, x1, z0, z1) if flush else ring(ix0, ix1, iz0, iz1)):
                S.set(x, y, z, B(self.m(infill_slot)))
            for x, z in posts:
                S.set(x, y, z, self.log("post", "y"))
        # cells beside a corner post stay empty: the post stands alone, recessed walls meet behind it
        self._corner_gaps = corner_fill
        # top beam ring
        for x, z in ring(x0, x1, z0, z1):
            S.set(x, y0 + h, z, self.log("beam", "x" if z in (z0, z1) else "z"))
        for x, z in posts:
            if (x in (x0, x1)) and (z in (z0, z1)):
                S.set(x, y0 + h, z, self.log("post", "y"))

        # ---- facades: decide per bay whether it gets the door, a window or stays plain wall
        sides = [
            ("north", xs, z0, iz0, "x"),
            ("south", xs, z1, iz1, "x"),
            ("west", zs, x0, ix0, "z"),
            ("east", zs, x1, ix1, "z"),
        ]
        center_x = (x0 + x1) / 2
        plan = []   # (side, outer_c, inner_c, along, inner_cells, outer_cells, role)
        OUTSIDE = {"north": -1, "west": -1, "south": 1, "east": 1}
        for side, ps, outer_c, inner_c, along in sides:
            if flush:   # openings sit in the single wall plane; sills/shutters hang one block outside
                lo, hi = (x0, x1) if along == "x" else (z0, z1)
                inner_c = outer_c
            else:
                lo, hi = (ix0, ix1) if along == "x" else (iz0, iz1)
            bays = []
            for a, b in zip(ps, ps[1:]):
                inner = [c for c in range(a + 1, b) if lo < c < hi]
                outer = [c for c in range(a + 1, b) if self._xyz(along, c, outer_c) not in corner_fill]
                if outer:
                    bays.append((inner, outer))
            door_bay = None
            if front_door and side == "north" and bays:
                door_bay = min(range(len(bays)), key=lambda i: (abs(sum(bays[i][1]) / len(bays[i][1]) - center_x), -len(bays[i][1])))
            for bi, (inner, outer) in enumerate(bays):
                if bi == door_bay:
                    role = "door"
                elif len(inner) >= 3 and self.rng.random() < self.WINDOW_P[side]:
                    role = "window"
                else:
                    role = "frame"
                plan.append([side, outer_c, inner_c, along, inner, outer, role, OUTSIDE[side]])
        # light guarantee: >=1 window on the front per storey, >=2 per storey overall
        eligible = [b for b in plan if b[6] == "frame" and len(b[4]) >= 3]
        front = [b for b in eligible if b[0] == "north"]
        if front and not any(b[6] == "window" and b[0] == "north" for b in plan):
            self.rng.choice(front)[6] = "window"
        eligible = [b for b in plan if b[6] == "frame" and len(b[4]) >= 3]
        while sum(b[6] == "window" for b in plan) < 2 and eligible:
            b = self.rng.choice(eligible); b[6] = "window"; eligible.remove(b)

        for side, outer_c, inner_c, along, inner, outer, role, out_d in plan:
            deco_c = outer_c + out_d if flush else outer_c   # plane for sills and shutters
            used = set()
            if role == "door":
                dc = inner[(len(inner) - 1) // 2]
                self.door(dc, y0, inner_c, outer_c)
                used |= {dc}
            elif role == "window":
                n_in = len(inner)
                w = 1 if n_in % 2 else 2
                if n_in >= 7 and n_in % 2:
                    w = 3
                start = inner[(n_in - w) // 2]
                cols = list(range(start, start + w))
                shutters = (n_in - w) >= 4
                self.window(side, cols, y0, h, inner_c, deco_c, along, posts, shutters)
                used |= set(cols) | ({cols[0] - 1, cols[-1] + 1} if shutters else set())

        # jetty corbels: under posts on overhanging sides
        if storey_k > 0 and self.spec["jetty"]:
            for x in xs:
                S.set(x, y0 - 1, z0, B(self._wood_stairs(), facing="south", half="top", shape="straight", waterlogged=False))
                S.set(x, y0 - 1, z1, B(self._wood_stairs(), facing="north", half="top", shape="straight", waterlogged=False))
        return posts

    # Window probability per facade: front most, back less, gable sides least.
    # Bays that don't get a window stay plain infill. A storey always keeps a minimum of light
    # (>=1 window on the front, >=2 overall).
    WINDOW_P = {"north": 0.7, "south": 0.45, "west": 0.35, "east": 0.35}

    def _wood_stairs(self):
        if self.p.get("wood_stairs"):
            return self.p["wood_stairs"]
        wood = self.p["post"].replace("stripped_", "").replace("_log", "").replace("_stem", "")
        return f"{wood}_stairs"

    @staticmethod
    def _is_post(posts, along, c, outer_c):
        return ((c, outer_c) if along == "x" else (outer_c, c)) in posts

    def _xyz(self, along, c, plane):
        return (c, plane) if along == "x" else (plane, c)

    def window_block(self, along):
        """Glass pane normally; full glass block on angled houses: a pane only connects to its four
        side neighbours, so on a stepped wall it leaves see-through gaps at every step."""
        if self.spec.get("flush_walls"):
            return B("glass")
        return B(self.p["window"], **({"east": True, "west": True, "north": False, "south": False} if along == "x"
                                      else {"north": True, "south": True, "east": False, "west": False}), waterlogged=False)

    def window(self, side, cols, y0, h, inner_c, outer_c, along, posts, shutters=True):
        S, p = self.S, self.p
        pane = self.window_block(along)
        for c in cols:
            for y in range(y0 + 2, y0 + h):
                x, z = self._xyz(along, c, inner_c)
                S.set(x, y, z, pane)
            # sill: closed top-half trapdoor on the outer plane
            x, z = self._xyz(along, c, outer_c)
            S.set(x, y0 + 1, z, B(p["trapdoor"], facing=side, half="top", open=False, powered=False, waterlogged=False))
        # shutters: open trapdoors beside the window, against the wall (only if the bay has room)
        for c in ((cols[0] - 1, cols[-1] + 1) if shutters else ()):
            if self._is_post(posts, along, c, outer_c):
                continue
            for y in range(y0 + 2, y0 + h):
                x, z = self._xyz(along, c, outer_c)
                if S.get(x, y, z) is not None or (x, z) in self._corner_gaps:
                    continue
                S.set(x, y, z, B(p["trapdoor"], facing=side, half="bottom", open=True, powered=False, waterlogged=False))

    def door(self, x, y0, inner_z, outer_z):
        S, p = self.S, self.p
        S.set(x, y0 + 1, inner_z, B(p["door"], facing="north", half="lower", hinge="left", open=False, powered=False))
        S.set(x, y0 + 2, inner_z, B(p["door"], facing="north", half="upper", hinge="left", open=False, powered=False))
        # front step
        S.set(x, 0, outer_z - 1, B(self._base_stairs(), facing="south", half="bottom", shape="straight", waterlogged=False))
        self.door_x = x

    def _base_stairs(self):
        if self.p.get("base_stairs"):
            return self.p["base_stairs"]
        return {"medieval_timber": "cobblestone_stairs", "taiga_cabin": "cobbled_deepslate_stairs",
                "oak_cottage": "stone_brick_stairs"}.get(self.spec["palette"], "cobblestone_stairs")

    # ---- roof ----------------------------------------------------------
    # A roof is a cross-section across the span (z), the same for every x along the ridge.
    # Each column c of the cross-section is described by the height of its two halves
    # (L = north half, R = south half), in half-blocks above the wall top. One generic rasterizer
    # turns that into blocks:
    #   |L-R| = 0  flat      -> full block (even) / bottom slab (odd)
    #   |L-R| = 1  台阶坡     -> bottom or top slab (a top slab is filled solid except on the gable edge)
    #   |L-R| >= 2 楼梯坡     -> stair facing up-slope, full blocks below
    # Every column is filled down to its lower neighbour's top cell (no diagonal-only joints), and
    # sloped columns get an upside-down stair underneath (补平).
    RISE = {"low": 1, "normal": 2, "steep": 4}           # half-blocks per column for the basic pitches
    FLARE = {4: 2, 2: 1}                                 # flared eave: one pitch shallower
    ROOF_STYLES = {
        "gable":      "双坡（按 roof_pitch：缓坡台阶 / 标准楼梯 / 陡坡方块+楼梯）",
        "gambrel":    "复折 / 谷仓顶：下段陡、上段缓",
        "mansard":    "孟莎顶：四周近乎竖直，顶部平",
        "curved":     "拱顶：圆弧剖面",
        "saltbox":    "盐盒顶：不对称，一侧短陡、一侧长缓",
        "mono":       "单坡顶：附属建筑、披屋",
        "clerestory": "高侧窗顶：两段单坡错开，中间一段带窗的竖墙",
        "m_shaped":   "M 形双峰顶",
        "butterfly":  "蝴蝶顶：中间低、两侧高",
        "elven":      "精灵顶：檐口缓、越往上越陡（内凹）",
        "temple":     "神庙顶：缓坡加陡顶（内凹，较矮）",
        "magical":    "魔法顶：内凹，顶部收成尖塔",
    }

    def resolve_pitch(self, span):
        pitch = self.spec.get("roof_pitch", "auto")
        if pitch != "auto":
            return pitch
        if span >= 17:
            return "low"
        if span <= 13:
            return "steep"
        return "normal"

    @staticmethod
    def _sym(rises, span):
        """Symmetric cross-section from the rises of one side (eave -> ridge)."""
        n = span // 2
        g = [0]
        for r in rises[:n]:
            g.append(g[-1] + r)
        cols = [(g[i], g[i + 1]) for i in range(n)]
        if span % 2:
            cols.append((g[n], g[n]))
        cols += [(R, L) for (L, R) in reversed(cols[:n])]
        return cols

    @staticmethod
    def _bands(n, parts):
        """Split n columns into consecutive bands by fractions; each band gets its rise."""
        out, used = [], 0
        for i, (frac, rise) in enumerate(parts):
            k = n - used if i == len(parts) - 1 else max(1, round(n * frac))
            k = min(k, n - used)
            out += [rise] * k
            used += k
        return out

    def roof_columns(self, span, pitch=None, style=None, flare=None):
        """Return (cols, meta). cols: list of (L, R) half-block heights for z = Z0 .. Z1."""
        style = style or self.spec.get("roof_style", "gable")
        pitch = pitch or self.resolve_pitch(span)
        r = self.RISE[pitch]
        n = span // 2
        meta = {"cap": False, "wall_cols": set()}
        use_flare = self.spec.get("flared_eave") if flare is None else flare
        flare_cols = self.spec["roof_overhang"] + 1 if use_flare else 0
        flare = lambda rises: [self.FLARE.get(x, x) if i < flare_cols else x for i, x in enumerate(rises)]

        if style == "gable":
            cols = self._sym(flare([r] * n), span); meta["cap"] = True
            if r == 1 and span % 2:            # low pitch: the ridge is one half-step higher (pointed, not flat)
                H = cols[n][0] + 1
                cols[n] = (H, H)
        elif style == "gambrel":
            cols = self._sym(self._bands(n, [(0.5, 4), (0.5, 2)]), span); meta["cap"] = True
        elif style == "mansard":
            cols = self._sym(self._bands(n, [(0.25, 6), (0.15, 2), (0.6, 0)]), span)
        elif style == "curved":
            Hc = 2 * max(2, round(n * 0.85))
            g = [round(Hc * math.sqrt(max(0.0, 1 - ((n - i) / n) ** 2))) for i in range(n + 1)]
            cols = self._sym([g[i + 1] - g[i] for i in range(n)], span)
        elif style in ("elven", "temple", "magical"):
            parts = {"elven": [(0.34, 1), (0.33, 2), (0.33, 4)],
                     "temple": [(0.5, 1), (0.5, 2)],
                     "magical": [(0.3, 1), (0.25, 2), (0.3, 4), (0.15, 8)]}[style]
            cols = self._sym(self._bands(n, parts), span); meta["cap"] = style != "magical"
        elif style == "saltbox":
            # short side (north): stairs, about one third of the span; long side: half-block steps
            k = max(2, round(span / 3))
            m = span - k
            H = m                                       # long side drops half a block per column
            g = [round(H * i / k) for i in range(k + 1)]
            g += [H - j for j in range(1, m + 1)]
            cols = [(g[i], g[i + 1]) for i in range(span)]
        elif style == "mono":
            rr = max(1, r // 2) if pitch != "low" else 1   # sheds stay low: 1 or 2 half-blocks per column
            cols = [(i * rr, (i + 1) * rr) for i in range(span)]
            meta["thin"] = rr == 1
        elif style == "clerestory":
            k = max(3, round(span * 0.55))             # lower slope, then a 3-block window wall, then upper slope
            low = [(i, i + 1) for i in range(k)]
            top = k + 6
            m = span - k
            high = [(top - j, top - j - 1) for j in range(m)]
            cols = low + high
            meta["wall_cols"] = {k}
        elif style == "m_shaped":
            a = span // 2
            cols = self._sym([r] * (a // 2), a) + self._sym([r] * ((span - a) // 2), span - a)
            meta["cap"] = True
        elif style == "butterfly":
            n2 = span // 2
            H = n2 * max(1, r // 2) + 2
            g = [H - i * max(1, r // 2) for i in range(n2 + 1)]
            half = [(g[i], g[i + 1]) for i in range(n2)]
            cols = half + ([(g[n2], g[n2])] if span % 2 else []) + [(R, L) for (L, R) in reversed(half)]
        else:
            raise ValueError(f"未知屋顶样式 {style}，可选：{list(self.ROOF_STYLES)}")
        return cols, meta

    def raster_roof(self, cols, meta):
        """Turn (L, R) columns into cells: list of {dy: kind}, with kind in
        stair_s / stair_n / ustair_s / ustair_n / full / slab_bottom / slab_top / wall."""
        thin = meta.get("thin", False)
        top, extra = [], []
        for L, R in cols:
            hi, lo = max(L, R), min(L, R)
            d = hi - lo
            more = {}
            if d <= 1:
                # half-block steps. Thick band (缓坡): one block thick, alternating a full block (even top)
                # and a top slab + bottom slab pair offset by half a block (odd top).
                # Thin (单坡): a single slab per column, bottom / top alternating.
                if hi % 2 == 0:
                    ty, kind = max(hi // 2 - 1, 0), ("slab_top" if thin and hi > 0 else "full")
                else:
                    ty, kind = (hi - 1) // 2, "slab_bottom"
                    if not thin and ty - 1 >= 0:
                        more[ty - 1] = "slab_top"
            else:
                up = "s" if R > L else "n"
                ty, kind = ((hi - 1) // 2, "slab_bottom") if hi % 2 else (hi // 2 - 1, "stair_" + up)
            top.append((ty, kind))
            extra.append(more)
        out = []
        for c, ((L, R), (ty, kind)) in enumerate(zip(cols, top)):
            cells = {ty: kind, **extra[c]}
            d = abs(L - R)
            nb = [top[j][0] for j in (c - 1, c + 1) if 0 <= j < len(top)]
            # fill down to the lower neighbour's top cell, and on steep columns at least down to the
            # low half's own height (near-vertical mansard / curved sides start at the wall top).
            # Half-step bands are already watertight and keep their thickness.
            if d <= 1 and not any(abs(top[j][0] - ty) > 1 for j in (c - 1, c + 1) if 0 <= j < len(top)):
                low = min(cells)
            else:
                low = min([min(cells)] + nb + ([max(0, min(L, R) // 2)] if d >= 2 else []))
            fill = "wall" if c in meta["wall_cols"] else "full"
            for y in range(low, ty):
                cells.setdefault(y, fill)
            d = abs(L - R)
            if (self.spec.get("underside_stairs") and d >= 2 and low - 1 >= 0
                    and c not in meta["wall_cols"]):
                cells[low - 1] = "ustair_" + ("n" if R > L else "s")   # optional, faces down-slope
            if meta["cap"] and kind == "full" and nb and all(t < ty for t in nb):
                cells[ty + 1] = "slab_bottom"                         # ridge cap
            out.append(cells)
        return out

    def roof_height(self, span, pitch=None):
        """Ridge height above the wall top, in blocks (half-block precision; odd spans add the cap)."""
        cols, _ = self.roof_columns(span, pitch)
        return max(max(L, R) for L, R in cols) / 2 + (0.5 if span % 2 else 0)

    def gable_roof(self, rect, yb):
        """Ridge along x; any roof style; overhang on all sides; walls filled up to the roof underside."""
        S, p = self.S, self.p
        x0, x1, z0, z1 = rect
        ov = self.spec["roof_overhang"]
        X0, X1, Z0, Z1 = x0 - ov, x1 + ov, z0 - ov, z1 + ov
        span = Z1 - Z0 + 1
        pitch = self.resolve_pitch(span)
        self.roof_pitch = pitch
        cols, meta = self.roof_columns(span, pitch)
        cells = self.raster_roof(cols, meta)
        face = {"s": "south", "n": "north"}
        pane = self.window_block("x")

        def block(kind, edge, x):
            if kind.startswith("stair_"):
                return B(self.m("roof_stairs"), facing=face[kind[-1]], half="bottom", shape="straight", waterlogged=False)
            if kind.startswith("ustair_"):
                # underside stairs only on the overhang rows; on the gable wall use the wall infill, inside a full block,
                # otherwise each stair's open corner leaves a notch in the gable face
                if x in (x0, x1):          # on the gable face: wall material, so the gable reads as one surface
                    return B(self.m("infill_upper"))
                if x0 < x < x1:
                    return B(self.m("roof_full"))
                return B(self.m("roof_stairs"), facing=face[kind[-1]], half="top", shape="straight", waterlogged=False)
            if kind == "slab_bottom":
                return B(self.m("roof_slab"), type="bottom", waterlogged=False)
            if kind == "slab_top":
                if x0 <= x <= x1:        # gable plane and inside: full roof block (a top slab would leave a
                    return B(self.m("roof_full"))   # half-block hole in the gable; its top face is roof surface)
                return B(self.m("roof_slab"), type="top", waterlogged=False)
            if kind == "wall":   # clerestory: window every other block along the ridge
                return pane if (x0 < x < x1 and (x - x0) % 2 == 1) else B(self.m("infill_upper"))
            return B(self.m("roof_full"))

        bottom_at, top_y = {}, yb
        for c, cc in enumerate(cells):
            z = Z0 + c
            bottom_at[z] = yb + min(cc)
            for x in range(X0, X1 + 1):
                edge = x in (X0, X1)
                for dy, kind in cc.items():
                    if kind == "wall" and not (x0 <= x <= x1):
                        continue
                    S.set(x, yb + dy, z, block(kind, edge, x))
            top_y = max(top_y, yb + max(cc))
        # eave trim (upside-down stair under the eave edge): off by default, only steep roofs get it
        trim = self.spec.get("eave_trim", "auto")
        trim = (pitch == "steep" and self.spec.get("roof_style", "gable") == "gable") if trim == "auto" else bool(trim)
        for zz, out in (((Z0, "north"), (Z1, "south")) if trim else ()):
            if bottom_at[zz] == yb:
                for x in range(X0, X1 + 1):
                    S.set(x, yb - 1, zz, B(self.m("roof_stairs"), facing=out, half="top", shape="straight", waterlogged=False))
        # long walls: fill up to the roof where the eave is high (mono, saltbox, butterfly, ...)
        for zw in (z0, z1):
            for x in range(x0, x1 + 1):
                for y in range(yb, bottom_at[zw]):
                    S.set(x, y, zw, B(self.m("infill_upper")))

        # gable ends at x0 and x1: infill up to the roof underside, king post, windows
        zc = (Z0 + Z1) // 2
        gpane = self.window_block("z")
        for gx in (x0, x1):
            for z in range(z0, z1 + 1):
                for y in range(yb, bottom_at[z]):
                    S.set(gx, y, z, B(self.m("infill_upper")))
            # king post only: the storey's top beam right below already acts as the tie beam,
            # a second horizontal log here would stack into a 2-block-thick band
            for y in range(yb, bottom_at[zc]):
                S.set(gx, y, zc, self.log("post", "y"))
            for wy, offs in ((yb + 2, (-2, 2)), (yb + 5, (-1, 1)), (yb + 8, (-1, 1))):
                for o in offs:
                    z = zc + o
                    out = z + (1 if o > 0 else -1)
                    if z0 < z < z1 and wy <= bottom_at[z] - 2 and wy <= bottom_at[out] - 1:
                        S.set(gx, wy, z, gpane)
        top_y = max(top_y, self.dormers(rect, yb, Z0, Z1, cells))
        return (X0, X1, Z0, Z1), top_y

    # ---- dormers (老虎窗) ------------------------------------------------
    # A dormer is a small roof: (roof_style, roof_pitch, front-wall width). Its cross-section comes
    # from the same roof_columns() / raster_roof() as the main roof, laid across x instead of z.
    DORMER_STYLES = {
        "gable":  ("gable", "normal", 3),   # 标准坡
        "steep":  ("gable", "steep", 3),    # 陡坡
        "low":    ("gable", "low", 5),      # 缓坡（台阶），更宽
        "curved": ("curved", "normal", 5),  # 拱形
        "mono":   ("mono", "normal", 3),    # 单坡
        "temple": ("temple", "normal", 5),  # 神庙式（内凹）
    }

    def dormer_profile(self, key):
        style, pitch, wall = self.DORMER_STYLES[key]
        span = wall + 2                                  # one block of overhang each side
        cols, meta = self.roof_columns(span, pitch, style, flare=False)
        cells = self.raster_roof(cols, meta)
        return wall, span, cells

    def dormers(self, rect, yb, Z0, Z1, cells):
        """Small roofs standing on the main slopes, ridge perpendicular to the main ridge.
        Front wall of posts + glass set into the slope, mini roof of any listed style with one block
        of overhang, side cheeks down to the main roof; it runs back into the slope until the main
        roof surface covers its top."""
        want = self.spec.get("dormers", "auto")
        if not want:
            return yb
        x0, x1, z0, z1 = rect
        surf = {Z0 + c: yb + max(cc) for c, cc in enumerate(cells)}
        chimney_x = x0 + 2 if self.spec.get("chimney") else None
        key = self.spec.get("dormer_style", "auto")
        if key == "auto":   # one style per house, seeded
            key = self.rng_dormers.choice(["gable", "gable", "steep", "low", "curved", "mono", "temple"])
        wall, span, dcells = self.dormer_profile(key)
        top = max(max(c) for c in dcells)               # mini roof height above its first course
        wall_h = 2                                       # 2-tall window

        def plan(side):
            d = 1 if side == "north" else -1
            zs = list(range(z0, z1 + 1)) if d == 1 else list(range(z1, z0 - 1, -1))
            for zf in zs:
                ys = surf[zf]
                if ys - yb < 1:
                    continue
                cap = ys + wall_h + top
                z, n = zf, 0
                while z in surf and surf[z] < cap:
                    z += d; n += 1
                if z not in surf or n > 7 or n < 2:
                    continue
                return d, zf, ys, z
            return None

        half = span // 2
        for side in ("north", "south"):
            pl = plan(side)
            if not pl:
                continue
            d, zf, ys, zend = pl
            if want == "auto":
                n = self.rng_dormers.choice([0, 1, 1, 2] if side == "north" else [0, 0, 1])
            else:
                n = int(want) if side == "north" else 0
            gap = self.spec.get("dormer_gap", "auto")
            usable = (x1 - 1) - (x0 + 1) + 1            # dormers stay off the gable-end columns
            g = 1 if gap == "auto" else max(0, int(gap))
            n = min(n, (usable + g) // (span + g))
            if n <= 0:
                continue
            centers = []
            if gap == "auto":
                # spread evenly over the slope with a seeded wobble, at least 1 block apart
                for i in range(n):
                    cx = x0 + round((i + 1) * (x1 - x0) / (n + 1)) + self.rng_dormers.choice([-1, 0, 0, 1])
                    cx = min(max(cx, x0 + half + 1), x1 - half - 1)
                    if chimney_x is not None and abs(cx - chimney_x) <= half:
                        continue
                    if any(a <= cx + half and cx - half <= b for a, b in self.spec.get("dormer_avoid", ())):
                        continue
                    if all(abs(cx - o) >= span + 1 for o in centers):
                        centers.append(cx)
            else:
                # a group with exactly `gap` blocks between neighbouring dormers (overhang to overhang),
                # centred on the slope; a dormer that would hit the chimney is dropped
                total = n * span + (n - 1) * g
                start = x0 + 1 + (usable - total) // 2 + half
                for i in range(n):
                    cx = start + i * (span + g)
                    if chimney_x is not None and abs(cx - chimney_x) <= half:
                        continue
                    if any(a <= cx + half and cx - half <= b for a, b in self.spec.get("dormer_avoid", ())):
                        continue
                    centers.append(cx)
            for cx in centers:
                self._dormer(cx, d, zf, ys, zend, surf, wall, span, dcells, wall_h)
        return yb

    def _dormer(self, cx, d, zf, ys, zend, surf, wall, span, dcells, wall_h):
        S, p = self.S, self.p
        out = "north" if d == 1 else "south"
        t = ys + wall_h                                  # first mini-roof course
        half, wh = span // 2, wall // 2
        xs = [cx - half + c for c in range(span)]
        wall_x = range(cx - wh, cx + wh + 1)
        side_x = (cx - wh, cx + wh)
        glass = self.window_block("x")
        post = self.log("post", "y")
        bottom = {x: t + min(dcells[c]) for c, x in enumerate(xs)}    # mini roof underside per column

        def roof_block(kind):
            face = {"s": "east", "n": "west"}
            if kind.startswith("stair_"):
                return B(self.m("roof_stairs"), facing=face[kind[-1]], half="bottom", shape="straight", waterlogged=False)
            if kind.startswith("ustair_"):
                return B(self.m("roof_stairs"), facing=face[kind[-1]], half="top", shape="straight", waterlogged=False)
            if kind == "slab_bottom":
                return B(self.m("roof_slab"), type="bottom", waterlogged=False)
            if kind == "slab_top":
                return B(self.m("roof_slab"), type="top", waterlogged=False)
            return B(self.m("roof_full"))

        # body behind the front wall: cut the main roof out, side cheeks, hollow inside
        for z in range(zf + d, zend, d):
            for x in wall_x:
                for y in range(ys, bottom[x]):
                    if x in side_x:
                        S.set(x, y, z, B(self.m("infill_upper")))
                    else:
                        S.blocks.pop((x, y, z), None)
        # mini roof, row by row; the overhang row in front keeps only each column's top cell (outline)
        for z in range(zf - d, zend, d):
            for c, x in enumerate(xs):
                cc = dcells[c]
                keys = [max(cc)] if z == zf - d else list(cc)
                for dy in keys:
                    y = t + dy
                    if y >= surf[z]:
                        S.set(x, y, z, roof_block(cc[dy]))
        # front wall: wood and glass. Side posts run up to the roof, the middle is glass up to the roof
        for x in wall_x:
            for y in range(ys, bottom[x]):
                S.set(x, y, zf, post if x in side_x else glass)
        if wall >= 5:   # wide dormers: a middle mullion post keeps the glass from reading as one sheet
            for y in range(ys, bottom[cx]):
                S.set(cx, y, zf, post)
        # sill: bottom-half trapdoor sitting low in the cell in front of the window
        for x in wall_x:
            if x not in side_x and (wall < 5 or x != cx):
                S.set(x, ys, zf - d, B(p["trapdoor"], facing=out, half="bottom", open=False, powered=False, waterlogged=False))

    def chimney(self, rect, roof_rect, ridge_y):
        x0, x1, z0, z1 = rect
        cx = x0 + 2
        cz = (z0 + z1) // 2 + 2
        for y in range(1, ridge_y + 3):
            self.S.set(cx, y, cz, B(self.m("chimney")))
        self.S.set(cx, ridge_y + 3, cz, B("campfire", facing="north", lit=True, signal_fire=False, waterlogged=False))

    def ground(self, rect):
        x0, x1, z0, z1 = rect
        pad = 3
        for x in range(x0 - pad, x1 + pad + 1):
            for z in range(z0 - pad - 1, z1 + pad + 1):
                self.S.set(x, -1, z, B(self.m("ground")))
        self.resolve_materials()   # plants are only placed on real grass blocks
        # path from door
        dx = getattr(self, "door_x", (x0 + x1) // 2)
        for z in range(z0 - pad - 1, z0 - 1):
            self.S.set(dx, -1, z, B(self.p["path"]))
        # scattered plants on grass, not right against walls or path
        plants = ["short_grass", "short_grass", "short_grass", "poppy", "dandelion", "cornflower", "fern"]
        for (x, y, z), st in sorted(self.S.blocks.items()):
            if y != -1 or "grass_block" not in st:
                continue
            if x0 - 1 <= x <= x1 + 1 and z0 - 2 <= z <= z1 + 1:
                continue
            if self.rng_plants.random() < 0.18 and self.S.get(x, 0, z) is None:
                self.S.set(x, 0, z, B(self.rng_plants.choice(plants)))
        # lantern hanging under the jetty by the door
        if self.spec["floors"] > 1 and self.spec["jetty"]:
            self.S.set(dx, self.spec["floor_height"] - 1, z0 - 1, B("lantern", hanging=True, waterlogged=False))

    # ---- assemble -------------------------------------------------------
    def build(self):
        s = self.spec
        W, D, F, h = s["width"], s["depth"], s["floors"], s["floor_height"]
        ground_rect = (0, W - 1, 0, D - 1)
        self.foundation(ground_rect)
        rect = ground_rect
        for k in range(F):
            j = k if s["jetty"] else 0
            rect = (0, W - 1, -j, D - 1 + j)
            self.storey(k, rect, k * h, h, "infill_ground" if k == 0 else "infill_upper", front_door=(k == 0 and s.get("front_door", True)))
        top_y = F * h
        roof_rect, ridge_y = self.gable_roof(rect, top_y + 1)
        if s["chimney"]:
            self.chimney(rect, roof_rect, ridge_y)
        if s["ground"]:
            self.ground(ground_rect)
        self.resolve_materials()
        return self.S


def build_house(spec):
    S = _build_house(spec)
    bury_covered_stairs(S)
    merge_ridge_ends(S)
    stair_shapes(S)
    return S


# ---- stair corner shapes, computed exactly like the game (StairBlock.getStairsShape) --------------
_STEP = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}
_OPP = {"north": "south", "south": "north", "west": "east", "east": "west"}
_CCW = {"north": "west", "west": "south", "south": "east", "east": "north"}
_STAIR = re.compile(r"^(minecraft:[a-z_]+_stairs)\[(.*)\]$")


def _stair(st):
    m = st and _STAIR.match(st)
    if not m:
        return None
    return dict(kv.split("=") for kv in m.group(2).split(","))


_WOODS = ("oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "bamboo", "crimson",
          "warped", "pale_oak")


def full_of_stairs(name):
    """minecraft:x_stairs -> the matching full block id."""
    b = name[len("minecraft:"):-len("_stairs")]
    if b in _WOODS:
        return f"minecraft:{b}_planks"
    try:
        from .colors import OPTIONS
        for o in OPTIONS["roof"]:
            if o["roles"].get("roof_stairs") == name[len("minecraft:"):]:
                return "minecraft:" + o["roles"]["roof_full"]
    except Exception:
        pass
    for a, f in (("_brick", "_bricks"), ("_tile", "_tiles")):
        if b.endswith(a):
            return f"minecraft:{b[:-len(a)]}{f}"
    return {"brick": "minecraft:bricks", "quartz": "minecraft:quartz_block", "purpur": "minecraft:purpur_block"}.get(b, "minecraft:" + b)


def bury_covered_stairs(S):
    """A bottom stair with a solid roof block straight on top of it is buried inside the roof (where a
    wing roof runs over the main roof, or a dormer sits on a slope). Fill it: its hollow quarter would
    show as a notch from the side, and while it stays a stair it stops the visible stair next to it
    from turning into a corner."""
    for (x, y, z), st in list(S.blocks.items()):
        p = _stair(st)
        if not p or p["half"] != "bottom":
            continue
        above = S.blocks.get((x, y + 1, z), "")
        ab = _stair(above)
        solid_above = (ab is not None and ab["half"] == "bottom") or (above and "[" not in above and "air" not in above
                       and "glass" not in above and "leaves" not in above) or "type=bottom" in above or "type=double" in above
        if solid_above:
            S.blocks[(x, y, z)] = full_of_stairs(st.split("[")[0])


def _solid_full(st):
    return bool(st) and "[" not in st and "air" not in st and "glass" not in st and "leaves" not in st


def merge_ridge_ends(S):
    """Where a wing ridge or a dormer top runs into a roof slope, the slope stairs in line with it
    (solid roof behind them) stop the valley stairs on either side from turning into inner corners.
    Replace that run with full blocks, so the ridge visibly continues into the slope and both
    valleys close."""
    info = {pos: p for pos, st in S.blocks.items() if (p := _stair(st))}
    done = set()

    def ok(q, f, bx, bz):
        o = info.get(q)
        return o is not None and o["facing"] == f and o["half"] == "bottom" and o.get("shape", "straight") == "straight" \
            and _solid_full(S.blocks.get((q[0] + bx, q[1], q[2] + bz)))

    for pos, p in info.items():
        if pos in done:
            continue
        f = p["facing"]
        bx, bz = _STEP[_OPP[f]]
        if not ok(pos, f, bx, bz):
            continue
        d1, d2 = [d for d in _STEP if d not in (f, _OPP[f])]
        run, ends = [pos], {}
        for d in (d1, d2):
            dx, dz = _STEP[d]
            q = (pos[0] + dx, pos[1], pos[2] + dz)
            while ok(q, f, bx, bz) and len(run) < 7:
                run.append(q)
                q = (q[0] + dx, q[1], q[2] + dz)
            ends[d] = q
        done.update(run)
        valley = 0
        for d, q in ends.items():           # flank: same slope stair whose back is a wing stair rising toward the run
            o = info.get(q)
            bk = info.get((q[0] + bx, q[1], q[2] + bz))
            if o and o["facing"] == f and o["half"] == "bottom" and bk and bk["half"] == "bottom" and bk["facing"] == _OPP[d]:
                valley += 1
        if valley == 2:
            for q in run:
                S.blocks[q] = full_of_stairs(S.blocks[q].split("[")[0])


def stair_shapes(S):
    """Pasted schematics keep whatever shape is stored (WorldEdit / Litematica don't update blocks),
    so set inner / outer corners the way the game itself would on the next block update."""
    info = {pos: p for pos, st in S.blocks.items() if (p := _stair(st))}

    def at(pos, d):
        dx, dz = _STEP[d]
        return info.get((pos[0] + dx, pos[1], pos[2] + dz))

    def can_take(pos, p, d):
        o = at(pos, d)
        return o is None or o["facing"] != p["facing"] or o["half"] != p["half"]

    for pos, p in info.items():
        f, shape = p["facing"], "straight"
        front = at(pos, f)
        if front and front["half"] == p["half"] and (front["facing"] in (f, _OPP[f])) is False \
                and can_take(pos, p, _OPP[front["facing"]]):
            shape = "outer_left" if front["facing"] == _CCW[f] else "outer_right"
        else:
            back = at(pos, _OPP[f])
            if back and back["half"] == p["half"] and back["facing"] not in (f, _OPP[f]) \
                    and can_take(pos, p, back["facing"]):
                shape = "inner_left" if back["facing"] == _CCW[f] else "inner_right"
        if p.get("shape", "straight") != shape:
            p2 = {**p, "shape": shape}
            name = S.blocks[pos].split("[")[0]
            S.blocks[pos] = name + "[" + ",".join(f"{k}={p2[k]}" for k in sorted(p2)) + "]"


def _build_house(spec):
    s = {**DEFAULT_SPEC, **spec}
    if not s.get("_direct") and (s.get("plan", "rect") != "rect" or s.get("annexes")):
        from .layout import build_layout
        return build_layout(s)
    angle = s.get("rotation", 0) or 0
    if angle:
        w, d = transform.local_footprint(s["width"], s["depth"], angle)
        s = {**s, "width": w, "depth": d, "flush_walls": True}
    hb = HouseBuilder(s)
    S = transform.rotate(hb.build(), angle)
    if angle:
        seal_doors(S, hb)
    return S


_SIDES = {"north": ((1, 0), (-1, 0)), "south": ((1, 0), (-1, 0)), "east": ((0, 1), (0, -1)), "west": ((0, 1), (0, -1))}


_SEAL_SKIP = re.compile(r"_door|glass|_pane|_bars|_stairs|_slab|trapdoor|fence|lantern|torch|leaves|_carpet|_sign|flower|_wall\b|_wall\[")


def _wall_like(S, cands):
    """The filler copies the wall it patches: the first neighbour that is a plain wall block."""
    for c in cands:
        st = S.blocks.get(c)
        if st and not _SEAL_SKIP.search(st):
            return st
    return None


def seal_doors(S, hb):
    """On a stepped wall the cell beside a door can fall on the step and stay empty, leaving an
    open slot next to the door. Fill both sides of the door (and the cell above it) with stone."""
    stone = hb.p["base"]
    base = lambda x, y, z: "minecraft:" + pick_u(patch_noise(x, y, z, hb.seeds["materials"], "base", 2), stone)
    cx = cz = cn = 0
    for (x, y, z) in S.blocks:
        if y >= 1:
            cx += x; cz += z; cn += 1
    for (x, y, z), st in list(S.blocks.items()):
        if "_door[" not in st or "half=lower" not in st:
            continue
        facing = re.search(r"facing=(\w+)", st).group(1)
        ax = facing in ("north", "south")
        d = (z * cn - cz) if ax else (x * cn - cx)
        out = (d > 0) - (d < 0)
        fx, fz = (0, out) if ax else (out, 0)
        for dx, dz in _SIDES[facing]:
            for yy in (y, y + 1):
                # a cell backed by wall on the inside and open outside would stick out as a post
                if out and (x + dx - fx, yy, z + dz - fz) in S.blocks and (x + dx + fx, yy, z + dz + fz) not in S.blocks:
                    continue
                sx, sz = x + dx, z + dz
                if (sx, yy, sz) not in S.blocks:
                    S.blocks[(sx, yy, sz)] = _wall_like(S, [(sx + fx, yy, sz + fz), (sx - fx, yy, sz - fz), (sx + dx, yy, sz + dz), (sx + dx + fx, yy, sz + dz + fz), (sx + dx - fx, yy, sz + dz - fz)]) or base(sx, yy, sz)
        if (x, y + 2, z) not in S.blocks:
            S.blocks[(x, y + 2, z)] = _wall_like(S, [(x + dx, y + 2, z + dz) for dx, dz in _SIDES[facing]] + [(x, y + 3, z)]) or base(x, y + 2, z)
