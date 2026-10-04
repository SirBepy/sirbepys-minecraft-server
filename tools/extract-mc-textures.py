"""Copies the vanilla block and GUI textures the site uses out of a Minecraft client jar into
site/assets/textures/mc/. Rerun after a version bump (or to add a texture to the list):

    python tools/extract-mc-textures.py <path-to-client.jar>

Also writes darkened copies of the two button sprites, which needs Pillow.

Mojang's usage guidelines allow these on a non-commercial fan site as long as it says it is not an
official Minecraft product; the footer carries that line.
"""
import sys
import zipfile
from pathlib import Path

OUT = Path(__file__).parent.parent / 'site' / 'assets' / 'textures' / 'mc'

BLOCKS = '''
grass_block_side grass_block_side_overlay grass_block_top short_grass dirt stone andesite diorite
granite tuff gravel coal_ore iron_ore copper_ore gold_ore redstone_ore lapis_ore diamond_ore emerald_ore
deepslate deepslate_coal_ore deepslate_iron_ore deepslate_copper_ore deepslate_gold_ore
deepslate_redstone_ore deepslate_lapis_ore deepslate_diamond_ore bedrock lava_still oak_planks
'''.split()

GUI = {
    'gui/sprites/widget/button.png': 'button.png',
    'gui/sprites/widget/button_highlighted.png': 'button_highlighted.png',
    'gui/sprites/widget/text_field.png': 'text_field.png',
    'gui/sprites/container/slot.png': 'slot.png',
    'gui/sprites/advancements/task_frame_obtained.png': 'frame_task.png',
    'gui/sprites/advancements/goal_frame_obtained.png': 'frame_goal.png',
    'gui/sprites/advancements/challenge_frame_obtained.png': 'frame_challenge.png',
    'gui/sprites/advancements/task_frame_unobtained.png': 'frame_locked.png',
    'gui/header_separator.png': 'header_separator.png',
    'gui/footer_separator.png': 'footer_separator.png',
    'gui/menu_list_background.png': 'menu_list_background.png',
    'painting/back.png': 'painting_back.png',
}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    jar = zipfile.ZipFile(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = {f'assets/minecraft/textures/block/{b}.png': f'{b}.png' for b in BLOCKS}
    wanted.update({f'assets/minecraft/textures/{k}': v for k, v in GUI.items()})
    missing = []
    for src, dst in wanted.items():
        try:
            (OUT / dst).write_bytes(jar.read(src))
        except KeyError:
            missing.append(src)
    print(f'wrote {len(wanted) - len(missing)} textures to {OUT}')
    if missing:
        sys.exit('missing in jar:\n  ' + '\n  '.join(missing))
    darken_buttons()


# The vanilla button's grey (mean #6d) is too light under white text, so the site uses a darker
# copy (mean about #4a). The outer 1px ring is left alone: black on the normal button, the white
# hover outline on the highlighted one.
DARK = {'button.png': 'button_dark.png', 'button_highlighted.png': 'button_highlighted_dark.png'}
DARK_FACTOR = 0.68


def darken_buttons():
    from PIL import Image  # only this step needs Pillow

    for src, dst in DARK.items():
        im = Image.open(OUT / src).convert('RGBA')
        w, h = im.size
        px = im.load()
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = px[x, y]
                px[x, y] = (round(r * DARK_FACTOR), round(g * DARK_FACTOR), round(b * DARK_FACTOR), a)
        im.save(OUT / dst, optimize=True)
    print(f'wrote {len(DARK)} darkened button sprites')


if __name__ == '__main__':
    main()
