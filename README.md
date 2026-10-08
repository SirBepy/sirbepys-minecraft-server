# The Claude SMP

The public website for **the Claude SMP**, a friends survival server (Java + Bedrock
via Geyser): the join address, what's different from vanilla, the datapacks, the optional
modpack, and a **map of our real world** built from the server's own region files, with a biome
layer (search any biome, jump to the nearest patch) and a terrain layer showing the actual top
blocks, builds included.

Live: https://sirbepy.github.io/sirbepys-minecraft-server/

- `site/` is the whole website: plain HTML/CSS/JS, no framework, no build step, no npm
  dependencies. `site/map/` is the map app; `site/java/` and `site/bedrock/` are the setup pages
  where the addresses live.
- `tools/` holds the map pipeline (Node built-ins only) and the publish script.
- Server facts on the page come from the server repo (`mc_plugins_tag`: `docs/plan.md`,
  `docs/server.md`, `client/README.md`, `server/datapacks/README.md`).

## Commands

Needs Node 20+ and OpenSSH's `sftp` on the PATH (both ship with Windows 10+ / Git for Windows).

| Command | What it does |
| --- | --- |
| `npm run map:update` | **On-demand refresh.** Pulls changed region files (read-only), rebuilds the map data, publishes the site to GitHub Pages. |
| `npm run map:preview` | Same pull + rebuild, without publishing. Then `npm run serve` to look at it. |
| `npm run serve` | Serves `site/` on http://127.0.0.1:8080/ (`PORT` env to change). |
| `npm run map:sync` / `npm run map:build` | The two halves of the refresh, separately. |
| `npm run map:snapshot` | Appends the last built map to the `map-history` branch (see "Map history" below). The workflow runs it after every refresh. |
| `npm run publish` | Publishes `site/` as-is (keeps the live map data if there's none locally). |
| `npm test` | Unit tests for the NBT/region reader, biome extraction, colours and area search, plus a check that every shipped Mojang texture is linked by the site. |
| `npm run textures` | Regenerates the pixel textures in `site/assets/textures/` (seeded, deterministic). |
| `python tools/extract-mc-textures.py <client.jar>` | Copies the vanilla GUI textures the site uses into `site/assets/textures/mc/`. Only after a Minecraft version bump. |
| `python tools/make-recipe-icons.py <client.jar>` | Copies the item textures the recipes page uses into `site/assets/textures/items/` and draws the chest and ender chest icons. Needs Pillow. Only after a Minecraft version bump. |
| `python tools/make-block-colors.py <client.jar>` | Regenerates `tools/data/block-colors.json` (terrain colours) from a Minecraft client jar. Needs Pillow. Only after a Minecraft version bump. |

### Local SFTP config

The SFTP username is not in this public repo. Put it in `map.config.local.json` (gitignored):

```json
{
  "user": "<panel-username>.dd499ae3",
  "keyFile": "C:/Users/<you>/.ssh/id_ed25519"
}
```

Or use env vars: `MC_SFTP_USER`, `MC_SFTP_KEY_FILE`, `MC_SFTP_HOST`, `MC_SFTP_PORT`,
`MC_REMOTE_REGION_DIR`, `MAP_CACHE_DIR`.

## How the map works

1. **Sync** (`tools/sync-regions.mjs`): one `sftp ls -l` of
   `world/dimensions/minecraft/overworld/region` (Paper 26.3 keeps every dimension inside one
   `world/` folder), compares size + mtime with the last sync, and downloads only new or changed
   `.mca` files with 4 parallel `sftp get`s. The script refuses to send anything but `ls` and
   `get`: it never writes to the live server. The cache lives outside the repo, in
   `%LOCALAPPDATA%\sirbepys-minecraft-server\map-cache` (about 4 GB of region files).
2. **Build** (`tools/build-map.mjs`): reads every chunk's biome palette (4x4x4 cells) and takes
   the cell at the top block from the `WORLD_SURFACE` heightmap, so cave biomes underneath never
   show. Each region becomes a 128x128 grid, cached per region and only re-read when its file
   changed. Output: `site/data/map/meta.json` (biome legend, colours, region list, spawn) plus
   one gzipped byte grid, about 0.4 MB for the whole world.
   The same pass reads the top block of every column (`block_states` at the heightmap) and a
   shade code like in-game maps (lighter facing north-up slopes, water darker with depth):
   `site/data/map/terrain/r.X.Z.bin.gz` per region (about 35 MB in total) plus a 1:8 overview
   (about 3 MB). Block colours are the average of each block's top texture, precomputed from the
   26.3 client jar into `tools/data/block-colors.json` (numbers only, no textures).
3. **View** (`site/assets/js/biome-map.js`): the browser decompresses the grid and paints each
   region into a 128x128 canvas, scaled with nearest-neighbour sampling. Hover, search and the
   "nearest area" finder all read the same grid. The terrain layer shows the overview when
   zoomed out and fetches full-resolution regions for what's on screen once zoomed in (at most
   48 kept in memory).

