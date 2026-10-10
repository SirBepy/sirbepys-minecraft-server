// Shared biome-map engine for the home-page teaser and the full map. The world arrives as one
// gzipped byte grid (one byte per 4x4-block cell, 128x128 cells per 512-block region) plus a
// meta.json legend; each region is painted once into a 128x128 canvas and scaled with
// nearest-neighbour sampling, so a frame is a few hundred drawImage calls.

const REGION_BLOCKS = 512;
// Below this many screen pixels per block the terrain layer shows its low-res overview;
// at or above it, full-resolution region files are fetched for what's on screen.
const TERRAIN_DETAIL_SCALE = 0.45;
const TERRAIN_MAX_LOADED = 48;
const TERRAIN_MAX_FETCHES = 6;

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// The data files are plain .gz (GitHub Pages sends no Content-Encoding for them), so they are
// decompressed here.
async function fetchGzip(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function blockLabel(id) {
  const path = id.includes(':') ? id.split(':')[1] : id;
  return path.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function loadWorld(base) {
  const meta = await (await fetch(`${base}meta.json`, { cache: 'no-cache' })).json();
  const grid = await fetchGzip(`${base}${meta.grid}`);
  const cells = meta.regionCells;
  const regionIndex = new Map(meta.regions.map(([rx, rz], i) => [`${rx},${rz}`, i]));
  const colors = [[0, 0, 0], ...meta.biomes.map((b) => [1, 3, 5].map((i) => parseInt(b.color.slice(i, i + 2), 16)))];

  // Biome index (1-based, 0 = unknown) at a block position.
  const biomeAt = (x, z) => {
    const rx = Math.floor(x / REGION_BLOCKS);
    const rz = Math.floor(z / REGION_BLOCKS);
    const i = regionIndex.get(`${rx},${rz}`);
    if (i === undefined) return 0;
    const lx = Math.floor((x - rx * REGION_BLOCKS) / meta.blocksPerCell);
    const lz = Math.floor((z - rz * REGION_BLOCKS) / meta.blocksPerCell);
    return grid[i * cells * cells + lz * cells + lx];
  };

  // The pregenerated square plus anything explored next to it; far-flung single regions
  // (a lone teleport) would otherwise make "fit" zoom out to nothing.
  const near = meta.regions.filter(([rx, rz]) => Math.abs(rx) <= 64 && Math.abs(rz) <= 64);
  const xs = near.map((r) => r[0]);
  const zs = near.map((r) => r[1]);
  const bounds = {
    minX: Math.min(...xs) * REGION_BLOCKS, maxX: (Math.max(...xs) + 1) * REGION_BLOCKS,
    minZ: Math.min(...zs) * REGION_BLOCKS, maxZ: (Math.max(...zs) + 1) * REGION_BLOCKS,
  };

  return { meta, base, grid, cells, regionIndex, colors, biomeAt, bounds };
}

// Top-block layer: one low-res overview for everything, plus full 1-pixel-per-block region
// canvases fetched on demand for what's on screen when zoomed in (least recently used dropped).
export class TerrainLayer {
  constructor(world, onUpdate) {
    this.world = world;
    this.t = world.meta.terrain;
    this.onUpdate = onUpdate;
    this.rgb = this.t.blocks.map((b) => hexToRgb(b.color));
    this.overview = null;
    this.detail = new Map();
    this.pending = new Set();
    this.failed = new Set();
  }

  async loadOverview() {
    if (this.overview) return;
    const n = this.t.overviewSize;
    const data = await fetchGzip(`${this.world.base}${this.t.overview}`);
    this.overview = this.world.meta.regions.map((_, r) => {
      const c = document.createElement('canvas');
      c.width = n;
      c.height = n;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(n, n);
      for (let j = 0; j < n * n; j++) {
        const o = (r * n * n + j) * 3;
        const [cr, cg, cb] = [data[o], data[o + 1], data[o + 2]];
        img.data[j * 4] = cr; img.data[j * 4 + 1] = cg; img.data[j * 4 + 2] = cb;
        img.data[j * 4 + 3] = cr || cg || cb ? 255 : 0;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    });
    this.onUpdate();
  }

  wantsDetail(scale) { return scale >= TERRAIN_DETAIL_SCALE; }

  ensureDetail(r) {
    const hit = this.detail.get(r);
    if (hit) { hit.used = performance.now(); return; }
    if (this.pending.has(r) || this.failed.has(r) || this.pending.size >= TERRAIN_MAX_FETCHES) return;
    this.pending.add(r);
    const [rx, rz] = this.world.meta.regions[r];
    fetchGzip(`${this.world.base}terrain/r.${rx}.${rz}.bin.gz?v=${this.t.version}`).then((buf) => {
      const size = this.t.blocksPerRegion;
      const view = new DataView(buf.buffer, buf.byteOffset);
      const n = view.getUint16(0, true);
      const palette = Array.from({ length: n }, (_, i) => view.getUint16(2 + i * 2, true));
      const blocks = buf.subarray(2 + n * 2, 2 + n * 2 + size * size);
      const shade = buf.subarray(2 + n * 2 + size * size);
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      const mul = this.t.shade;
      for (let k = 0; k < size * size; k++) {
        const b = blocks[k];
        if (!b || b > n) continue;
        const [cr, cg, cb] = this.rgb[palette[b - 1]];
        const m = mul[shade[k]] ?? mul[1];
        img.data[k * 4] = cr * m; img.data[k * 4 + 1] = cg * m; img.data[k * 4 + 2] = cb * m; img.data[k * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      this.detail.set(r, { canvas: c, palette, blocks, used: performance.now() });
      if (this.detail.size > TERRAIN_MAX_LOADED) {
        const oldest = [...this.detail.entries()].sort((a, b) => a[1].used - b[1].used)[0][0];
        this.detail.delete(oldest);
      }
    }).catch(() => this.failed.add(r)).finally(() => {
      this.pending.delete(r);
      this.onUpdate();
    });
  }

  source(r, scale) {
    if (this.wantsDetail(scale)) {
      this.ensureDetail(r);
      const d = this.detail.get(r);
      if (d) return d.canvas;
    }
    return this.overview?.[r] || null;
  }

  // Block id at a position, or null when that region's detail isn't loaded.
  blockAt(x, z) {
    const rx = Math.floor(x / REGION_BLOCKS);
    const rz = Math.floor(z / REGION_BLOCKS);
    const r = this.world.regionIndex.get(`${rx},${rz}`);
    const d = r === undefined ? null : this.detail.get(r);
    if (!d) return null;
    const b = d.blocks[(z - rz * REGION_BLOCKS) * REGION_BLOCKS + (x - rx * REGION_BLOCKS)];
    return b ? this.t.blocks[d.palette[b - 1]]?.id ?? null : null;
  }
}

// Connected areas of one biome (4-neighbour flood fill across region seams), largest first.
export function findAreas(world, biome) {
  const { meta, grid, cells, regionIndex } = world;
  const per = cells * cells;
  const seen = new Uint8Array(grid.length);
  const areas = [];
  const bpc = meta.blocksPerCell;
  const stack = [];
  meta.regions.forEach(([rx, rz], r) => {
    const base = r * per;
    for (let j = 0; j < per; j++) {
      if (grid[base + j] !== biome || seen[base + j]) continue;
      let count = 0, sx = 0, sz = 0;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      seen[base + j] = 1;
      stack.push(rx * cells + (j % cells), rz * cells + Math.floor(j / cells));
      while (stack.length) {
        const gz = stack.pop();
        const gx = stack.pop();
        count++; sx += gx; sz += gz;
        if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
        if (gz < minZ) minZ = gz; if (gz > maxZ) maxZ = gz;
        for (const [nx, nz] of [[gx + 1, gz], [gx - 1, gz], [gx, gz + 1], [gx, gz - 1]]) {
          const nrx = Math.floor(nx / cells);
          const nrz = Math.floor(nz / cells);
          const ri = nrx === rx && nrz === rz ? r : regionIndex.get(`${nrx},${nrz}`);
          if (ri === undefined) continue;
          const k = ri * per + (nz - nrz * cells) * cells + (nx - nrx * cells);
          if (grid[k] === biome && !seen[k]) { seen[k] = 1; stack.push(nx, nz); }
        }
      }
      areas.push({
        cells: count,
        x: Math.round((sx / count + 0.5) * bpc),
        z: Math.round((sz / count + 0.5) * bpc),
        minX: minX * bpc, maxX: (maxX + 1) * bpc, minZ: minZ * bpc, maxZ: (maxZ + 1) * bpc,
      });
    }
  });
  return areas.sort((a, b) => b.cells - a.cells);
}

export class MapView {
  constructor(canvas, world, { minScale = 1 / 32, maxScale = 16, background = '#15131a' } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.background = background;
    this.x = 0;
    this.z = 0;
    this.scale = 0.25;
    this.highlight = 0;
    this.layer = 'biomes';
    this.terrain = null;
    this.listeners = new Set();
    this.bitmaps = world.meta.regions.map(() => null);
    this.paintAll();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  paintAll() {
    const { grid, cells, colors } = this.world;
    const per = cells * cells;
    const hl = this.highlight;
    this.world.meta.regions.forEach((_, i) => {
      let c = this.bitmaps[i];
      if (!c) {
        c = document.createElement('canvas');
        c.width = cells;
        c.height = cells;
        this.bitmaps[i] = c;
      }
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(cells, cells);
      const d = img.data;
      for (let j = 0; j < per; j++) {
        const v = grid[i * per + j];
        const o = j * 4;
        if (v === 0) { d[o + 3] = 0; continue; }
        const [r, g, b] = colors[v];
        if (hl && v !== hl) {
          // Everything else fades to a dark, desaturated version of itself.
          const l = (r * 0.3 + g * 0.59 + b * 0.11) * 0.36;
          d[o] = l; d[o + 1] = l; d[o + 2] = l + 6;
        } else {
          d[o] = r; d[o + 1] = g; d[o + 2] = b;
        }
        d[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
  }

  setHighlight(biome) {
    if (biome === this.highlight) return;
    this.highlight = biome;
    this.paintAll();
    this.draw();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.draw();
  }

  clampScale(s) { return Math.min(this.maxScale, Math.max(this.minScale, s)); }

  setView(x, z, scale = this.scale) {
    this.x = x;
    this.z = z;
    this.scale = this.clampScale(scale);
    this.draw();
  }

  // insetRight: screen pixels covered by an overlay on the right (the search panel).
  fit(bounds = this.world.bounds, padding = 24, insetRight = 0) {
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxZ - bounds.minZ;
    const s = this.clampScale(Math.min((this.width - insetRight - padding * 2) / w, (this.height - padding * 2) / h));
    this.setView((bounds.minX + bounds.maxX) / 2 + insetRight / 2 / s, (bounds.minZ + bounds.maxZ) / 2, s);
  }

  // Zoom keeping the block under (sx, sy) screen point fixed.
  zoomAt(factor, sx = this.width / 2, sy = this.height / 2) {
    const before = this.toWorld(sx, sy);
    this.scale = this.clampScale(this.scale * factor);
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.z += before.z - after.z;
    this.draw();
  }

  panBy(dx, dy) {
    this.x -= dx / this.scale;
    this.z -= dy / this.scale;
    this.draw();
  }

  toWorld(sx, sy) {
    return { x: this.x + (sx - this.width / 2) / this.scale, z: this.z + (sy - this.height / 2) / this.scale };
  }

  toScreen(x, z) {
    return { x: (x - this.x) * this.scale + this.width / 2, y: (z - this.z) * this.scale + this.height / 2 };
  }

  draw() {
    if (!this.width) return;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = false;
    const size = REGION_BLOCKS * this.scale;
    this.world.meta.regions.forEach(([rx, rz], i) => {
      const p = this.toScreen(rx * REGION_BLOCKS, rz * REGION_BLOCKS);
      if (p.x > this.width || p.y > this.height || p.x + size < 0 || p.y + size < 0) return;
      // Snap to device pixels so neighbouring regions never leave hairline seams.
      const x0 = Math.floor(p.x * dpr) / dpr;
      const y0 = Math.floor(p.y * dpr) / dpr;
      const x1 = Math.ceil((p.x + size) * dpr) / dpr;
      const y1 = Math.ceil((p.y + size) * dpr) / dpr;
      const src = this.layer === 'terrain' && this.terrain
        ? this.terrain.source(i, this.scale) || this.bitmaps[i]
        : this.bitmaps[i];
      ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0);
    });
    for (const fn of this.listeners) fn(this);
  }
}

export function biomeLabel(world, index) {
  return index ? world.meta.biomes[index - 1] : null;
}
