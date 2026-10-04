import { loadWorld, MapView, biomeLabel } from './biome-map.js';

document.documentElement.classList.add('js');

const SPLASHES = [
  'Los Pollos MineHermanos!', 'Now with Terralith!', 'Tag, you\'re it!', 'Bedrock welcome!',
  'Graves included!', 'No keep-inventory!', 'Free towns!', 'Proximity voice!', 'The End is closed!',
  '100% real biomes!', 'Backpacks!', '200+ new foods!',
];
document.getElementById('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

const icon = (name) => el('i', { className: `ph-bold ph-${name}`, ariaHidden: 'true' });
const pageLink = (href, label) => el('a', { className: 'page-link', href }, label, icon('arrow-square-out'));

// ---------- Live server status (mcsrvstat.us, free, caches ~5 min) ----------

(async () => {
  const ping = document.getElementById('ping');
  const players = document.getElementById('players');
  try {
    const res = await fetch('https://api.mcsrvstat.us/3/sirbepy.mcserver.host');
    const s = await res.json();
    if (!s.online) {
      ping.dataset.state = 'offline';
      players.textContent = 'Offline right now';
      return;
    }
    ping.dataset.state = 'online';
    players.textContent = `${s.players.online}/${s.players.max} online`;
    const names = (s.players.list || []).map((p) => p.name);
    players.title = names.length ? `Online: ${names.join(', ')}` : 'Nobody online';
    players.setAttribute('aria-label', `${s.players.online} of ${s.players.max} players online`);
    if (s.motd?.clean?.length) document.getElementById('motd').textContent = s.motd.clean.join(' ');
  } catch {
    ping.dataset.state = 'unknown';
    players.textContent = '26.3';
  }
})();

// ---------- Hero carousel ----------

// Squarespace's CDN resizes on request via ?format=<width>w.
const SQ = 'https://images.squarespace-cdn.com/content/v1/6240c1f3e10b50416d969a84/';
const sq = (path, w) => `${SQ}${path}?format=${w}w`;
const srcset = (url) => [1000, 1500, 2500].map((w) => `${url}?format=${w}w ${w}w`).join(', ');

(() => {
  const slides = [...document.querySelectorAll('#carousel .slide')];
  const credit = document.getElementById('slide-credit');
  const dotsWrap = document.getElementById('slide-dots');
  const pauseBtn = document.getElementById('slide-pause');
  const DELAY = 6500;
  let current = 0;
  let timer = 0;
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const load = (i) => {
    const img = slides[i].querySelector('img');
    if (img.srcset) return;
    img.sizes = '100vw';
    img.srcset = srcset(img.dataset.src);
    img.src = `${img.dataset.src}?format=1500w`;
  };

  const dots = slides.map((_, i) => {
    const b = el('button', { type: 'button', className: 'dot', ariaLabel: `Show screenshot ${i + 1}` });
    b.addEventListener('click', () => { show(i); restart(); });
    dotsWrap.append(b);
    return b;
  });

  function show(i) {
    current = (i + slides.length) % slides.length;
    load(current);
    load((current + 1) % slides.length);
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === current);
      s.setAttribute('aria-hidden', String(k !== current));
    });
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === current)));
    credit.textContent = slides[current].dataset.pack;
    credit.href = slides[current].dataset.url;
  }

  function restart() {
    clearTimeout(timer);
    if (!paused && !document.hidden) timer = setTimeout(() => { show(current + 1); restart(); }, DELAY);
  }

  function setPaused(p) {
    paused = p;
    pauseBtn.ariaLabel = p ? 'Play slideshow' : 'Pause slideshow';
    pauseBtn.querySelector('i').className = `ph-bold ph-${p ? 'play' : 'pause'}`;
    restart();
  }

  document.getElementById('slide-prev').addEventListener('click', () => { show(current - 1); restart(); });
  document.getElementById('slide-next').addEventListener('click', () => { show(current + 1); restart(); });
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  document.addEventListener('visibilitychange', restart);

  show(0);
  setPaused(paused);
})();

// ---------- Worldgen paintings ----------

