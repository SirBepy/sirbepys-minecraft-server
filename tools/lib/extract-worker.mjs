import { parentPort } from 'node:worker_threads';
import { readRegionChunks } from './region.mjs';
import { extractRegionBiomes } from './biomes.mjs';
import { extractRegionTerrain } from './terrain.mjs';

parentPort.on('message', ({ path }) => {
  try {
    let errors = 0;
    // Decompressing the chunks is most of the cost, so both layers share one read.
    const chunks = [...readRegionChunks(path, () => { errors++; })];
    const b = extractRegionBiomes(chunks);
    const t = extractRegionTerrain(chunks);
    parentPort.postMessage(
      { path, palette: b.palette, grid: b.grid, chunks: b.chunks, errors,
        terrain: { palette: t.palette, blocks: t.blocks, shade: t.shade } },
      [b.grid.buffer, t.blocks.buffer, t.shade.buffer],
    );
  } catch (err) {
    parentPort.postMessage({ path, error: err.message });
  }
});
