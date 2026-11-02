import json, glob, itertools, random
specs = []
for f in sorted(glob.glob('specs/*.json')):
    specs.append(json.load(open(f)))
R = random.Random(5)
plans = ['auto', 'rect', 'L', 'T', 'H', 'cross', 'cross_long', 'longhouse']
styles = ['gable', 'gambrel', 'mansard', 'curved', 'saltbox', 'mono', 'clerestory', 'm_shaped', 'butterfly', 'elven', 'temple', 'magical']
mixstyles = ['cluster', 'speckle', 'bottom_dark', 'top_dark', 'horizontal', 'weathered', 'eave_dark', 'ridge_dark']
for i in range(260):
    sp = {'seed': R.randint(0, 99999), 'palette': R.choice(['medieval_timber', 'taiga_cabin', 'oak_cottage']),
          'plan': R.choice(plans), 'roof_style': R.choice(styles), 'roof_pitch': R.choice(['auto', 'low', 'normal', 'steep']),
          'function': R.choice(['dwelling', 'smithy', 'farm', 'tavern', 'auto']), 'annexes': R.choice(['auto', 'auto', [], ['porch', 'oriel'], ['smithy', 'tower', 'hood']]),
          'width': R.randint(7, 19), 'depth': R.randint(5, 11), 'floors': R.randint(1, 3), 'floor_height': R.randint(3, 5),
          'jetty': R.random() < 0.6, 'flared_eave': R.random() < 0.3, 'dormers': R.choice(['auto', 0, 1, 2]),
          'dormer_style': R.choice(['auto', 'gable', 'steep', 'low', 'curved', 'mono', 'temple']),
          'dormer_gap': R.choice(['auto', 'auto', 1, 2]), 'chimney': R.random() < 0.8, 'ground': R.random() < 0.8,
          'rotation': R.choice([0, 0, 0, 12, 15, 20, 26, 33, 45, 57, 64, 70, 75, 78, -15, -26, -45, -70])}
    if R.random() < 0.5:
        c = {}
        for slot in ('roof', 'wall', 'wall_ground', 'frame', 'base'):
            if R.random() < 0.5:
                hx = '#%02x%02x%02x' % (R.randint(20, 240), R.randint(20, 240), R.randint(20, 240))
                if slot != 'frame' and R.random() < 0.6:
                    c[slot] = {'style': R.choice(mixstyles), 'range': R.randint(4, 40), 'count': R.randint(2, 6), 'jitter': R.choice([0, 0.35, 0.8]),
                               'scale': R.randint(1, 5), 'cross': R.random() < 0.5, 'curve': R.choice(['linear', 'ease_in', 'ease_out', 'ease_in_out', 'step']),
                               'skip': R.choice([0, 0, 0.2])}
                    if R.random() < 0.8: c[slot]['color'] = hx
                else:
                    c[slot] = R.choice([hx, '红', '深棕', '米白', '偏蓝色'])
        sp['colors'] = c
    specs.append(sp)
json.dump(specs, open('web/test/specs.json', 'w'), ensure_ascii=False)
print(len(specs))
