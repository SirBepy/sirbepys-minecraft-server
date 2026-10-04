---
name: SirBepys Minecraft Server
description: The friends server's website as the game's own title screen and menu screens, plus a live biome map of the real world.
colors:
  page: "#101010"
  menu-list: "rgba(0,0,0,0.66)"
  gui: "#c6c6c6"
  gui-light: "#ffffff"
  gui-shade: "#555555"
  slot-dark: "#373737"
  ink: "#3f3f3f"
  tooltip: "#100010"
  tooltip-edge-a: "#5000ff"
  tooltip-edge-b: "#28007f"
  button-hover-text: "#ffffa0"
  splash: "#ffff00"
  mc-yellow: "#ffff55"
  mc-green: "#55ff55"
  mc-gold: "#ffaa00"
  mc-aqua: "#55ffff"
  mc-gray: "#aaaaaa"
  mc-red: "#ff5555"
  challenge-purple: "#e48aff"
  pack-kind: "#9a9aff"
  text: "#ffffff"
  map-parchment: "#e7d9b4"
typography:
  logo:
    fontFamily: "Monocraft, ui-monospace, Consolas, monospace"
    fontSize: "128px / 96px / 64px / 52px (desktop / <=900 / <=600 / <=380)"
    fontWeight: 700
    lineHeight: 1
  logo-sub:
    fontFamily: "Monocraft"
    fontSize: "56px / 40px / 28px / 24px"
    fontWeight: 700
  screen-title:
    fontFamily: "Monocraft"
    fontSize: "28px / 22px (<=600)"
    fontWeight: 400
  page-title:
    fontFamily: "Monocraft"
    fontSize: "44px / 26px (<=600)"
    fontWeight: 700
  button:
    fontFamily: "Monocraft"
    fontSize: "18px / 16px (<=600)"
    fontWeight: 400
  body:
    fontFamily: "Monocraft"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Monocraft"
    fontSize: "14px"
rounded:
  none: "0px"
spacing:
  px: "3px (2px at <=600)"
  screen-gap: "104px (88px at <=600)"
  list-padding: "40px 0 48px"
components:
  button:
    sprite: "textures/mc/button.png, 9-slice border 3, scaled by --px"
    height: "calc(var(--px) * 20)"
  button-hover:
    sprite: "textures/mc/button_highlighted.png"
    textColor: "{colors.button-hover-text}"
  menu-screen:
    background: "textures/mc/menu_list_background.png tiled, header/footer_separator.png edges"
  text-field:
    sprite: "textures/mc/text_field.png, 9-slice border 1"
  slot:
    sprite: "textures/mc/slot.png"
  tooltip:
    backgroundColor: "{colors.tooltip}"
    textColor: "{colors.text}"
---

# Design System: SirBepys Minecraft Server

## Overview

The site is Minecraft Java's own menus. The home page opens on the **title screen**: a slowly
panning panorama (a carousel of Stardust Labs screenshots), a stone-filled extruded logo, a
yellow splash, a centred stack of real game buttons (Join on Java Edition, Join on Bedrock
Edition, World Map, Datapacks..., Modpack...), the server name and live player count in the
bottom-left corner and the screenshot credit with carousel controls in the bottom-right.
Scrolling down passes through **menu screens**: each section is a centred screen title over a
dark list band with the game's header and footer separators, all on a blurred copy of the
panorama (the post-1.20.5 menu backdrop). The setup pages (`java/`, `bedrock/`) and the recipes
page are the same screens: a photo header, then the game's Add Server form with real text fields.
The map page (`map/`) is an Operate surface with its own GUI-grammar chrome (`map.css`).

Chosen 2026-10-04 by the owner from three built candidates (dig-down strata, an Incendium-style
page, this title screen); the other two were deleted.

## Direction contract

THESIS: The website is the game's menu system; every section is a screen a player already knows.
Refuses both the generic server landing page (hero, cards, CTA) and a dirt-tiled imitation menu.