const SD = 'https://www.stardustlabs.net/';
const MR = 'https://cdn.modrinth.com/data/';
const PAINTINGS = [
  { size: 'big', pack: 'Terralith', where: 'Overworld', url: `${SD}terralith`, w: 1000,
    src: '0f931c73-3ba9-409e-a05c-2e299d8f6872/2022-02-20_20.04.24.png', alt: 'Snowy Terralith mountains around turquoise lakes and orange slopes' },
  { size: 'wide', pack: 'Structory', where: 'Overworld', url: `${SD}structory`, w: 750,
    src: '028745c6-5ff8-481c-8a5a-e752f74b3065/2022-06-22_20.54.30.png', alt: 'A mossy Structory ruin with a campfire at dusk' },
  { pack: 'Terralith', where: 'Overworld', url: `${SD}terralith`, w: 500,
    src: 'c83364e8-c73d-48e6-9f5e-2708dbc85130/2022-02-22_13.40.40.png', alt: 'A Terralith volcano with lava running down black rock' },
  { pack: 'Terralith', where: 'Overworld', url: `${SD}terralith`, w: 500,
    src: '7e37a263-dd2a-4787-9258-0452e6707707/2021-11-23_15.29.37.png', alt: 'Blue ice caves carved into a Terralith glacier' },
  { size: 'wide', pack: 'Incendium', where: 'Nether', url: `${SD}incendium`, w: 750,
    src: 'b7a40aa0-b514-4b8b-9059-66d9cf3a255b/NkxSscQ.jpeg', alt: 'An Incendium Nether landscape of lava lakes and towering ruins' },
  { pack: 'Structory: Towers', where: 'Overworld', url: 'https://modrinth.com/datapack/structory-towers',
    full: `${MR}j3FONRYr/images/b4f8eb693c6679fa4dc075028fff5b3b19c5fdb8.png`, alt: 'A Structory: Towers mirage outpost in the desert' },
  { pack: 'Dungeons and Taverns', where: 'Overworld', url: 'https://modrinth.com/datapack/dungeons-and-taverns',
    full: `${MR}tpehi7ww/images/93dc2790ee15a172f5e7a9100790dedde9ea6b35.webp`, alt: 'A cosy Dungeons and Taverns tavern' },
  { pack: 'Terralith', where: 'Overworld', url: `${SD}terralith`, w: 500,
    src: '53d1319a-a523-4256-a0f1-e878134e7d6f/2022-02-26_01.37.41.png', alt: 'A village in a green Terralith valley under dark peaks' },
  { pack: 'Nullscape', where: 'The End', url: `${SD}nullscape`, w: 500,
    src: '59dda74f-102f-4f93-9939-2af33c3f4761/2022-06-08_14.32.22.png', alt: 'A glowing island floating over the Nullscape void' },
  { size: 'big', pack: 'Incendium', where: 'Nether', url: `${SD}incendium`, w: 1000,
    src: 'f33a23d1-246a-4c03-a889-88104df3978c/2022-02-19_16.04.52.png', alt: 'A pale Incendium palace standing in a lava sea' },
  { size: 'wide', pack: 'Structory', where: 'Overworld', url: `${SD}structory`, w: 750,
    src: '6fc81043-d875-4969-a043-fe4f189cb0da/2022-06-22_17.04.38.png', alt: 'Sandstone Structory ruins across desert dunes' },
  { pack: 'Terralith', where: 'Overworld', url: `${SD}terralith`, w: 500,
    src: 'e206d910-ed25-415e-87ba-be5d79ea5bc9/2021-11-20_19.10.53.png', alt: 'A dim Terralith swamp under tall rock spires' },
  { pack: 'Incendium', where: 'Nether', url: `${SD}incendium`, w: 500,
    src: '492b3acf-a23b-46a6-8184-ed1ce8e8014d/ehxNxVv.jpeg', alt: 'A huge red Incendium cavern hung with crimson vines' },
  { size: 'wide', pack: 'Nullscape', where: 'The End', url: `${SD}nullscape`, w: 750,
    src: '71e9df8a-e8a3-4ac0-9879-5fa42c8bfe8a/2022-06-08_14.49.16.png', alt: 'Purple crystal cliffs in the Nullscape End' },
];

document.getElementById('paintings').append(...PAINTINGS.map((p) => el('li', { className: `painting${p.size ? ` painting--${p.size}` : ''}` },
  el('img', { src: p.full || sq(p.src, p.w), alt: p.alt, loading: 'lazy', decoding: 'async' }),
  el('a', { className: 'painting__tag', href: p.url },
    el('b', {}, p.pack), el('span', {}, p.where), icon('arrow-square-out')),
)));

// ---------- Datapack inventory ----------

