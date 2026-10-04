// Generates the site's 16x16 block textures (original pixel art, seeded so reruns are identical).
// Output is committed; rerun only to change the art.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './lib/png.mjs';
import { SITE_DIR } from './lib/config.mjs';

const OUT = join(SITE_DIR, 'assets', 'textures');
const S = 16;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Weighted pick from a palette: earlier colours are the base, later ones the speckles.
function speckle(pal, weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < pal.length; i++) { x -= weights[i]; if (x <= 0) return pal[i]; }
  return pal[0];
}

function tile(seed, fn, width = S, height = S) {
  const r = rng(seed);
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [cr, cg, cb, a = 255] = fn(x, y, r);
      const o = (y * width + x) * 4;
      px[o] = cr; px[o + 1] = cg; px[o + 2] = cb; px[o + 3] = a;
    }
  }
  return encodePng(width, height, px);
}

const GRASS = ['#6aa33a', '#5b8f30', '#7bb446', '#4f7d29'].map(hex);
const DIRT = ['#866043', '#74513a', '#9a7350', '#5e412c'].map(hex);
const STONE = ['#7f7f7f', '#8c8c8c', '#717171', '#999999'].map(hex);
const DEEPSLATE = ['#4b4b52', '#40404a', '#57575f', '#35353c'].map(hex);
const BEDROCK = ['#3a3a3a', '#575757', '#1c1c1c', '#7a7a7a'].map(hex);

const textures = {
  'grass.png': tile(11, (x, y, r) => speckle(GRASS, [5, 3, 2, 1], r)),
  'dirt.png': tile(23, (x, y, r) => speckle(DIRT, [5, 3, 2, 2], r)),
  'stone.png': tile(37, (x, y, r) => speckle(STONE, [6, 3, 3, 1], r)),
  'deepslate.png': tile(41, (x, y, r) => {
    // Deepslate reads as horizontal strata: rows share a tone.
    const band = Math.floor(y / 2) % 2;
    return speckle(DEEPSLATE, band ? [2, 5, 1, 2] : [5, 2, 2, 1], r);
  }),
  'bedrock.png': tile(53, (x, y, r) => speckle(BEDROCK, [4, 3, 3, 1], r)),
};

// Grass-block side: a green lip of uneven depth dripping over dirt. Drip depth per column is
// fixed first so the edge reads as one silhouette rather than per-pixel noise.
{
  const r = rng(67);
  const depth = Array.from({ length: S }, () => 2 + Math.floor(r() * 3));
  textures['grass-side.png'] = tile(68, (x, y, rr) => (y < depth[x] ? speckle(GRASS, [5, 3, 2, 1], rr) : speckle(DIRT, [5, 3, 2, 2], rr)));
}

// Strata seams: the upper material reaches down an uneven 1-6 pixels into the lower one. Tiles
// are 16 wide but the seam profile is generated over 64 columns so repeats aren't obvious.
function seam(seed, upper, lower, upperW, lowerW) {
  const r = rng(seed);
  const W = 64;
  let d = 3;
  const depth = Array.from({ length: W }, () => {
    d = Math.max(1, Math.min(6, d + Math.round((r() - 0.5) * 3)));
    return d;
  });
  return tile(seed + 1, (x, y, rr) => (y < depth[x] ? speckle(upper, upperW, rr) : speckle(lower, lowerW, rr)), W, S);
}
textures['seam-dirt-stone.png'] = seam(71, DIRT, STONE, [5, 3, 2, 2], [6, 3, 3, 1]);
textures['seam-stone-deepslate.png'] = seam(83, STONE, DEEPSLATE, [6, 3, 3, 1], [5, 2, 2, 1]);
textures['seam-deepslate-bedrock.png'] = seam(97, DEEPSLATE, BEDROCK, [5, 2, 2, 1], [4, 3, 3, 1]);

// Hero horizon: 48 blocks of grassy hills with a few oak trees, transparent sky above.
{
  const r = rng(131);
  const COLS = 48;
  const ROWS = 10;
  const LEAVES = ['#3f7a1f', '#4c8f27', '#336619', '#5aa030'].map(hex);
  const LOG = ['#6b5131', '#5a4428', '#7a5d3a'].map(hex);
  const heights = [];
  let h = 2;
  for (let c = 0; c < COLS; c++) {
    if (r() < 0.35) h = Math.max(1, Math.min(4, h + (r() < 0.5 ? -1 : 1)));
    heights.push(h);
  }
  // Wrap the profile so the strip tiles seamlessly.
  heights[COLS - 1] = heights[0];
  const blocks = new Map();
  const put = (c, row, kind) => blocks.set(`${c},${row}`, kind);
  heights.forEach((hh, c) => {
    for (let row = ROWS - hh; row < ROWS; row++) put(c, row, row === ROWS - hh ? 'grass' : 'dirt');
  });
  for (const c of [6, 19, 33, 41]) {
    const base = ROWS - heights[c];
    for (let t = 1; t <= 3; t++) put(c, base - t, 'log');
    for (let dc = -2; dc <= 2; dc++) {
      for (let row = base - 5; row <= base - 3; row++) {
        if (Math.abs(dc) === 2 && row === base - 5) continue;
        const k = `${c + dc},${row}`;
        if (!blocks.has(k)) put(c + dc, row, 'leaves');
      }
    }
  }
  const grassSide = rng(68);
  const lip = Array.from({ length: S }, () => 2 + Math.floor(grassSide() * 3));
  textures['horizon.png'] = tile(140, (x, y, rr) => {
    const kind = blocks.get(`${Math.floor(x / S)},${Math.floor(y / S)}`);
    const lx = x % S;
    const ly = y % S;
    switch (kind) {
      case 'grass': return ly < lip[lx] ? speckle(GRASS, [5, 3, 2, 1], rr) : speckle(DIRT, [5, 3, 2, 2], rr);
      case 'dirt': return speckle(DIRT, [5, 3, 2, 2], rr);
      case 'log': return lx % 5 === 0 ? LOG[1] : speckle(LOG, [4, 2, 2], rr);
      case 'leaves': return rr() < 0.12 ? [0, 0, 0, 0] : speckle(LEAVES, [4, 3, 2, 2], rr);
      default: return [0, 0, 0, 0];
    }
  }, COLS * S, ROWS * S);
}

mkdirSync(OUT, { recursive: true });
for (const [name, png] of Object.entries(textures)) writeFileSync(join(OUT, name), png);
console.log(`wrote ${Object.keys(textures).length} textures to ${OUT}`);
