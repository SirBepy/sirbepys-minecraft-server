import { paletteName } from './nbt.mjs';

// Top block per column for the terrain layer: the block under the WORLD_SURFACE heightmap,
// plus a shade code in the style of in-game maps (lighter when the column is higher than its
// northern neighbour, darker when lower; water shades by depth instead).

export const BLOCKS = 512; // columns per region side
export const SHADE = { dark: 0, flat: 1, light: 2 };
const AIRS = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
const WATERY = new Set(['minecraft:water', 'minecraft:bubble_column']);

function heightmap(longs) {
  const out = new Int16Array(256);
  if (!longs) return null;
  for (let i = 0; i < 256; i++) {
    const long = longs[Math.floor(i / 7)];
    if (long === undefined) return null;
    out[i] = Number((BigInt.asUintN(64, long) >> BigInt((i % 7) * 9)) & 511n);
  }
  return out;
}

function blockAt(section, lx, ly, lz) {
  const pal = section.palette;
  if (pal.length === 1) return pal[0];
  const bits = Math.max(4, Math.ceil(Math.log2(pal.length)));
  const per = Math.floor(64 / bits);
  const i = (ly << 8) | (lz << 4) | lx;
  const long = section.data?.[Math.floor(i / per)];
  if (long === undefined) return pal[0];
  const v = Number((BigInt.asUintN(64, long) >> BigInt((i % per) * bits)) & ((1n << BigInt(bits)) - 1n));
  return pal[v] ?? pal[0];
}


// chunks: iterable of { cx, cz, nbt } for one region.
export function extractRegionTerrain(chunks) {
  const palette = [];
  const index = new Map();
  const blocks = new Uint8Array(BLOCKS * BLOCKS);
  const heights = new Int16Array(BLOCKS * BLOCKS).fill(-32768);
  const depth = new Uint8Array(BLOCKS * BLOCKS);
  const idOf = (name) => {
    let i = index.get(name);
    if (i === undefined) {
      if (palette.length >= 255) return 255;
      i = palette.length + 1;
      palette.push(name);
      index.set(name, i);
    }
    return i;
  };

  for (const { cx, cz, nbt } of chunks) {
    if (nbt.Status !== 'minecraft:full' && nbt.Status !== 'full') continue;
    const surface = heightmap(nbt.Heightmaps?.WORLD_SURFACE);
    if (!surface) continue;
    const floor = heightmap(nbt.Heightmaps?.OCEAN_FLOOR);
    const minY = (typeof nbt.yPos === 'number' ? nbt.yPos : -4) * 16;
    const sections = new Map();
    for (const s of nbt.sections || []) if (s.block_states?.palette?.length) sections.set(s.Y, s.block_states);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const h = surface[lz * 16 + lx];
        if (h === 0) continue;
        let y = minY + h - 1;
        let name = null;
        // Walk down past air the heightmap can overshoot by.
        for (let tries = 0; tries < 4; tries++, y--) {
          const sec = sections.get(Math.floor(y / 16));
          const n = sec && paletteName(blockAt(sec, lx, ((y % 16) + 16) % 16, lz));
          if (n && !AIRS.has(n)) { name = n; break; }
        }
        if (!name) continue;
        const k = (cz * 16 + lz) * BLOCKS + cx * 16 + lx;
        blocks[k] = idOf(name);
        heights[k] = y;
        if (WATERY.has(name) && floor) depth[k] = Math.min(255, Math.max(0, h - floor[lz * 16 + lx]));
      }
    }
  }

  const shade = new Uint8Array(BLOCKS * BLOCKS).fill(SHADE.flat);
  for (let z = 0; z < BLOCKS; z++) {
    for (let x = 0; x < BLOCKS; x++) {
      const k = z * BLOCKS + x;
      if (!blocks[k]) continue;
      if (depth[k] > 0) {
        shade[k] = depth[k] <= 3 ? SHADE.light : depth[k] <= 9 ? SHADE.flat : SHADE.dark;
        continue;
      }
      if (z === 0 || heights[k - BLOCKS] === -32768) continue;
      const d = heights[k] - heights[k - BLOCKS];
      shade[k] = d > 0 ? SHADE.light : d < 0 ? SHADE.dark : SHADE.flat;
    }
  }
  return { palette, blocks, shade };
}