const VT = 'https://vanillatweaks.net/assets/resources/icons/datapacks/26.3/';
const VT_PAGE = 'https://vanillatweaks.net/picker/datapacks/';
const PACKS = [
  { name: 'Terralith', kind: 'World generation', by: 'Stardust Labs', url: `${SD}terralith`,
    icon: `${MR}8oi3bsk5/1959d924a1088944bbf07a06ba523726112d7e7a_96.webp`,
    shot: `${MR}8oi3bsk5/images/4957da7c3da1386fb12b76001a2321be7b2ff9bc_350.webp`,
    desc: 'Almost 100 new biomes, realism with a dash of fantasy, all from vanilla blocks.' },
  { name: 'Structory', kind: 'Structures', by: 'Stardust Labs', url: `${SD}structory`,
    icon: `${MR}aKCwCJlY/81c79a9d58c605ad79c4a8da15c865902bec8d42_96.webp`,
    shot: `${MR}aKCwCJlY/images/009e986b0e796b249ce8ad7d894c4271af32d901_350.webp`,
    desc: 'Atmospheric ruins and buildings with a little lore.' },
  { name: 'Structory: Towers', kind: 'Structures', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/structory-towers',
    icon: `${MR}j3FONRYr/e7d6877a7b7a03680383fd1a1fdd3496604e372a_96.webp`,
    shot: `${MR}j3FONRYr/images/a4156ac0e074a4899e581703d14ac2618d8d79be_350.webp`,
    desc: 'Towers themed to the biome they stand in.' },
  { name: 'Dungeons and Taverns', kind: 'Structures', by: 'NovaWostra', url: 'https://modrinth.com/datapack/dungeons-and-taverns',
    icon: `${MR}tpehi7ww/429ba22d212868940cdd82465df949ac51c9791e_96.webp`,
    shot: `${MR}tpehi7ww/images/048b4a06f670fb68af5071cc20a957e2ad06dc55_350.webp`,
    desc: 'Dungeons, taverns and other places to find while you explore.' },
  { name: 'Incendium', kind: 'Nether generation', by: 'Stardust Labs', url: `${SD}incendium`,
    icon: `${MR}ZVzW5oNS/65c8dcaaf260e5b2182c228a1a442c792a7c4782.jpeg`,
    shot: sq('62cdcc04-8b69-4359-ad85-3196b4401f55/2022-06-10_13.42.10.png', 500),
    desc: 'Nether biomes overhauled, with tough structures, unique weapons and tricky mobs.' },
  { name: 'Amplified Nether', kind: 'Nether generation', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/amplified-nether',
    icon: `${MR}wXiGiyGX/6673676af05cb98985909f2378ff0f87ee951401_96.webp`,
    desc: 'Double-height, amplified Nether terrain.' },
  { name: 'Nullscape', kind: 'End generation', by: 'Stardust Labs', url: `${SD}nullscape`,
    icon: `${MR}LPjGiSO4/30249e0548b8643b1559889eab585683cb397f3a_96.webp`,
    shot: sq('a335f8f9-e4d9-4bd3-987b-21761a2f9b74/2022-06-08_14.32.22.png', 500),
    desc: 'Surreal alien terrain for the End. Waiting for the day the End opens.' },
  { name: 'Backpacks!', kind: 'Items', by: 'Eclipse Studios', url: 'https://modrinth.com/datapack/vanilla-backpacks',
    icon: `${MR}MGcd6kTf/92c378c17ca08571527577fa73309a6e962cbebd_96.webp`,
    shot: `${MR}MGcd6kTf/images/bc442cc580c700102335cf07e826c1b354c3a3fc_350.webp`,
    desc: 'Craftable backpacks, 3 slots up to 40 with smithing table upgrades. Dye them too.' },
  { name: 'Reg\'s More Foods', kind: 'Food', by: 'regfunkid', url: 'https://modrinth.com/datapack/reg-more-foods',
    icon: `${MR}2jidfU3A/bf7f815ab014d2464b64d6070f14a3e7e319939d_96.webp`,
    shot: `${MR}2jidfU3A/images/6aa162a82eb570097d64ae37e0d90f75fdf69868_350.webp`,
    desc: '200+ new foods. Their textures come with the modpack.' },
  { name: 'MasterCutter', kind: 'Recipes', by: 'Nico4play', url: 'https://modrinth.com/datapack/mastercutter',
    icon: `${MR}DuUMFIfX/d8a4745d2baf7525dcea2c00dccdd557f3b26e70_96.webp`,
    desc: '500+ stonecutter recipes: woodcutting, more stone cuts, recycling.' },
  { name: 'Graves', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: VT_PAGE,
    icon: `${VT}graves.png`, desc: 'Dying leaves a grave holding everything you dropped. Click it to get it all back.' },
  { name: 'More Mob Heads', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: VT_PAGE,
    icon: `${VT}more%20mob%20heads.png`, desc: 'Mobs sometimes drop their head.' },
  { name: 'Player Head Drops', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: VT_PAGE,
    icon: `${VT}player%20head%20drops.png`, desc: 'Players drop their head when killed by another player.' },
  { name: 'Armor Statues', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: VT_PAGE,
    icon: `${VT}armor%20statues.png`, desc: 'A book that lets you pose armor stands in survival.' },
  { name: 'Fast Leaf Decay', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: VT_PAGE,
    icon: `${VT}fast%20leaf%20decay.png`, desc: 'Leaves vanish quickly once you chop a tree.' },
  { name: 'Track Statistics', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: VT_PAGE,
    icon: `${VT}track%20statistics.png`, desc: 'Extra stats like kilometres swum and flown.' },
];

