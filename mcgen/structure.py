"""Block structure container + Sponge Schematic (.schem, v2) writer. No dependencies."""
import gzip
import io
import struct


def B(name, **props):
    """Build a block state string, e.g. B('spruce_stairs', facing='north', half='bottom')."""
    if ":" not in name:
        name = "minecraft:" + name
    if not props:
        return name
    inner = ",".join(f"{k}={str(v).lower()}" for k, v in sorted(props.items()))
    return f"{name}[{inner}]"


class Structure:
    def __init__(self):
        self.blocks = {}

    def set(self, x, y, z, state):
        if state is None or state == "minecraft:air":
            self.blocks.pop((x, y, z), None)
        else:
            self.blocks[(x, y, z)] = state

    def set_if_empty(self, x, y, z, state):
        if (x, y, z) not in self.blocks:
            self.set(x, y, z, state)

    def get(self, x, y, z):
        return self.blocks.get((x, y, z))

    def bounds(self):
        xs, ys, zs = zip(*self.blocks.keys())
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

    # ---------------- .schem export ----------------
    def save_schem(self, path, data_version=3953):  # 3953 = Minecraft 1.21
        (x0, y0, z0), (x1, y1, z1) = self.bounds()
        W, H, L = x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1
        palette = {"minecraft:air": 0}
        data = bytearray()
        for y in range(H):
            for z in range(L):
                for x in range(W):
                    st = self.blocks.get((x + x0, y + y0, z + z0), "minecraft:air")
                    idx = palette.setdefault(st, len(palette))
                    while True:  # varint
                        b = idx & 0x7F
                        idx >>= 7
                        if idx:
                            data.append(b | 0x80)
                        else:
                            data.append(b)
                            break
        root = {
            "Version": ("int", 2),
            "DataVersion": ("int", data_version),
            "Width": ("short", W),
            "Height": ("short", H),
            "Length": ("short", L),
            "Offset": ("int_array", [0, 0, 0]),
            "PaletteMax": ("int", len(palette)),
            "Palette": ("compound", {k: ("int", v) for k, v in palette.items()}),
            "BlockData": ("byte_array", bytes(data)),
            "Metadata": ("compound", {"Generator": ("string", "mcgen-prototype")}),
        }
        buf = io.BytesIO()
        _write_named(buf, "compound", "Schematic", root)
        with gzip.open(path, "wb") as f:
            f.write(buf.getvalue())
        return W, H, L, len(palette)


_TAG = {"byte": 1, "short": 2, "int": 3, "long": 4, "float": 5, "double": 6,
        "byte_array": 7, "string": 8, "list": 9, "compound": 10, "int_array": 11}


def _write_str(buf, s):
    b = s.encode("utf-8")
    buf.write(struct.pack(">H", len(b)))
    buf.write(b)


def _write_named(buf, typ, name, value):
    buf.write(bytes([_TAG[typ]]))
    _write_str(buf, name)
    _write_payload(buf, typ, value)


def _write_payload(buf, typ, v):
    if typ == "byte":
        buf.write(struct.pack(">b", v))
    elif typ == "short":
        buf.write(struct.pack(">h", v))
    elif typ == "int":
        buf.write(struct.pack(">i", v))
    elif typ == "long":
        buf.write(struct.pack(">q", v))
    elif typ == "string":
        _write_str(buf, v)
    elif typ == "byte_array":
        buf.write(struct.pack(">i", len(v)))
        buf.write(v)
    elif typ == "int_array":
        buf.write(struct.pack(">i", len(v)))
        for i in v:
            buf.write(struct.pack(">i", i))
    elif typ == "compound":
        for k, (t, val) in v.items():
            _write_named(buf, t, k, val)
        buf.write(b"\x00")
    else:
        raise ValueError(typ)
