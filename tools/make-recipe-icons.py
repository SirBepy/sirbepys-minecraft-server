"""Copies the vanilla item textures the recipes page uses out of a Minecraft client jar into
site/assets/textures/items/, and draws flat front-view chest and ender chest icons (the game
renders those from a 3D entity texture, so the jar has no flat item texture for them). Needs
Pillow. Rerun after a version bump (or to add an item to the list):

    python tools/make-recipe-icons.py <path-to-client.jar>

Same Mojang usage terms as tools/extract-mc-textures.py; the footer carries the required line.
"""
import io
import sys
import zipfile
from pathlib import Path

from PIL import Image

OUT = Path(__file__).parent.parent / 'site' / 'assets' / 'textures' / 'items'

ITEMS = '''
leather iron_ingot diamond netherite_ingot netherite_upgrade_smithing_template red_dye
sweet_berries netherite_scrap writable_book
'''.split()

BLOCKS = 'obsidian snow'.split()

CHESTS = {'normal': 'chest.png', 'ender': 'ender_chest.png'}


def chest_front(entity_png):
    """16x16 front view from a 64x64 chest entity texture.

    The front faces are the fourth strip of the lid (x 42-56, y 14-19) and of the base
    (x 42-56, y 33-43), stored upside down; the latch front is at (1,1)-(3,5).
    """
    tex = Image.open(io.BytesIO(entity_png)).convert('RGBA')
    flip = Image.Transpose.FLIP_TOP_BOTTOM
    lid = tex.crop((42, 14, 56, 19)).transpose(flip)
    base = tex.crop((42, 33, 56, 43)).transpose(flip)
    latch = tex.crop((1, 1, 3, 5))
    out = Image.new('RGBA', (16, 16))
    out.paste(base, (1, 5))
    out.paste(lid, (1, 1))
    out.paste(latch, (7, 4))
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    jar = zipfile.ZipFile(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    tex = 'assets/minecraft/textures/'
    wanted = {f'{tex}item/{i}.png': f'{i}.png' for i in ITEMS}
    wanted.update({f'{tex}block/{b}.png': f'{b}.png' for b in BLOCKS})
    for src, dst in wanted.items():
        (OUT / dst).write_bytes(jar.read(src))
    for name, dst in CHESTS.items():
        chest_front(jar.read(f'{tex}entity/chest/{name}.png')).save(OUT / dst)
    print(f'wrote {len(wanted) + len(CHESTS)} icons to {OUT}')


if __name__ == '__main__':
    main()
