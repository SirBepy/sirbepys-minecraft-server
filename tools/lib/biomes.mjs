import { readRegionChunks } from './region.mjs';

export const CELLS = 128; // biome cells per region side: 512 blocks / 4
// Bump when extraction logic changes so every cached grid is rebuilt.
export const EXTRACTOR_VERSION = 3;
export const gridKey = (remote) => `${EXTRACTOR_VERSION}:${remote.size}:${remote.mtime}`;
const SEA_LEVEL = 63;
const CAVE = /(^|:)cave\/|_caves$|:deep_dark$/;
// Chunks still at these statuses have no biomes assigned yet.
const NO_BIOMES = new Set(['minecraft:empty', 'minecraft:structure_starts', 'minecraft:structure_references', 'empty', 'structure_starts', 'structure_references']);

// Reads `count` values of `bits` width out of a long array where values never straddle two longs
// (the packing Minecraft has used since 1.16).
function unpack(longs, bits, count) {
  const out = new Uint16Array(count);
  if (!longs || bits === 0) return out;
  const perLong = Math.floor(64 / bits);
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < count; i++) {
    const long = longs[Math.floor(i / perLong)];
    if (long === undefined) break;
    out[i] = Number((BigInt.asUintN(64, long) >> BigInt((i % perLong) * bits)) & mask);
  }
  return out;
}

const bitsFor = (n) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)));

// Surface biome per 4x4 column for one region file. Grid value 0 = no data, otherwise
// index + 1 into the returned palette. "Surface" = the 4x4x4 cell containing the topmost block
// (WORLD_SURFACE heightmap), so cave biomes underneath never show.
export function extractRegionBiomes(path, onError) {
  const palette = [];
  const paletteIndex = new Map();
  const grid = new Uint8Array(CELLS * CELLS);
  let chunks = 0;

  const idOf = (name) => {
    let i = paletteIndex.get(name);
    if (i === undefined) {
      i = palette.length;
      if (i >= 255) throw new Error('more than 255 biomes in one region');
      palette.push(name);
      paletteIndex.set(name, i);
    }
    return i + 1;
  };

  for (const { cx, cz, nbt } of readRegionChunks(path, onError)) {
    if (NO_BIOMES.has(nbt.Status) || !Array.isArray(nbt.sections)) continue;
    const minSectionY = typeof nbt.yPos === 'number' ? nbt.yPos : -4;
    const minY = minSectionY * 16;
    const surface = nbt.Heightmaps?.WORLD_SURFACE;
    const heights = surface ? unpack(surface, 9, 256) : null;

    const sections = new Map();
    for (const s of nbt.sections) if (s.biomes?.palette?.length) sections.set(s.Y, s.biomes);
    if (sections.size === 0) continue;
    const decoded = new Map();
    const sectionBiomes = (y) => {
      if (!decoded.has(y)) {
        const b = sections.get(y);
        decoded.set(y, b ? { palette: b.palette, values: unpack(b.data, bitsFor(b.palette.length), 64) } : null);
      }
      return decoded.get(y);
    };

    chunks++;
    for (let qz = 0; qz < 4; qz++) {
      for (let qx = 0; qx < 4; qx++) {
        // Sample the column nearest the cell's centre.
        const h = heights ? heights[(qz * 4 + 2) * 16 + (qx * 4 + 2)] : 0;
        let y = heights && h > 0 ? minY + h - 1 : SEA_LEVEL;
        let sec = null;
        // Walk down past any section missing biome data (should not happen for full chunks).
        for (let tries = 0; tries < 32 && !sec; tries++) {
          sec = sectionBiomes(Math.floor(y / 16));
          if (!sec) y -= 16;
          if (y < minY) break;
        }
        if (!sec) continue;
        const at = (yy) => {
          const s = sectionBiomes(Math.floor(yy / 16));
          if (!s) return null;
          const qy = (((yy % 16) + 16) % 16) >> 2;
          const n = s.palette[s.values[(qy << 4) | (qz << 2) | qx]] ?? s.palette[0];
          return typeof n === 'string' ? n : n.Name;
        };
        let name = at(y);
        // Cave biomes are 3D noise that can poke up into the top cell; the cell above shows
        // what the surface actually looks like.
        for (let up = 4; up <= 8 && CAVE.test(name); up += 4) name = at(y + up) ?? name;
        grid[(cz * 4 + qz) * CELLS + cx * 4 + qx] = idOf(name);
      }
    }
  }
  return { palette, grid, chunks };
}

export function readSpawn(level) {
  const d = level.Data || level;
  if (d.spawn?.pos) return { x: d.spawn.pos[0], y: d.spawn.pos[1], z: d.spawn.pos[2] };
  if (typeof d.SpawnX === 'number') return { x: d.SpawnX, y: d.SpawnY, z: d.SpawnZ };
  return null;
}
