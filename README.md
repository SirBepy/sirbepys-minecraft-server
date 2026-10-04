# SirBepys Minecraft Server

The public website for **Los Pollos MineHermanos**, a friends survival server (Java + Bedrock
via Geyser): the join address, what's different from vanilla, the datapacks, the optional
modpack, and a **biome map of our real world** built from the server's own region files.

Live: https://sirbepy.github.io/sirbepys-minecraft-server/

- `site/` is the whole website: plain HTML/CSS/JS, no framework, no build step, no npm
  dependencies. `site/map/` is the map app.
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
| `npm run publish` | Publishes `site/` as-is (keeps the live map data if there's none locally). |
| `npm test` | Unit tests for the NBT/region reader, biome extraction, colours and area search. |
| `npm run textures` | Regenerates the pixel textures in `site/assets/textures/` (seeded, deterministic). |

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
3. **View** (`site/assets/js/biome-map.js`): the browser decompresses the grid and paints each
   region into a 128x128 canvas, scaled with nearest-neighbour sampling. Hover, search and the
   "nearest area" finder all read the same grid.

Colours follow the Amidst/Chunkbase scheme for vanilla biomes, hand-picked ones for Terralith,
and a stable hash-derived colour (nudged by name: "frozen" goes blue, "desert" goes sand) for any
biome nobody listed yet (`tools/lib/biome-colors.mjs`).

The generated data is never committed to `main`: `tools/publish.mjs` copies `site/` into a
temporary repo and force-pushes it to `gh-pages` as one orphan commit, so nightly updates don't
grow the git history.

## Nightly updates: GitHub Actions (chosen) vs a Windows scheduled task

`.github/workflows/publish.yml` runs every night at 03:17 UTC, on every push to `main` that
touches the site or tools, and on demand from the Actions tab ("Run workflow").

| | GitHub Actions cron (chosen) | Windows scheduled task on this PC |
| --- | --- | --- |
| Runs when the PC is off | Yes | No |
| Cost | Free (public repo) | Free |
| Secret handling | SSH key stored as a GitHub secret | Key never leaves the PC |
| Download per night | Changed regions only (grids cached between runs) | Changed regions only |
| Gotchas | Cron can run late at busy times; GitHub pauses schedules after 60 days without repo activity (re-enable in the Actions tab) | PC must be on and awake |

Actions wins on reliability. To limit what the GitHub secret can do, it uses a **dedicated SSH
key** (`~/.ssh/sirbepys_map_ed25519`) rather than your main one: remove it in the Kinetic panel
and the nightly job loses access, nothing else changes. Note that Kinetic SFTP keys are not
read-only on their own; the read-only guarantee comes from the script (only `ls`/`get`).

Secrets the workflow reads: `MC_SFTP_KEY` (private key) and `MC_SFTP_USER`. Without them the
workflow still publishes site changes, keeping the current live map data.

## Next step: terrain layer

A second layer showing the actual top blocks (so builds are visible) fits the same pipeline:
the extractor already finds the top block per column via the heightmap; it would read the
section's `block_states` palette at that position, map block ids to colours, and emit per-region
PNG tiles (one pixel per block, 512x512) rather than a byte grid. Expect roughly 100-300 KB per
region, so tens of MB in total: fine for GitHub Pages, but those tiles should only be rebuilt
for changed regions and could use a coarser zoom level for the zoomed-out view.

## Credits

Datapack images and icons are hotlinked from each project's Modrinth page and Vanilla Tweaks,
credited on the page. Font: [Monocraft](https://github.com/IdreesInc/Monocraft) (OFL, license in
`site/assets/fonts/`). Icons: [Phosphor](https://phosphoricons.com). Block textures are original
pixel art generated by `tools/make-textures.mjs`. Live player count from
[mcsrvstat.us](https://mcsrvstat.us).

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
