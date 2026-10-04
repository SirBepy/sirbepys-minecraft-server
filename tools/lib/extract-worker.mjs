import { parentPort } from 'node:worker_threads';
import { extractRegionBiomes } from './biomes.mjs';

parentPort.on('message', ({ path }) => {
  try {
    let errors = 0;
    const r = extractRegionBiomes(path, () => { errors++; });
    parentPort.postMessage({ path, palette: r.palette, grid: r.grid, chunks: r.chunks, errors }, [r.grid.buffer]);
  } catch (err) {
    parentPort.postMessage({ path, error: err.message });
  }
});