// vanillatweaks.net refuses hotlinks that send a Referer.
const packIcon = (p, size) => el('img', { src: p.icon, alt: '', width: size, height: size, loading: 'lazy', referrerPolicy: 'no-referrer' });

/**
 * Click-to-select slots driving a detail area. Every card is rendered up front and stacked
 * in one grid cell, so the area is always as tall as its tallest card and never shifts.
 */
function selectable(slots, cards, detail, { toggle = false, fallback = null } = {}) {
  // With a fallback, it sits at index 0 and shows while nothing is selected (-1).
  const all = fallback ? [fallback, ...cards] : cards;
  const offset = fallback ? 1 : 0;
  detail.append(...all);
  let selected = -1;
  const select = (i) => {
    selected = toggle && i === selected ? -1 : i;
    slots.forEach((s, k) => s.setAttribute('aria-pressed', String(k === selected)));
    all.forEach((c, k) => {
      const on = k === selected + offset;
      c.classList.toggle('is-shown', on);
      c.inert = !on;
    });
  };
  slots.forEach((s, i) => s.addEventListener('click', () => select(i)));
  return select;
}

const packGrid = document.getElementById('pack-grid');
const packDetail = document.getElementById('pack-detail');
const packSlots = PACKS.map((p) => {
  const b = el('button', { type: 'button', className: 'pack-slot slot', ariaLabel: p.name, title: p.name }, packIcon(p, 54),
    el('span', { className: 'pack-slot__text' }, el('b', {}, p.name), el('span', {}, p.desc)));
  b.setAttribute('aria-controls', 'pack-detail');
  packGrid.append(b);
  return b;
});
const packCards = PACKS.map((p) => el('div', { className: 'card' },
  el('p', { className: 'tooltip__title' }, p.name),
  el('p', { className: 'pack-kind' }, p.kind),
  el('p', { className: 'pack-desc' }, p.desc),
  p.shot
    ? el('img', { className: 'pack-shot', src: p.shot, alt: `${p.name} screenshot`, loading: 'lazy', decoding: 'async' })
    : el('div', { className: 'pack-shot pack-shot--icon' }, packIcon(p, 96)),
  el('p', { className: 'pack-credit' }, `By ${p.by} · `, pageLink(p.url, p.by === 'Vanilla Tweaks' ? 'Vanilla Tweaks picker' : 'Pack page')),
));
selectable(packSlots, packCards, packDetail)(0);

// ---------- Modpack crafting grid ----------

