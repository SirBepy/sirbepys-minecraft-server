// Appends the current map to the `map-history` branch, one commit per refresh, for a timelapse
// later. Each commit holds every region's terrain cache (top block + shade per column, palette
// as block ids, so it never depends on a build's global block list) plus snapshot.json. Git
// stores identical files once, so a snapshot only costs the regions that changed since the last.
// Unlike gh-pages this branch is never force-pushed: its history IS the timelapse.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GRID_DIR, MAP_DATA_DIR } from './lib/config.mjs';
import { EXTRACTOR_VERSION } from './lib/biomes.mjs';
import { git, remoteUrl } from './publish.mjs';

export const BRANCH = 'map-history';

const README = `# Map history

One commit per map refresh, for a timelapse. Never force-pushed.

- \`snapshot.json\`: \`takenAt\` (when the map was built), \`spawn\`, \`regions\` ([rx, rz] pairs).
- \`regions/r.X.Z.terrain.gz\`: gzip of u32 LE header length, JSON \`{ palette }\` (block ids),
  then 512x512 bytes of block (0 = no data, else palette index + 1) and 512x512 bytes of shade
  (0 dark, 1 flat, 2 light), rows north to south. Written by \`tools/build-map.mjs\` on \`main\`.
`;

export function snapshotMap({ log = console.log, remote = remoteUrl(), gridDir = GRID_DIR, metaFile = join(MAP_DATA_DIR, 'meta.json') } = {}) {
  if (!existsSync(metaFile)) throw new Error(`no ${metaFile}: build the map first`);
  const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
  const out = mkdtempSync(join(tmpdir(), 'sirbepys-history-'));
  try {
    git(out, 'init', '-q', '-b', BRANCH);
    git(out, 'config', 'core.autocrlf', 'false');
    git(out, 'remote', 'add', 'origin', remote);
    // Shallow: the push only needs the tip's tree to skip regions the remote already has.
    const first = git(out, 'ls-remote', '--heads', 'origin', BRANCH) === '';
    if (!first) {
      git(out, 'fetch', '-q', '--depth=1', 'origin', BRANCH);
      git(out, 'reset', '-q', '--hard', `origin/${BRANCH}`);
    }

    rmSync(join(out, 'regions'), { recursive: true, force: true });
    mkdirSync(join(out, 'regions'));
    for (const [rx, rz] of meta.regions) {
      const name = `r.${rx}.${rz}.terrain.gz`;
      copyFileSync(join(gridDir, name), join(out, 'regions', name));
    }
    git(out, 'add', '-A', 'regions');
    const changed = git(out, 'status', '--porcelain', '--', 'regions').split('\n').filter(Boolean).length;
    if (!first && changed === 0) {
      log('map-history: no region changed since the last snapshot, skipped');
      return { committed: false, changed };
    }

    writeFileSync(join(out, 'README.md'), README);
    writeFileSync(join(out, 'snapshot.json'), JSON.stringify({ takenAt: meta.generatedAt, extractor: EXTRACTOR_VERSION,
      spawn: meta.spawn, regions: meta.regions }) + '\n');
    git(out, 'add', '-A');
    if (process.env.GITHUB_ACTIONS) {
      git(out, 'config', 'user.name', 'github-actions[bot]');
      git(out, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    }
    git(out, 'commit', '-q', '-m', `Map snapshot ${meta.generatedAt} (${changed} regions changed)`, '--date', meta.generatedAt);
    git(out, 'push', '-q', 'origin', `HEAD:${BRANCH}`);
    log(`map-history: snapshot ${meta.generatedAt}, ${changed} regions changed`);
    return { committed: true, changed };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    snapshotMap();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
