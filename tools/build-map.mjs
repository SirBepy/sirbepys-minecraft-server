// Turns the cached region files into the map's static data: one meta.json (biome legend, block
// colours, region list, spawn), one gzipped biome grid with a byte per 4x4-block cell, and for
// the terrain layer one file per region (top block + shade per column) plus a low-res overview.
// Regions whose source file hasn't changed reuse their cached extraction, so a nightly rebuild
// only re-reads what moved.
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
import { BLOCKS, SHADE } from './lib/terrain.mjs';
import { biomeColor as hashColor } from './lib/biome-colors.mjs';

const WORKERS = Math.max(1, Math.min(5, cpus().length - 1));
const OVERVIEW = 64; // overview pixels per region side (8 blocks each)
const SHADE_MUL = { [SHADE.dark]: 0.71, [SHADE.flat]: 0.86, [SHADE.light]: 1 };
const BLOCK_COLORS = JSON.parse(readFileSync(new URL('./data/block-colors.json', import.meta.url), 'utf8'));
const terrainFile = (f) => join(GRID_DIR, f.replace(/\.mca$/, '.terrain.gz'));

// Cache format: u32 header length, JSON { palette }, then blocks and shade (512x512 bytes each).
function writeTerrainCache(f, t) {
  const head = Buffer.from(JSON.stringify({ palette: t.palette }));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length);
  writeFileSync(terrainFile(f), gzipSync(Buffer.concat([len, head, Buffer.from(t.blocks), Buffer.from(t.shade)])));
}

function readTerrainCache(f) {
  const buf = gunzipSync(readFileSync(terrainFile(f)));
  const n = buf.readUInt32LE(0);
  const { palette } = JSON.parse(buf.subarray(4, 4 + n).toString());
  const size = BLOCKS * BLOCKS;
  return { palette, blocks: buf.subarray(4 + n, 4 + n + size), shade: buf.subarray(4 + n + size, 4 + n + size * 2) };
}

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
      if (c.key === keys[f] && existsSync(terrainFile(f))) { cached.set(f, c); continue; }
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
    writeTerrainCache(f, r.terrain);
    writeFileSync(join(GRID_DIR, f.replace(/\.mca$/, '.json')), JSON.stringify(entry));
    cached.set(f, entry);
    if (r.errors) log(`  ${f}: ${r.errors} unreadable chunks skipped`);
  }
  if (stale.length) log(`extraction took ${((Date.now() - started) / 1000).toFixed(1)}s`);
  for (const f of readdirSync(GRID_DIR)) {
    if (!files.includes(f.replace(/\.(json|terrain\.gz)$/, '.mca'))) rmSync(join(GRID_DIR, f));
  }

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
  for (const f of readdirSync(MAP_DATA_DIR)) if (/^(biomes|terrain-overview)\..*\.bin\.gz$/.test(f)) rmSync(join(MAP_DATA_DIR, f));
  const stamp = new Date().toISOString();
  const version = Date.now().toString(36);
  const gridFile = `biomes.${version}.bin.gz`;
  writeFileSync(join(MAP_DATA_DIR, gridFile), gz);
  const terrain = writeTerrain(regions, version, log);
  const meta = {
    generatedAt: stamp,
    blocksPerCell: 4,
    regionCells: CELLS,
    grid: gridFile,
    spawn: spawn && { x: spawn.x, z: spawn.z },
    regions: regions.map(({ rx, rz }) => [rx, rz]),
    biomes: palette.map((id, i) => ({ id, name: biomeName(id), source: biomeSource(id), color: biomeColor(id),
      cells: area[i + 1] })),
    terrain,
  };
  writeFileSync(join(MAP_DATA_DIR, 'meta.json'), JSON.stringify(meta));
  // .mcc files (oversized chunks) are tiny and may be referenced by a later-changed .mca: keep them.
  if (process.env.MAP_KEEP_RAW === '0') for (const f of files) rmSync(join(RAW_DIR, f), { force: true });
  log(`wrote ${regions.length} regions, ${palette.length} biomes, grid ${(gz.length / 1e6).toFixed(2)} MB gzipped`);
  return meta;
}

// Terrain output: data/map/terrain/r.X.Z.bin.gz per region (u16 block count, that many u16
// indexes into the global block list, then blocks and shade, 512x512 bytes each) and one
// overview file with OVERVIEW x OVERVIEW RGB pixels per region, in meta.regions order.
function writeTerrain(regions, version, log) {
  const dir = join(MAP_DATA_DIR, 'terrain');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const perRegion = regions.map(({ f }) => ({ f, t: readTerrainCache(f) }));
  const ids = new Set();
  for (const { t } of perRegion) t.palette.forEach((p) => ids.add(p));
  const blocks = [...ids].sort();
  const globalIndex = new Map(blocks.map((id, i) => [id, i]));
  const colors = blocks.map((id) => BLOCK_COLORS[id] || hashColor(id));
  const rgb = colors.map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const overview = Buffer.alloc(regions.length * OVERVIEW * OVERVIEW * 3);
  const step = BLOCKS / OVERVIEW;
  let bytes = 0;

  perRegion.forEach(({ f, t }, r) => {
    const head = Buffer.alloc(2 + t.palette.length * 2);
    head.writeUInt16LE(t.palette.length, 0);
    t.palette.forEach((id, i) => head.writeUInt16LE(globalIndex.get(id), 2 + i * 2));
    const file = gzipSync(Buffer.concat([head, t.blocks, t.shade]), { level: 9 });
    bytes += file.length;
    writeFileSync(join(dir, f.replace(/\.mca$/, '.bin.gz')), file);

    const local = t.palette.map((id) => rgb[globalIndex.get(id)]);
    for (let oz = 0; oz < OVERVIEW; oz++) {
      for (let ox = 0; ox < OVERVIEW; ox++) {
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let dz = 0; dz < step; dz++) {
          for (let dx = 0; dx < step; dx++) {
            const k = (oz * step + dz) * BLOCKS + ox * step + dx;
            const b = t.blocks[k];
            if (!b || b > local.length) continue;
            const m = SHADE_MUL[t.shade[k]] ?? 0.86;
            const c = local[b - 1];
            sr += c[0] * m; sg += c[1] * m; sb += c[2] * m; n++;
          }
        }
        const o = ((r * OVERVIEW + oz) * OVERVIEW + ox) * 3;
        if (n) { overview[o] = sr / n; overview[o + 1] = sg / n; overview[o + 2] = sb / n; }
      }
    }
  });

  const overviewFile = `terrain-overview.${version}.bin.gz`;
  const ogz = gzipSync(overview, { level: 9 });
  writeFileSync(join(MAP_DATA_DIR, overviewFile), ogz);
  log(`terrain: ${blocks.length} block types, ${(bytes / 1e6).toFixed(1)} MB region files, overview ${(ogz.length / 1e6).toFixed(2)} MB`);
  return { overview: overviewFile, overviewSize: OVERVIEW, blocksPerRegion: BLOCKS, version,
    shade: [SHADE_MUL[0], SHADE_MUL[1], SHADE_MUL[2]],
    blocks: blocks.map((id, i) => ({ id, color: colors[i] })) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildMap().catch((err) => { console.error(err); process.exit(1); });
}
