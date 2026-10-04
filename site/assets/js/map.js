import { loadWorld, MapView, findAreas, biomeLabel } from './biome-map.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map');
const hover = $('hover');
const coords = $('coords');
const fmt = new Intl.NumberFormat('en-US');

function parseHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const num = (k) => (p.has(k) && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : null);
  return { x: num('x'), z: num('z'), s: num('s'), b: p.get('b') };
}

function relTime(date) {
  const mins = Math.round((Date.now() - date) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} h ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

let world;
let view;

try {
  world = await loadWorld('../data/map/');
} catch (err) {
  console.error(err);
  $('loading').classList.add('is-error');
  $('loading').querySelector('p').textContent = 'Could not load the map data. Try again in a minute.';
  throw err;
}

const { meta } = world;
const spawn = meta.spawn || { x: 0, z: 0 };
const updated = new Date(meta.generatedAt);
$('updated').textContent = `Updated ${relTime(updated)}`;
$('updated').title = updated.toLocaleString();

view = new MapView(canvas, world);
const initial = parseHash();
view.setView(initial.x ?? spawn.x, initial.z ?? spawn.z, initial.s ?? view.width / 3000);
$('loading').classList.add('is-done');

// ---------- Overlays that follow the view ----------

const marker = $('spawn-marker');
marker.hidden = false;
let target = null;
let currentArea = null;

let hashTimer = 0;
view.onChange((v) => {
  const p = v.toScreen(spawn.x, spawn.z);
  marker.style.left = `${p.x}px`;
  marker.style.top = `${p.y}px`;
  if (target && currentArea) {
    const t = v.toScreen(currentArea.x, currentArea.z);
    target.style.left = `${t.x}px`;
    target.style.top = `${t.y}px`;
  }
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const p2 = new URLSearchParams({ x: Math.round(v.x), z: Math.round(v.z), s: v.scale.toPrecision(3) });
    if (selected) p2.set('b', meta.biomes[selected - 1].id);
    history.replaceState(null, '', `#${p2}`);
  }, 250);
});
view.draw();

// ---------- Hover / tap readout ----------

function describe(sx, sy) {
  const pt = view.toWorld(sx, sy);
  const x = Math.floor(pt.x);
  const z = Math.floor(pt.z);
  const b = biomeLabel(world, world.biomeAt(x, z));
  coords.textContent = `X: ${x}  Z: ${z}${b ? `  ${b.name}` : ''}`;
  return { x, z, b };
}

function showHover(clientX, clientY) {
  const { x, z, b } = describe(clientX, clientY);
  if (!b) { hover.hidden = true; return; }
  hover.replaceChildren(
    Object.assign(document.createElement('span'), { className: 'tooltip__title', textContent: b.name }),
    Object.assign(document.createElement('span'), { className: 'hover__mod', textContent: b.source }),
    Object.assign(document.createElement('span'), { className: 'hover__pos', textContent: `X ${fmt.format(x)}  Z ${fmt.format(z)}` }),
  );
  hover.hidden = false;
  const w = hover.offsetWidth;
  const h = hover.offsetHeight;
  const left = clientX + 18 + w > innerWidth ? clientX - 18 - w : clientX + 18;
  const top = clientY + 18 + h > innerHeight ? clientY - 18 - h : clientY + 18;
  hover.style.left = `${Math.max(4, left)}px`;
  hover.style.top = `${Math.max(4, top)}px`;
}

// ---------- Pan / zoom ----------

const pointers = new Map();
let pinch = null;
let moved = 0;
let tapTimer = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  canvas.classList.add('is-dragging');
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) {
    if (e.pointerType === 'mouse') showHover(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved += Math.abs(dx) + Math.abs(dy);
  if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    view.panBy(dx / 2, dy / 2);
    view.zoomAt(dist / pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
    pinch.dist = dist;
  } else if (pointers.size === 1) {
    view.panBy(dx, dy);
  }
  if (e.pointerType === 'mouse') showHover(e.clientX, e.clientY);
  else hover.hidden = true;
});

function endPointer(e) {
  const wasTap = pointers.size === 1 && moved < 6;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) canvas.classList.remove('is-dragging');
  if (wasTap && e.type === 'pointerup' && e.pointerType !== 'mouse') {
    showHover(e.clientX, e.clientY);
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { hover.hidden = true; }, 2500);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover.hidden = true; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 33 : 1;
  view.zoomAt(Math.exp(-e.deltaY * unit * 0.0018), e.clientX, e.clientY);
  showHover(e.clientX, e.clientY);
}, { passive: false });

canvas.addEventListener('keydown', (e) => {
  const step = 96;
  const keys = {
    ArrowLeft: () => view.panBy(step, 0), ArrowRight: () => view.panBy(-step, 0),
    ArrowUp: () => view.panBy(0, step), ArrowDown: () => view.panBy(0, -step),
    '+': () => view.zoomAt(1.5), '=': () => view.zoomAt(1.5), '-': () => view.zoomAt(1 / 1.5),
  };
  if (keys[e.key]) { e.preventDefault(); keys[e.key](); describe(view.width / 2, view.height / 2); }
});

