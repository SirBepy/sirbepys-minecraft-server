// Theme A: paints a cross-section of the ground behind the page, top to bottom: plants, grass,
// dirt, stone (with granite/diorite/andesite/gravel blobs and ores by depth), deepslate, caves
// with lava near the floor, and a jagged bedrock floor. Drawn at 16px per block and scaled up
// by CSS, so the canvas stays small however long the page is.

const TEX = new URL('../textures/mc/', import.meta.url);
const NAMES = [
  'grass_block_side', 'grass_block_side_overlay', 'short_grass', 'dirt', 'stone', 'andesite', 'diorite',
  'granite', 'tuff', 'gravel', 'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'redstone_ore', 'lapis_ore',
  'diamond_ore', 'emerald_ore', 'deepslate', 'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_copper_ore',
  'deepslate_gold_ore', 'deepslate_redstone_ore', 'deepslate_lapis_ore', 'deepslate_diamond_ore', 'bedrock',
  'lava_still',
];
const GRASS_TINT = '#91bd59';

const load = (name) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve([name, img]);
  img.onerror = reject;
  img.src = new URL(`${name}.png`, TEX).href;
});

// Grass and plant textures ship grey; the game multiplies them by the biome colour.
function tint(img, color) {
  const c = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, 16, 16);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color;
  x.fillRect(0, 0, 16, 16);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0, 16, 16);
  return c;
}

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x, y, s) => noise(x, y, s) * 0.65 + noise(x * 2.1, y * 2.1, s + 9) * 0.35;

/** Picks the block for every cell; row 0 is the plant row that pokes above the grass. */
function layout(W, H) {
  const deepStart = Math.round(H * 0.55);
  const lavaLevel = H - 6;
  // [stone ore, deepslate ore, first row, last row, rarity threshold]
  const ORES = [
    ['coal_ore', 'deepslate_coal_ore', 6, deepStart - 2, 0.86],
    ['copper_ore', 'deepslate_copper_ore', 7, deepStart + 2, 0.88],
    ['iron_ore', 'deepslate_iron_ore', 8, H - 6, 0.88],
    ['lapis_ore', 'deepslate_lapis_ore', Math.round(H * 0.4), H - 8, 0.92],
    ['gold_ore', 'deepslate_gold_ore', Math.round(H * 0.45), H - 5, 0.92],
    ['redstone_ore', 'deepslate_redstone_ore', deepStart, H - 4, 0.89],
    ['diamond_ore', 'deepslate_diamond_ore', H - 12, H - 4, 0.9],
    ['emerald_ore', 'emerald_ore', 9, 16, 0.975],
  ];
  const grid = [];
  for (let r = 0; r < H; r++) {
    const row = [];
    for (let c = 0; c < W; c++) {
      const dirtDepth = 3 + (hash(c, 0, 3) < 0.45 ? 1 : 0);
      let b;
      if (r === 0) b = hash(c, r, 61) < 0.55 ? 'plant' : null;
      else if (r === 1) b = 'grass';
      else if (r <= 1 + dirtDepth) b = 'dirt';
      else {
        const bedrockChance = r >= H - 1 ? 1 : r >= H - 5 ? (r - (H - 6)) / 5 : 0;
        if (hash(c, r, 11) < bedrockChance) b = 'bedrock';
        else {
          const deep = r > deepStart + Math.floor(hash(c, r, 5) * 3) - 1;
          b = deep ? 'deepslate' : 'stone';
          if (!deep) {
            if (fbm(c / 4, r / 3, 21) > 0.74) b = 'andesite';
            else if (fbm(c / 4, r / 3, 22) > 0.76) b = 'granite';
            else if (fbm(c / 4, r / 3, 23) > 0.77) b = 'diorite';
            else if (r < deepStart - 6 && fbm(c / 3, r / 3, 24) > 0.8) b = 'gravel';
          }
          if (r > deepStart - 4 && fbm(c / 4, r / 3, 25) > 0.78) b = 'tuff';
          if (b === 'stone' || b === 'deepslate') {
            for (const [ore, deepOre, from, to, t] of ORES) {
              if (r >= from && r <= to && fbm(c / 1.6, r / 1.6, 31 + from) > t) { b = deep ? deepOre : ore; break; }
            }
          }
          if (r > dirtDepth + 5 && fbm(c / 9, r / 3.2, 41) > 0.72) b = r >= lavaLevel ? 'lava' : deep ? 'cave-deep' : 'cave';
        }
      }
      row.push(b);
    }
    grid.push(row);
  }
  return grid;
}

export async function paintStrata(canvas, anchor) {
  const tex = Object.fromEntries(await Promise.all(NAMES.map(load)));
  const overlay = tint(tex.grass_block_side_overlay, GRASS_TINT);
  const plant = tint(tex.short_grass, GRASS_TINT);
  let painted = '';

  function paint() {
    const S = innerWidth < 600 ? 48 : 64;
    const top = anchor.getBoundingClientRect().top + scrollY - S;
    const W = Math.ceil(document.documentElement.clientWidth / S);
    const H = Math.ceil((document.documentElement.scrollHeight - top) / S);
    const key = `${S}:${W}:${H}`;
    if (key === painted) return;
    painted = key;
    canvas.width = W * 16;
    canvas.height = H * 16;
    Object.assign(canvas.style, { top: `${top}px`, width: `${W * S}px`, height: `${H * S}px` });
    const x = canvas.getContext('2d');
    x.imageSmoothingEnabled = false;
    const grid = layout(W, H);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const b = grid[r][c];
        const X = c * 16, Y = r * 16;
        if (!b) continue;
        if (b === 'plant') x.drawImage(plant, X, Y);
        else if (b === 'grass') { x.drawImage(tex.grass_block_side, X, Y); x.drawImage(overlay, X, Y); }
        else if (b === 'lava') x.drawImage(tex.lava_still, 0, 0, 16, 16, X, Y, 16, 16);
        else if (b === 'cave' || b === 'cave-deep') {
          // A cave reads as the back wall in shadow.
          x.drawImage(b === 'cave' ? tex.stone : tex.deepslate, X, Y);
          x.fillStyle = 'rgba(0, 0, 0, 0.62)';
          x.fillRect(X, Y, 16, 16);
        } else x.drawImage(tex[b], X, Y);
      }
    }
    // Daylight fades with depth.
    const g = x.createLinearGradient(0, 16, 0, canvas.height);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    x.fillStyle = g;
    x.fillRect(0, 16, canvas.width, canvas.height);
  }

  paint();
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }).observe(document.body);
}
