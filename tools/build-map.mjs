// Turns the cached region files into the map's static data: one meta.json (biome legend, region
// list, spawn) and one gzipped grid with a byte per 4x4-block cell. Regions whose source file
// hasn't changed reuse their cached grid, so a nightly rebuild only re-reads what moved.
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { CELLS, gridKey, readSpawn } from './lib/biomes.mjs';
import { biomeColor, biomeName, biomeSource } from './lib/biome-colors.mjs';
import { readNbt } from './lib/nbt.mjs';
import { CACHE_DIR, GRID_DIR, MAP_DATA_DIR, RAW_DIR, MANIFEST } from './lib/config.mjs';
import { regionXZ } from './lib/region.mjs';

const WORKERS = Math.max(1, Math.min(5, cpus().length - 1));

function extractAll(paths, log) {
  if (paths.length === 0) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const results = [];
    const queue = [...paths];
    const workers = [];
    let done = 0;
    const next = (w) => {
      const path = queue.shift();
      if (path) w.postMessage({ path });
    };
    for (let i = 0; i < Math.min(WORKERS, paths.length); i++) {
      const w = new Worker(new URL('./lib/extract-worker.mjs', import.meta.url));
      w.on('message', (msg) => {
        if (msg.error) log(`  ${msg.path}: ${msg.error}`);
        else results.push(msg);
        done++;
        if (done % 50 === 0) log(`  extracted ${done}/${paths.length}`);
        if (done === paths.length) { workers.forEach((x) => x.terminate()); resolve(results); } else next(w);
      });
      w.on('error', reject);
      workers.push(w);
      next(w);
    }
  });
}

export async function buildMap({ log = console.log } = {}) {
  mkdirSync(GRID_DIR, { recursive: true });
  mkdirSync(MAP_DATA_DIR, { recursive: true });
  // The synced manifest, not the raw folder, lists the regions: CI deletes raw files after
  // extracting and keeps only the small per-region grids between runs.
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const keys = Object.fromEntries(Object.entries(manifest).map(([f, m]) => [f, gridKey(m)]));
  const files = Object.keys(manifest).filter((f) => f.endsWith('.mca'));
  if (files.length === 0) throw new Error(`no synced regions in ${MANIFEST}; run the sync first`);

  const stale = [];
  const cached = new Map();
  for (const f of files) {
    const gridFile = join(GRID_DIR, f.replace(/\.mca$/, '.json'));
    if (existsSync(gridFile)) {
      const c = JSON.parse(readFileSync(gridFile, 'utf8'));
      if (c.key === keys[f]) { cached.set(f, c); continue; }
    }
    if (!existsSync(join(RAW_DIR, f))) throw new Error(`${f} needs re-extracting but its raw file is missing; re-run the sync`);
    stale.push(join(RAW_DIR, f));
  }
  log(`${files.length} regions, ${stale.length} to extract`);
  const started = Date.now();
  for (const r of await extractAll(stale, log)) {
    const f = r.path.split(/[\\/]/).pop();
    const entry = { key: keys[f], palette: r.palette, chunks: r.chunks, errors: r.errors,
      grid: Buffer.from(r.grid.buffer, r.grid.byteOffset, r.grid.byteLength).toString('base64') };
    writeFileSync(join(GRID_DIR, f.replace(/\.mca$/, '.json')), JSON.stringify(entry));
    cached.set(f, entry);
    if (r.errors) log(`  ${f}: ${r.errors} unreadable chunks skipped`);
  }
  if (stale.length) log(`extraction took ${((Date.now() - started) / 1000).toFixed(1)}s`);
  for (const f of readdirSync(GRID_DIR)) if (!files.includes(f.replace(/\.json$/, '.mca'))) rmSync(join(GRID_DIR, f));

  // Global palette, stable order (alphabetical) so diffs between builds stay readable.
  const ids = new Set();
  for (const c of cached.values()) c.palette.forEach((p) => ids.add(p));
  const palette = [...ids].sort();
  if (palette.length > 255) throw new Error(`${palette.length} biomes do not fit a byte grid`);
  const globalIndex = new Map(palette.map((id, i) => [id, i + 1]));

  const regions = files.map((f) => ({ f, ...regionXZ(f) }))
    .filter(({ f }) => cached.get(f)?.chunks > 0)
    .sort((a, b) => a.rz - b.rz || a.rx - b.rx);
  const out = Buffer.alloc(regions.length * CELLS * CELLS);
  const area = new Array(palette.length + 1).fill(0);
  regions.forEach(({ f }, i) => {
    const c = cached.get(f);
    const local = Buffer.from(c.grid, 'base64');
    const remap = [0, ...c.palette.map((p) => globalIndex.get(p))];
    const base = i * CELLS * CELLS;
    for (let j = 0; j < local.length; j++) { const v = remap[local[j]]; out[base + j] = v; area[v]++; }
  });

  let spawn = null;
  const levelPath = join(CACHE_DIR, 'level.dat');
  if (existsSync(levelPath)) spawn = readSpawn(readNbt(gunzipSync(readFileSync(levelPath))));

  const gz = gzipSync(out, { level: 9 });
  for (const f of readdirSync(MAP_DATA_DIR)) if (/^biomes\..*\.bin\.gz$/.test(f)) rmSync(join(MAP_DATA_DIR, f));
  const stamp = new Date().toISOString();
  const gridFile = `biomes.${Date.now().toString(36)}.bin.gz`;
  writeFileSync(join(MAP_DATA_DIR, gridFile), gz);
  const meta = {
    generatedAt: stamp,
    blocksPerCell: 4,
    regionCells: CELLS,
    grid: gridFile,
    spawn: spawn && { x: spawn.x, z: spawn.z },
    regions: regions.map(({ rx, rz }) => [rx, rz]),
    biomes: palette.map((id, i) => ({ id, name: biomeName(id), source: biomeSource(id), color: biomeColor(id),
      cells: area[i + 1] })),
  };
  writeFileSync(join(MAP_DATA_DIR, 'meta.json'), JSON.stringify(meta));
  // .mcc files (oversized chunks) are tiny and may be referenced by a later-changed .mca: keep them.
  if (process.env.MAP_KEEP_RAW === '0') for (const f of files) rmSync(join(RAW_DIR, f), { force: true });
  log(`wrote ${regions.length} regions, ${palette.length} biomes, grid ${(gz.length / 1e6).toFixed(2)} MB gzipped`);
  return meta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildMap().catch((err) => { console.error(err); process.exit(1); });
}