$('zoom-in').addEventListener('click', () => view.zoomAt(1.6));
$('zoom-out').addEventListener('click', () => view.zoomAt(1 / 1.6));
$('go-spawn').addEventListener('click', () => view.setView(spawn.x, spawn.z, Math.max(view.scale, 0.5)));
// The desktop panel floats over the map's right side; phones use a bottom sheet instead.
const panelInset = () => (matchMedia('(max-width: 760px)').matches ? 0 : $('panel').offsetWidth + 16);
$('go-fit').addEventListener('click', () => { hover.hidden = true; view.fit(undefined, 24, panelInset()); });

// ---------- Biome list, search, area finder ----------

const list = $('biomes');
const search = $('search');
const totalCells = meta.biomes.reduce((n, b) => n + b.cells, 0);
let selected = 0;
let areas = [];
let areaIndex = 0;

const order = meta.biomes.map((b, i) => ({ ...b, index: i + 1 })).sort((a, b) => b.cells - a.cells);

function renderList() {
  const q = search.value.trim().toLowerCase();
  const items = order.filter((b) => !q || b.name.toLowerCase().includes(q) || b.id.includes(q.replaceAll(' ', '_')));
  list.replaceChildren();
  if (items.length === 0) {
    list.append(Object.assign(document.createElement('li'), { className: 'empty', textContent: `No biome matches "${search.value}" in our world.` }));
    return;
  }
  for (const b of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'biome';
    btn.setAttribute('aria-pressed', String(b.index === selected));
    const share = (b.cells / totalCells) * 100;
    const pct = share >= 1 ? `${share.toFixed(0)}%` : share >= 0.1 ? `${share.toFixed(1)}%` : '<0.1%';
    const sw = Object.assign(document.createElement('span'), { className: 'swatch' });
    sw.style.background = b.color;
    const name = Object.assign(document.createElement('span'), { className: 'biome__name', textContent: b.name });
    const src = Object.assign(document.createElement('span'), {
      className: `biome__src${b.source === 'Vanilla' ? '' : ' biome__src--mod'}`,
      textContent: `${b.source === 'Vanilla' ? '' : `${b.source} · `}${pct}`,
    });
    btn.append(sw, name, src);
    btn.addEventListener('click', () => select(b.index === selected ? 0 : b.index));
    li.append(btn);
    list.append(li);
  }
}

function goToArea(i) {
  if (!areas.length) return;
  areaIndex = (i + areas.length) % areas.length;
  const a = areas[areaIndex];
  currentArea = a;
  const span = Math.max(a.maxX - a.minX, a.maxZ - a.minZ, 256);
  const fitScale = Math.min(view.width - panelInset(), view.height) / (span * 2.2);
  const scale = Math.min(Math.max(fitScale, 0.08), 2);
  hover.hidden = true;
  view.setView(a.x + panelInset() / 2 / scale, a.z, scale);
  const dist = Math.round(Math.hypot(a.x - spawn.x, a.z - spawn.z));
  $('finder-area').textContent = `${areaIndex + 1} of ${areas.length} · ${fmt.format(a.maxX - a.minX)}×${fmt.format(a.maxZ - a.minZ)} · ${fmt.format(dist)} from spawn`;
}

function select(index) {
  selected = index;
  view.setHighlight(index);
  renderList();
  if (target) { target.remove(); target = null; }
  currentArea = null;
  if (!index) {
    $('finder').hidden = true;
    view.draw();
    return;
  }
  const b = meta.biomes[index - 1];
  // Nearest to spawn first: the most useful answer to "where's the closest cherry grove?"
  areas = findAreas(world, index).sort((a, c) =>
    Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(c.x - spawn.x, c.z - spawn.z));
  $('finder').hidden = false;
  $('finder-swatch').style.background = b.color;
  $('finder-name').textContent = b.name;
  $('finder-count').textContent = `${areas.length} separate ${areas.length === 1 ? 'area' : 'areas'}, nearest to spawn first.`;
  target = Object.assign(document.createElement('div'), { className: 'target' });
  document.body.append(target);
  // On phones the sheet covers the map: drop it so the highlighted area is visible.
  $('panel').classList.remove('is-open');
  $('sheet-toggle').setAttribute('aria-expanded', 'false');
  goToArea(0);
}

search.addEventListener('input', renderList);
search.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = list.querySelector('.biome');
    if (first) first.click();
  }
});
$('finder-prev').addEventListener('click', () => goToArea(areaIndex - 1));
$('finder-next').addEventListener('click', () => goToArea(areaIndex + 1));
$('finder-clear').addEventListener('click', () => select(0));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selected) select(0);
});

const sheet = $('sheet-toggle');
sheet.addEventListener('click', () => {
  const open = $('panel').classList.toggle('is-open');
  sheet.setAttribute('aria-expanded', String(open));
});

renderList();
if (initial.b) {
  const i = meta.biomes.findIndex((b) => b.id === initial.b);
  if (i >= 0) {
    select(i + 1);
    if (initial.x !== null) view.setView(initial.x, initial.z, initial.s ?? view.scale);
  }
}
describe(view.width / 2, view.height / 2);