const MOD = 'https://modrinth.com/mod/';
const MODS = [
  ['Simple Voice Chat', 'Proximity voice chat. Press V in game.', `${MR}9eGKb6K1/icon.png`, `${MOD}simple-voice-chat`],
  ['Sodium', 'A much faster renderer: more FPS.', `${MR}AANobbMI/295862f4724dc3f78df3447ad6072b2dcd3ef0c9_96.webp`, `${MOD}sodium`],
  ['Iris Shaders', 'Shaders, off by default. K toggles them.', `${MR}YL57xq9U/18d0e7f076d3d6ed5bedd472b853909aac5da202_96.webp`, `${MOD}iris`],
  ['Complementary Reimagined', 'The shader pack Iris uses when you turn it on.', `${MR}HVnmMxH1/79cb7c8123bbc54945305b2ebad6b8881efdf5f8_96.webp`, 'https://modrinth.com/shader/complementary-reimagined'],
  ['LambDynamicLights', 'Torches in your hand light up the area.', `${MR}yBW8D80W/d4f5c3ff8df7caf024178b04eca6d69f95979cfe_96.webp`, `${MOD}lambdynamiclights`],
  ['Inventory Profiles Next', 'Sort your inventory with one button.', `${MR}O7RBXm3n/04cdecd37b4c7409f70d36fcdc85722ebf14aab8_96.webp`, `${MOD}inventory-profiles-next`],
  ['AppleSkin', 'Shows food and saturation values.', `${MR}EsAfCjCV/icon.png`, `${MOD}appleskin`],
  ['Jade', 'Hover a block or mob to see what it is.', `${MR}nvQzSEkH/b04217bc2b7dc524c4d12f81ff42cc1cefb9b0fc_96.webp`, `${MOD}jade`],
  ['Roughly Enough Items', 'Look up any vanilla recipe: hover an item, press R.', `${MR}nfn13YXA/54ac5daa4166011bae713448e84413987316433a_96.webp`, `${MOD}rei`],
];
const EXTRAS = [
  ['Lithium', 'lithium'], ['FerriteCore', 'ferrite-core'], ['Entity Culling', 'entityculling'],
  ['ImmediatelyFast', 'immediatelyfast'], ['Continuity', 'continuity'], ['Mod Menu', 'modmenu'],
  ['Mouse Tweaks', 'mouse-tweaks'],
];

const modGrid = document.getElementById('mod-grid');
const modSlots = MODS.map(([name, , src]) => {
  const b = el('button', { type: 'button', className: 'mod-slot slot', ariaLabel: name, title: name },
    el('img', { src, alt: '', width: 44, height: 44, loading: 'lazy' }));
  b.setAttribute('aria-controls', 'mod-caption');
  modGrid.append(el('li', {}, b));
  return b;
});
const extras = [];
EXTRAS.forEach(([name, slug], i) => {
  extras.push(el('a', { href: `${MOD}${slug}` }, name), i < EXTRAS.length - 2 ? ', ' : i === EXTRAS.length - 2 ? ' and ' : '');
});
const modFallback = el('p', { className: 'card' }, 'Plus ', ...extras, ', and the food and dungeon textures.');
const modCards = MODS.map(([name, what, , url]) => el('div', { className: 'card' },
  el('p', {}, el('b', {}, name), ` · ${what}`),
  pageLink(url, 'Modrinth page'),
));
selectable(modSlots, modCards, document.getElementById('mod-caption'), { toggle: true, fallback: modFallback })(-1);

// ---------- Map teaser ----------

(async () => {
  const stats = document.getElementById('map-stats');
  const canvas = document.getElementById('teaser-map');
  const hover = document.getElementById('teaser-hover');
  const spawnIcon = document.getElementById('teaser-spawn');
  try {
    const world = await loadWorld('data/map/');
    const { meta } = world;
    const w = world.bounds.maxX - world.bounds.minX;
    const h = world.bounds.maxZ - world.bounds.minZ;
    const updated = new Date(meta.generatedAt);
    stats.textContent = `${meta.biomes.length} biomes across ${(w / 1000).toFixed(0)}k x ${(h / 1000).toFixed(0)}k blocks. Updated ${updated.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`;
    const view = new MapView(canvas, world, { background: '#e7d9b4' });
    const spawn = meta.spawn || { x: 0, z: 0 };
    const frame = () => view.setView(spawn.x, spawn.z, view.width / 3200);
    frame();
    new ResizeObserver(frame).observe(canvas);
    view.onChange((v) => {
      const p = v.toScreen(spawn.x, spawn.z);
      spawnIcon.style.left = `${p.x + canvas.offsetLeft}px`;
      spawnIcon.style.top = `${p.y + canvas.offsetTop}px`;
    });
    view.draw();
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const pt = view.toWorld(e.clientX - r.left, e.clientY - r.top);
      const b = biomeLabel(world, world.biomeAt(pt.x, pt.z));
      if (!b) { hover.hidden = true; return; }
      hover.textContent = b.name;
      hover.hidden = false;
      hover.style.left = `${e.clientX - r.left + canvas.offsetLeft + 16}px`;
      hover.style.top = `${e.clientY - r.top + canvas.offsetTop + 12}px`;
    });
    canvas.addEventListener('pointerleave', () => { hover.hidden = true; });
  } catch (err) {
    stats.textContent = 'The map data is still being generated.';
    console.error(err);
  }
})();
