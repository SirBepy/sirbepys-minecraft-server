import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readNbt } from '../tools/lib/nbt.mjs';
import { extractRegionBiomes, CELLS, readSpawn } from '../tools/lib/biomes.mjs';
import { biomeColor, biomeName, biomeSource } from '../tools/lib/biome-colors.mjs';
import { findAreas } from '../site/assets/js/biome-map.js';
import { extractRegionTerrain, BLOCKS, SHADE } from '../tools/lib/terrain.mjs';
import { paletteName } from '../tools/lib/nbt.mjs';
import { tag, writeNbt, pack, writeRegion } from './helpers.mjs';
import { readRegionChunks } from '../tools/lib/region.mjs';

test('readNbt round-trips nested compounds, lists and long arrays', () => {
  const buf = writeNbt({
    Status: tag.string('minecraft:full'),
    yPos: tag.int(-4),
    sections: tag.list(10, [{ v: { Y: tag.byte(4) } }]),
    data: tag.longArray([1n, -1n]),
  });
  const nbt = readNbt(buf);
  assert.equal(nbt.Status, 'minecraft:full');
  assert.equal(nbt.yPos, -4);
  assert.equal(nbt.sections[0].Y, 4);
  assert.deepEqual([...nbt.data], [1n, -1n]);
});

// A full chunk whose top block is at y=70 everywhere (section 4), with river in the west half
// of that section and plains in the east, and a cave biome one section lower.
function chunk(heightY, westBiome = 'minecraft:river') {
  const heights = pack(new Array(256).fill(heightY + 64 + 1), 9);
  const biomes = [];
  for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) biomes.push(x < 2 ? 0 : 1);
  return tag.compound({
    Status: tag.string('minecraft:full'),
    yPos: tag.int(-4),
    Heightmaps: tag.compound({ WORLD_SURFACE: tag.longArray(heights) }),
    sections: tag.list(10, [
      { v: { Y: tag.byte(3), biomes: tag.compound({ palette: tag.list(8, [{ v: 'minecraft:deep_dark' }]) }) } },
      { v: { Y: tag.byte(4), biomes: tag.compound({
        palette: tag.list(8, [{ v: westBiome }, { v: 'minecraft:plains' }]),
        data: tag.longArray(pack(biomes, 1)),
      }) } },
    ]),
  }).v;
}

test('extractRegionBiomes samples the surface cell from the heightmap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mapt-'));
  try {
    const file = join(dir, 'r.0.0.mca');
    writeFileSync(file, writeRegion([{ cx: 0, cz: 0, nbt: chunk(70) }, { cx: 1, cz: 0, nbt: chunk(70, 'terralith:yellowstone') }]));
    const { palette, grid, chunks } = extractRegionBiomes(file);
    assert.equal(chunks, 2);
    const at = (cellX, cellZ) => palette[grid[cellZ * CELLS + cellX] - 1];
    assert.equal(at(0, 0), 'minecraft:river');
    assert.equal(at(3, 2), 'minecraft:plains');
    assert.equal(at(4, 0), 'terralith:yellowstone');
    assert.equal(grid[8], 0, 'cells of missing chunks stay empty');
    assert.ok(!palette.includes('minecraft:deep_dark'), 'cave biome below the surface never shows');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readSpawn handles the 26.x spawn compound and the old SpawnX keys', () => {
  assert.deepEqual(readSpawn({ Data: { spawn: { pos: [5, 64, -9] } } }), { x: 5, y: 64, z: -9 });
  assert.deepEqual(readSpawn({ Data: { SpawnX: 1, SpawnY: 2, SpawnZ: 3 } }), { x: 1, y: 2, z: 3 });
});

