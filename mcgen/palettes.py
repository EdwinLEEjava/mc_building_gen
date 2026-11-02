"""Hand-tuned palettes. The LLM only picks one by name; it never invents block combos.

Each slot is a weighted list so large surfaces get subtle texture variation
instead of one flat material.
"""

PALETTES = {
    # Classic medieval half-timber: stone ground floor, plaster upper floor, spruce roof
    "medieval_timber": {
        "post": "dark_oak_log",
        "beam": "stripped_dark_oak_log",
        "base": [("cobblestone", 5), ("stone", 3), ("mossy_cobblestone", 2), ("andesite", 2)],
        "infill_ground": [("stone_bricks", 6), ("cracked_stone_bricks", 1), ("mossy_stone_bricks", 2)],
        "infill_upper": [("calcite", 6), ("white_terracotta", 2), ("diorite", 1)],
        "floor": "dark_oak_planks",
        "roof_stairs": "spruce_stairs",
        "roof_full": "spruce_planks",
        "roof_slab": "spruce_slab",
        "trapdoor": "spruce_trapdoor",
        "door": "spruce_door",
        "window": "glass_pane",
        "chimney": [("bricks", 3), ("stone_bricks", 2), ("cobblestone", 1)],
        "ground": [("grass_block", 30), ("coarse_dirt", 1)],
        "path": "dirt_path",
    },
    # Northern / taiga cabin: dark wood, deepslate roof, stone base
    "taiga_cabin": {
        "post": "spruce_log",
        "beam": "stripped_spruce_log",
        "base": [("cobbled_deepslate", 4), ("stone", 2), ("tuff", 2), ("cobblestone", 2)],
        "infill_ground": [("spruce_planks", 6), ("stripped_spruce_wood", 1)],
        "infill_upper": [("spruce_planks", 6), ("stripped_spruce_wood", 1)],
        "floor": "dark_oak_planks",
        "roof_stairs": [("deepslate_tile_stairs", 12), ("deepslate_brick_stairs", 1)],
        "roof_full": [("deepslate_tiles", 12), ("cracked_deepslate_tiles", 1)],
        "roof_slab": "deepslate_tile_slab",
        "trapdoor": "spruce_trapdoor",
        "door": "spruce_door",
        "window": "glass_pane",
        "chimney": [("cobbled_deepslate", 3), ("stone", 1), ("tuff", 1)],
        "ground": [("grass_block", 25), ("podzol", 1)],
        "path": "dirt_path",
    },
    # Bright cottage: oak frame, warm plaster, red-brown roof
    "oak_cottage": {
        "post": "oak_log",
        "beam": "stripped_oak_log",
        "base": [("stone_bricks", 4), ("andesite", 2), ("cobblestone", 2)],
        "infill_ground": [("smooth_sandstone", 5), ("sandstone", 1), ("birch_planks", 1)],
        "infill_upper": [("white_terracotta", 4), ("calcite", 1)],
        "floor": "oak_planks",
        "roof_stairs": [("brick_stairs", 12), ("granite_stairs", 1)],
        "roof_full": [("bricks", 12), ("granite", 1)],
        "roof_slab": "brick_slab",
        "trapdoor": "oak_trapdoor",
        "door": "oak_door",
        "window": "glass_pane",
        "chimney": [("stone_bricks", 3), ("andesite", 1)],
        "ground": [("grass_block", 1)],
        "path": "dirt_path",
    },
}


def pick(rng, entry):
    """Weighted pick from a palette slot (string or [(block, weight), ...])."""
    if isinstance(entry, str):
        return entry
    total = sum(w for _, w in entry)
    r = rng.random() * total
    for name, w in entry:
        r -= w
        if r <= 0:
            return name
    return entry[-1][0]