Colours follow the Amidst/Chunkbase scheme for vanilla biomes, hand-picked ones for Terralith,
and a stable hash-derived colour (nudged by name: "frozen" goes blue, "desert" goes sand) for any
biome nobody listed yet (`tools/lib/biome-colors.mjs`).

The generated data is never committed to `main`: `tools/publish.mjs` copies `site/` into a
temporary repo and force-pushes it to `gh-pages` as one orphan commit, so the scheduled updates don't
grow the git history.

## Scheduled updates: GitHub Actions (chosen) vs a Windows scheduled task

`.github/workflows/publish.yml` runs every 8 hours (03:17, 11:17 and 19:17 UTC), on every push to `main` that
touches the site or tools, and on demand from the Actions tab ("Run workflow").

| | GitHub Actions cron (chosen) | Windows scheduled task on this PC |
| --- | --- | --- |
| Runs when the PC is off | Yes | No |
| Cost | Free (public repo) | Free |
| Secret handling | SSH key stored as a GitHub secret | Key never leaves the PC |
| Download per run | Changed regions only (grids cached between runs) | Changed regions only |
| Gotchas | Cron can run late at busy times; GitHub pauses schedules after 60 days without repo activity (re-enable in the Actions tab) | PC must be on and awake |

Actions wins on reliability. To limit what the GitHub secret can do, it uses a **dedicated SSH
key** (`~/.ssh/sirbepys_map_ed25519`) rather than your main one: remove it in the Kinetic panel
and the scheduled job loses access, nothing else changes. Note that Kinetic SFTP keys are not
read-only on their own; the read-only guarantee comes from the script (only `ls`/`get`).

Secrets the workflow reads: `MC_SFTP_KEY` (private key) and `MC_SFTP_USER`. Without them the
workflow still publishes site changes, keeping the current live map data.

## Map history (for a timelapse)

After every successful refresh the workflow runs `tools/snapshot-map.mjs` (`npm run map:snapshot`),
which appends one commit to the `map-history` branch: every region's terrain cache (top block +
shade per column, 1 pixel per block) and a `snapshot.json` with the build time. Unlike `gh-pages`
it is never force-pushed, since its history is the timelapse. Git stores an unchanged region
once, so each snapshot only adds the regions that changed, and a refresh with no changed region
adds no commit. The branch's own `README.md` documents the file format. To render a timelapse,
walk the branch's commits oldest first and draw each snapshot's regions.

## Ideas for later

- Grass and leaf colours use one fixed tint everywhere; per-biome tints (swamps darker, badlands
  olive) would need each biome's colour from the vanilla and Terralith biome JSONs.
- Every publish re-uploads all ~40 MB of map data (the gh-pages branch is one orphan commit);
  fine at this size, worth revisiting if the explored world grows a lot.

## Credits

Datapack images and icons are hotlinked from each project's Modrinth page and Vanilla Tweaks;
the hero, gallery and join-page screenshots are hotlinked from Stardust Labs' own pack pages. All
are credited where they appear. `site/assets/og-image.png` (the Discord/link-preview card) is a
1200x630 screenshot of the home page's title screen, so it contains a Terralith screenshot by
Stardust Labs. Font: [Monocraft](https://github.com/IdreesInc/Monocraft) (OFL,
license in `site/assets/fonts/`). Icons: [Phosphor](https://phosphoricons.com). GUI
textures in `site/assets/textures/mc/` are Mojang's, copied by `tools/extract-mc-textures.py`; the
older original pixel art from `tools/make-textures.mjs` is still used by the map's loading screen.
Live player count from [mcsrvstat.us](https://mcsrvstat.us).

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
