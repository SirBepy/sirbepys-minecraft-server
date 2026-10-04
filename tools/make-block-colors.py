"""Builds tools/data/block-colors.json: one average colour per block id, for the terrain layer.

Reads a Minecraft client jar (blockstates -> first model -> top-facing texture), averages the
opaque pixels, and multiplies biome-tinted textures (grass, leaves, water) by a fixed tint.
Only the derived colour numbers are committed, never the textures. Rerun after a version bump:

    python tools/make-block-colors.py <path-to-client.jar>

Needs Pillow.
"""
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

OUT = Path(__file__).parent / 'data' / 'block-colors.json'
TEXTURE_KEYS = ['top', 'up', 'end', 'all', 'texture', 'cross', 'plant', 'pattern', 'side', 'particle']

GRASS = (0x91, 0xBD, 0x59)
FOLIAGE = (0x77, 0xAB, 0x2F)
TINTS = {
    'grass_block': GRASS, 'short_grass': GRASS, 'tall_grass': GRASS, 'fern': GRASS, 'large_fern': GRASS,
    'potted_fern': GRASS, 'sugar_cane': GRASS, 'bush': GRASS,
    'oak_leaves': FOLIAGE, 'jungle_leaves': FOLIAGE, 'acacia_leaves': FOLIAGE, 'dark_oak_leaves': FOLIAGE,
    'mangrove_leaves': (0x8D, 0xB1, 0x27), 'vine': FOLIAGE,
    'birch_leaves': (0x80, 0xA7, 0x55), 'spruce_leaves': (0x61, 0x99, 0x61),
    'water': (0x3F, 0x76, 0xE4), 'bubble_column': (0x3F, 0x76, 0xE4), 'water_cauldron': (0x3F, 0x76, 0xE4),
    'lily_pad': (0x20, 0x80, 0x30), 'melon_stem': (0x60, 0xB0, 0x30), 'pumpkin_stem': (0x60, 0xB0, 0x30),
}


def strip(ref):
    ref = ref.split(':', 1)[-1]
    return ref


def main(jar_path):
    z = zipfile.ZipFile(jar_path)
    names = set(z.namelist())
    model_cache = {}

    def load_model(ref):
        ref = strip(ref)
        if ref in model_cache:
            return model_cache[ref]
        path = f'assets/minecraft/models/{ref}.json'
        if path not in names:
            model_cache[ref] = {}
            return {}
        data = json.loads(z.read(path))
        textures = {}
        if 'parent' in data:
            textures.update(load_model(data['parent']))
        textures.update(data.get('textures', {}))
        model_cache[ref] = textures
        return textures

    def resolve(textures, key, depth=0):
        value = textures.get(key)
        while depth < 8:
            if isinstance(value, dict):  # newer model format: {"sprite": "...", ...}
                value = value.get('sprite') or value.get('texture')
            if not (isinstance(value, str) and value.startswith('#')):
                break
            value = textures.get(value[1:])
            depth += 1
        return value if isinstance(value, str) else None

    def average(tex_ref):
        path = f'assets/minecraft/textures/{strip(tex_ref)}.png'
        if path not in names:
            return None
        img = Image.open(io.BytesIO(z.read(path))).convert('RGBA')
        w, h = img.size
        if h > w:
            img = img.crop((0, 0, w, w))  # animated strip: first frame
        total = [0, 0, 0]
        count = 0
        px = img.tobytes()
        for i in range(0, len(px), 4):
            if px[i + 3] > 16:
                total[0] += px[i]
                total[1] += px[i + 1]
                total[2] += px[i + 2]
                count += 1
        if count == 0:
            return None
        return tuple(round(c / count) for c in total)

    colors = {}
    for path in sorted(n for n in names if n.startswith('assets/minecraft/blockstates/') and n.endswith('.json')):
        block = path.rsplit('/', 1)[1][:-5]
        state = json.loads(z.read(path))
        model = None
        if 'variants' in state:
            first = next(iter(state['variants'].values()))
            model = (first[0] if isinstance(first, list) else first).get('model')
        elif 'multipart' in state:
            first = state['multipart'][0]['apply']
            model = (first[0] if isinstance(first, list) else first).get('model')
        if not model:
            continue
        textures = load_model(model)
        if block == 'water':
            tex = 'block/water_still'
        elif block == 'lava':
            tex = 'block/lava_still'
        else:
            tex = next((resolve(textures, k) for k in TEXTURE_KEYS if resolve(textures, k)), None)
        if not tex:
            continue
        rgb = average(tex)
        if rgb is None:
            continue
        tint = TINTS.get(block)
        if tint:
            rgb = tuple(round(c * t / 255) for c, t in zip(rgb, tint))
        colors[f'minecraft:{block}'] = '#%02x%02x%02x' % rgb

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(colors, indent=0, sort_keys=True) + '\n', encoding='utf-8')
    print(f'wrote {len(colors)} block colours to {OUT}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
