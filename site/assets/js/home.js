import { loadWorld, MapView, biomeLabel } from './biome-map.js';

document.documentElement.classList.add('js');

const SPLASHES = [
  'Los Pollos MineHermanos!', 'Now with Terralith!', 'Tag, you\'re it!', 'Bedrock welcome!',
  'Graves included!', 'No keep-inventory!', 'Free towns!', 'Proximity voice!', 'The End is closed!',
  '100% real biomes!', 'Backpacks!', '200+ new foods!',
];
document.getElementById('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];

// ---------- Copy buttons ----------

for (const btn of document.querySelectorAll('[data-copy]')) {
  const label = btn.querySelector('span');
  const original = label.textContent;
  const icon = btn.querySelector('i');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      label.textContent = 'Copied!';
      icon.className = 'ph-bold ph-check';
      btn.dataset.copied = '';
    } catch {
      label.textContent = 'Select & copy it';
    }
    setTimeout(() => {
      label.textContent = original;
      icon.className = 'ph-bold ph-copy';
      delete btn.dataset.copied;
    }, 2000);
  });
}

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
    players.textContent = `${s.players.online}/${s.players.max}`;
    const names = (s.players.list || []).map((p) => p.name);
    players.title = names.length ? `Online: ${names.join(', ')}` : 'Nobody online';
    players.setAttribute('aria-label', `${s.players.online} of ${s.players.max} players online`);
    if (s.motd?.clean?.length) document.getElementById('motd').textContent = s.motd.clean.join(' ');
  } catch {
    ping.dataset.state = 'unknown';
    players.textContent = '26.3';
  }
})();

// ---------- Toasts slide in once ----------

const toasts = document.querySelector('.toasts');
new IntersectionObserver((entries, obs) => {
  if (entries.some((e) => e.isIntersecting)) {
    toasts.classList.add('is-in');
    obs.disconnect();
  }
}, { threshold: 0.3 }).observe(toasts);

// ---------- Datapack inventory ----------