test('biome colours: known ids fixed, unknown ids stable valid hex', () => {
  assert.equal(biomeColor('minecraft:plains'), '#8db360');
  assert.equal(biomeColor('terralith:yellowstone'), biomeColor('terralith:yellowstone'));
  assert.match(biomeColor('somepack:glowing_mushroom_swamp'), /^#[0-9a-f]{6}$/);
  assert.equal(biomeColor('x:y'), biomeColor('x:y'));
  assert.equal(biomeName('terralith:cave/infested_caves'), 'Infested Caves');
  assert.equal(biomeSource('terralith:shield'), 'Terralith');
  assert.equal(biomeSource('minecraft:ocean'), 'Vanilla');
});

test('findAreas joins one biome across a region seam and splits separate patches', () => {
  const cells = 4;
  const grid = new Uint8Array(2 * cells * cells);
  // Region (0,0): biome 1 in its east column; region (1,0): biome 1 in its west column.
  for (let z = 0; z < cells; z++) { grid[z * cells + 3] = 1; grid[16 + z * cells] = 1; }
  // A separate one-cell patch.
  grid[16 + 3 * cells + 3] = 1;
  const world = {
    meta: { regions: [[0, 0], [1, 0]], blocksPerCell: 4 },
    grid, cells, regionIndex: new Map([['0,0', 0], ['1,0', 1]]),
  };
  const areas = findAreas(world, 1);
  assert.equal(areas.length, 2);
  assert.equal(areas[0].cells, 8);
  assert.equal(areas[1].cells, 1);
});

test('paletteName reads every 26.x palette entry shape', () => {
  assert.equal(paletteName('minecraft:stone'), 'minecraft:stone');
  assert.equal(paletteName({ Name: 'minecraft:dirt' }), 'minecraft:dirt');
  assert.equal(paletteName({ id: 'minecraft:tall_seagrass', properties: {} }), 'minecraft:tall_seagrass');
  assert.equal(paletteName({ '': 'minecraft:water' }), 'minecraft:water');
});

// Surface at y=70 on the west half and y=72 on the east half; grass everywhere except one
// water column whose ocean floor is 6 blocks down.
function terrainChunk() {
  const surface = [];
  const floor = [];
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const top = x < 8 ? 70 : 72;
    surface.push(top + 64 + 1);
    floor.push(x === 3 && z === 3 ? top + 64 + 1 - 6 : top + 64 + 1);
  }
  // Section 4 covers y 64..79: grass at local y 6 (y=70) and 8 (y=72), water at (3, 6, 3).
  const states = new Array(4096).fill(0);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const ly = x < 8 ? 6 : 8;
    states[(ly << 8) | (z << 4) | x] = x === 3 && z === 3 ? 2 : 1;
  }
  return tag.compound({
    Status: tag.string('minecraft:full'),
    yPos: tag.int(-4),
    Heightmaps: tag.compound({ WORLD_SURFACE: tag.longArray(pack(surface, 9)), OCEAN_FLOOR: tag.longArray(pack(floor, 9)) }),
    sections: tag.list(10, [{ v: { Y: tag.byte(4), block_states: tag.compound({
      palette: tag.list(10, [{ v: { '': tag.string('minecraft:air') } }, { v: { '': tag.string('minecraft:grass_block') } },
        { v: { '': tag.string('minecraft:water') } }]),
      data: tag.longArray(pack(states, 4)),
    }) } }]),
  }).v;
}

test('extractRegionTerrain finds the top block, slope shade and water depth', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mapt-'));
  try {
    const file = join(dir, 'r.0.0.mca');
    writeFileSync(file, writeRegion([{ cx: 0, cz: 0, nbt: terrainChunk() }]));
    const chunks = [...readRegionChunks(file)];
    const { palette, blocks, shade } = extractRegionTerrain(chunks);
    const at = (x, z) => palette[blocks[z * BLOCKS + x] - 1];
    assert.equal(at(0, 0), 'minecraft:grass_block');
    assert.equal(at(3, 3), 'minecraft:water');
    assert.equal(blocks[20], 0, 'columns of missing chunks stay empty');
    assert.equal(shade[3 * BLOCKS + 3], SHADE.flat, 'water 6 deep shades mid');
    // Same-height neighbour to the north: flat. The comparison is north-south, so the
    // east/west step does not shade.
    assert.equal(shade[5 * BLOCKS + 10], SHADE.flat);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