OWN-WORLD: Mojang's own sprites (`site/assets/textures/mc/`, copied by
`tools/extract-mc-textures.py`): button and highlighted button, text field, slot, advancement
frames, header/footer separators, menu list background, stone for the logo. Monocraft for every
word. Chat colours for accents. Square corners. The blurred panorama behind everything.

STORY: A friend opens the link, sees the title screen, presses "Join on Java Edition" or "Join on
Bedrock Edition", copies the address from the Add Server form, joins. Curious players scroll
through the map, features, world, datapacks and modpack screens.

FIRST VIEWPORT: Full-height title screen. Logo top-centre, splash off its right end (under it
below 900px), button stack centred under it at 200 game-pixels wide, corner texts at the bottom.

## Colors

Dark by construction: `color-scheme: dark` plus Dark Reader's lock meta on every page, so
force-dark extensions leave it alone. Text is white with the game's hard drop shadow
(`.mc-text`). Secondary text `mc-gray`. Accents are chat colours: yellow for disclosure labels
and branch titles, green for advancement names and live stats, purple-edged tooltips for
item-style detail, aqua links (yellow on hover). The datapack kind is a mod-name blue-violet
italic. Third-party screenshots carry their own colour; never tint them.

## Typography

Monocraft (OFL, self-hosted, Latin subset) for every word. **It is a pixel font: every size is a
whole pixel and steps per breakpoint; never `clamp()`/`vw` sizes and never negative letter
spacing, both of which land glyphs between pixels and blur them.** Steps are in the frontmatter.
Screen titles are regular weight, centred, like in-game menu titles. Ledes under a screen title
are centred; body copy, lists and steps stay left-aligned.

## Layout

One centred column (`--wrap` 1120px; 820px on the setup pages). Screens are separated by 104px
of blurred panorama where the next screen's title sits. Two-column inside screens on desktop
(map teaser, modpack, Data Packs list + detail); one column at 900px and below. The GUI pixel
unit `--px` is 3px, 2px at 600px and below; sprite sizes are multiples of it.

## Components

- **Buttons**: the game's button sprite as a 9-slice `border-image`; hover swaps to the
  highlighted sprite and pale-yellow text. No colour variants: the game has none.
- **Title screen**: carousel slides pan sideways (40s), autoplay 6.5s with pause, prev/next and
  dots; reduced-motion starts paused.
- **Menu screen** (`.layer`): menu list background, header/footer separators, absolutely placed
  centred title above the band.
- **Features**: the advancement tree with real frame sprites (task, goal, challenge, locked).
- **World gallery**: a dense grid of screenshots ("paintings") with a tooltip-style tag linking
  to each pack's page.
- **Data Packs screen**: a scrolling list (icon, name, one-line description) and a side panel;
  click/tap selects, never hover. All detail cards are stacked in one grid cell so the panel
  never changes height.
- **Crafting**: the modpack as a 3x3 crafting grid in an inventory panel; clicking a mod shows
  its card (toggle off returns to the default text), same no-shift stacking.
- **Add Server form**: text-field sprites holding the address and port with copy buttons whose
  label width is reserved so "Copied!" never shifts them.
- **Disclosures**: `<details class="more">` for everything optional; less text up front.

## Do's and Don'ts

### Do:

- Build new UI from the game's own screens and sprites; extract any new sprite with
  `tools/extract-mc-textures.py`.
- Keep text short and put the rest behind a click.
- Credit and link every third-party pack or screenshot where it appears.
- Keep the "Not an official Minecraft product" line in every footer.

### Don't:

- Don't use the Minecraft logo or the game's real font files.
- Don't round corners, add glass, or use gradient text.
- Don't size Monocraft fluidly.
- Don't add a second icon set: Phosphor bold only.
- Don't invent server facts: every claim traces to the server repo or the live server.