const MR = 'https://cdn.modrinth.com/data/';
const VT = 'https://vanillatweaks.net/assets/resources/icons/datapacks/26.3/';
const PACKS = [
  { name: 'Terralith', kind: 'World generation', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/terralith',
    icon: `${MR}8oi3bsk5/1959d924a1088944bbf07a06ba523726112d7e7a_96.webp`,
    shot: `${MR}8oi3bsk5/images/4957da7c3da1386fb12b76001a2321be7b2ff9bc_350.webp`,
    desc: 'Almost 100 new biomes, realism with a dash of fantasy, all from vanilla blocks.' },
  { name: 'Structory', kind: 'Structures', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/structory',
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
  { name: 'Incendium', kind: 'Nether generation', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/incendium',
    icon: `${MR}ZVzW5oNS/65c8dcaaf260e5b2182c228a1a442c792a7c4782.jpeg`,
    desc: 'Nether biomes overhauled, with tough structures, unique weapons and tricky mobs.' },
  { name: 'Amplified Nether', kind: 'Nether generation', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/amplified-nether',
    icon: `${MR}wXiGiyGX/6673676af05cb98985909f2378ff0f87ee951401_96.webp`,
    desc: 'Double-height, amplified Nether terrain.' },
  { name: 'Nullscape', kind: 'End generation', by: 'Stardust Labs', url: 'https://modrinth.com/datapack/nullscape',
    icon: `${MR}LPjGiSO4/30249e0548b8643b1559889eab585683cb397f3a_96.webp`,
    desc: 'Surreal alien terrain for the End. Waiting for the day the End opens.' },
  { name: 'Backpacks & More', kind: 'Items', by: 'UltroGhast', url: 'https://modrinth.com/datapack/backpacksdp',
    icon: `${MR}mbRlC0kb/4f0958246ea4868d75aa479c45c49879dedefd02.png`,
    shot: `${MR}mbRlC0kb/images/96eda816d631b18de27c4dd8cfde4df333d21fc1_350.webp`,
    desc: 'Craftable backpacks you can see on your back, 27 slots each.' },
  { name: 'Reg\'s More Foods', kind: 'Food', by: 'regfunkid', url: 'https://modrinth.com/datapack/reg-more-foods',
    icon: `${MR}2jidfU3A/bf7f815ab014d2464b64d6070f14a3e7e319939d_96.webp`,
    shot: `${MR}2jidfU3A/images/6aa162a82eb570097d64ae37e0d90f75fdf69868_350.webp`,
    desc: '200+ new foods. Their textures come with the modpack.' },
  { name: 'MasterCutter', kind: 'Recipes', by: 'Nico4play', url: 'https://modrinth.com/datapack/mastercutter',
    icon: `${MR}DuUMFIfX/d8a4745d2baf7525dcea2c00dccdd557f3b26e70_96.webp`,
    desc: '500+ stonecutter recipes: woodcutting, more stone cuts, recycling.' },
  { name: 'Graves', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: 'https://vanillatweaks.net/picker/datapacks/',
    icon: `${VT}graves.png`, desc: 'Dying leaves a grave holding everything you dropped. Click it to get it all back.' },
  { name: 'More Mob Heads', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: 'https://vanillatweaks.net/picker/datapacks/',
    icon: `${VT}more%20mob%20heads.png`, desc: 'Mobs sometimes drop their head.' },
  { name: 'Player Head Drops', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: 'https://vanillatweaks.net/picker/datapacks/',
    icon: `${VT}player%20head%20drops.png`, desc: 'Players drop their head when killed by another player.' },
  { name: 'Armor Statues', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: 'https://vanillatweaks.net/picker/datapacks/',
    icon: `${VT}armor%20statues.png`, desc: 'A book that lets you pose armor stands in survival.' },
  { name: 'Fast Leaf Decay', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: 'https://vanillatweaks.net/picker/datapacks/',
    icon: `${VT}fast%20leaf%20decay.png`, desc: 'Leaves vanish quickly once you chop a tree.' },
  { name: 'Track Statistics', kind: 'Vanilla Tweaks', by: 'Vanilla Tweaks', url: 'https://vanillatweaks.net/picker/datapacks/',
    icon: `${VT}track%20statistics.png`, desc: 'Extra stats like kilometres swum and flown.' },
];

const grid = document.getElementById('pack-grid');
const detail = document.getElementById('pack-detail');

function showPack(i) {
  const p = PACKS[i];
  for (const s of grid.children) s.setAttribute('aria-selected', String(s.dataset.i === String(i)));
  detail.replaceChildren();
  const title = Object.assign(document.createElement('p'), { className: 'tooltip__title', textContent: p.name });
  const kind = Object.assign(document.createElement('p'), { className: 'pack-kind', textContent: p.kind });
  const desc = Object.assign(document.createElement('p'), { className: 'pack-desc', textContent: p.desc });
  detail.append(title, kind, desc);
  if (p.shot) {
    detail.append(Object.assign(document.createElement('img'), {
      className: 'pack-shot', src: p.shot, alt: `${p.name} screenshot`, loading: 'lazy', decoding: 'async',
    }));
  }
  const credit = document.createElement('p');
  credit.className = 'pack-credit';
  credit.append('By ', Object.assign(document.createElement('a'), { href: p.url, textContent: p.by }));
  detail.append(credit);
}

PACKS.forEach((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pack-slot slot';
  b.dataset.i = i;
  b.setAttribute('role', 'option');
  b.setAttribute('aria-label', p.name);
  b.title = p.name;
  // vanillatweaks.net refuses hotlinks that send a Referer.
  b.append(Object.assign(document.createElement('img'), { src: p.icon, alt: '', width: 54, height: 54, loading: 'lazy', referrerPolicy: 'no-referrer' }));
  b.addEventListener('click', () => showPack(i));
  b.addEventListener('mouseenter', () => showPack(i));
  b.addEventListener('focus', () => showPack(i));
  grid.append(b);
});
showPack(0);

// ---------- Modpack crafting grid ----------

const MODS = [
  ['Simple Voice Chat', 'Proximity voice chat. Press V in game.', `${MR}9eGKb6K1/icon.png`],
  ['Sodium', 'A much faster renderer: more FPS.', `${MR}AANobbMI/295862f4724dc3f78df3447ad6072b2dcd3ef0c9_96.webp`],
  ['Iris Shaders', 'Shaders, off by default. K toggles them.', `${MR}YL57xq9U/18d0e7f076d3d6ed5bedd472b853909aac5da202_96.webp`],
  ['Complementary Reimagined', 'The shader pack Iris uses when you turn it on.', `${MR}HVnmMxH1/79cb7c8123bbc54945305b2ebad6b8881efdf5f8_96.webp`],
  ['LambDynamicLights', 'Torches in your hand light up the area.', `${MR}yBW8D80W/d4f5c3ff8df7caf024178b04eca6d69f95979cfe_96.webp`],
  ['Inventory Profiles Next', 'Sort your inventory with one button.', `${MR}O7RBXm3n/04cdecd37b4c7409f70d36fcdc85722ebf14aab8_96.webp`],
  ['AppleSkin', 'Shows food and saturation values.', `${MR}EsAfCjCV/icon.png`],
  ['Jade', 'Hover a block or mob to see what it is.', `${MR}nvQzSEkH/b04217bc2b7dc524c4d12f81ff42cc1cefb9b0fc_96.webp`],
  ['Continuity', 'Connected glass and bookshelf textures.', `${MR}1IjD5062/icon.png`],
];
const modGrid = document.getElementById('mod-grid');
const caption = document.getElementById('mod-caption');
const defaultCaption = 'Plus Lithium, FerriteCore, Entity Culling, ImmediatelyFast, Mod Menu, Mouse Tweaks and the food and dungeon textures.';
caption.textContent = defaultCaption;
for (const [name, what, icon] of MODS) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mod-slot slot';
  b.setAttribute('aria-label', `${name}: ${what}`);
  b.append(Object.assign(document.createElement('img'), { src: icon, alt: '', width: 44, height: 44, loading: 'lazy' }));
  const show = () => { caption.textContent = `${name}: ${what}`; };
  b.addEventListener('mouseenter', show);
  b.addEventListener('focus', show);
  b.addEventListener('click', show);
  b.addEventListener('mouseleave', () => { caption.textContent = defaultCaption; });
  li.append(b);
  modGrid.append(li);
}

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
