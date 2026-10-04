// Biome colours for the map. Vanilla ids follow the Amidst / Chunkbase scheme players already
// know; Terralith ids are hand-picked to sit near their closest vanilla relative so the map
// reads the same way. Anything unlisted (a new vanilla biome, another datapack) gets a stable
// colour derived from its id, nudged toward a hue its name suggests.

const VANILLA = {
  ocean: '#000070', deep_ocean: '#000030', warm_ocean: '#0000ac', lukewarm_ocean: '#000090',
  deep_lukewarm_ocean: '#000040', cold_ocean: '#202070', deep_cold_ocean: '#202038',
  frozen_ocean: '#7070d6', deep_frozen_ocean: '#404090', river: '#0000ff', frozen_river: '#a0a0ff',
  beach: '#fade55', snowy_beach: '#faf0c0', stony_shore: '#a2a284', mushroom_fields: '#ff00ff',
  plains: '#8db360', sunflower_plains: '#b5db88', snowy_plains: '#ffffff', ice_spikes: '#b4dcdc',
  desert: '#fa9418', swamp: '#07f9b2', mangrove_swamp: '#2ccc8e',
  forest: '#056621', flower_forest: '#2d8e49', birch_forest: '#307444', old_growth_birch_forest: '#589c6c',
  dark_forest: '#40511a', dappled_forest: '#4a8a2e', pale_garden: '#696d6a', cherry_grove: '#ff91c8',
  taiga: '#0b6659', snowy_taiga: '#31554a', old_growth_pine_taiga: '#596651', old_growth_spruce_taiga: '#818e79',
  jungle: '#537b09', sparse_jungle: '#628b17', bamboo_jungle: '#768e14',
  savanna: '#bdb25f', savanna_plateau: '#a79d64', windswept_savanna: '#e5da87',
  badlands: '#d94515', wooded_badlands: '#b09765', eroded_badlands: '#ff6d3d',
  windswept_hills: '#606060', windswept_forest: '#507050', windswept_gravelly_hills: '#888888',
  meadow: '#60a445', grove: '#47726c', snowy_slopes: '#c4c4c4', jagged_peaks: '#dcdcc8',
  frozen_peaks: '#b0b3ce', stony_peaks: '#7b8f74',
  lush_caves: '#2c6e1a', dripstone_caves: '#7a5d3f', sulfur_caves: '#b8a838', deep_dark: '#0b2b2f',
  nether_wastes: '#bf3b3b', soul_sand_valley: '#5e3830', crimson_forest: '#dd0808',
  warped_forest: '#49907b', basalt_deltas: '#403636',
  the_end: '#8080ff', small_end_islands: '#4b4bab', end_midlands: '#c9c959', end_highlands: '#b5b536',
  end_barrens: '#7070cc', the_void: '#000000',
};

const TERRALITH = {
  alpha_islands: '#8ab352', alpha_islands_winter: '#e6f0f0', alpine_grove: '#4f7d72', alpine_highlands: '#8a9a7a',
  amethyst_canyon: '#9a6fc6', amethyst_rainforest: '#5f7f3a', ancient_sands: '#e8c070', arid_highlands: '#b8a15c',
  ashen_savanna: '#8f8a6a', basalt_cliffs: '#4a4a4f', birch_taiga: '#3b7a5a', blooming_plateau: '#9bc46a',
  blooming_valley: '#a7d07a', brushland: '#a8ad5c', bryce_canyon: '#e0703a', caldera: '#6b5a50',
  cloud_forest: '#3f7f63', cold_shrubland: '#8fa58a', desert_canyon: '#e88a3a', desert_oasis: '#5fb07a',
  desert_spires: '#e9a24a', emerald_peaks: '#3fa36a', forested_highlands: '#2f6b3a', fractured_savanna: '#c9b86a',
  frozen_cliffs: '#c8d8e8', glacial_chasm: '#9fc4e0', granite_cliffs: '#a86a5a', gravel_beach: '#a8a8a0',
  gravel_desert: '#9c9a8c', haze_mountain: '#7a8a8f', highlands: '#7aa055', hot_shrubland: '#b8a24a',
  ice_marsh: '#a8d8d0', jungle_mountains: '#4a6a1a', lavender_forest: '#8f6fbf', lavender_valley: '#ad8fd8',
  lush_desert: '#d8b85a', lush_valley: '#6fbf4a', mirage_isles: '#7fd0c8', moonlight_grove: '#3a5a7a',
  moonlight_valley: '#5a7aa0', orchid_swamp: '#3fd6a8', painted_mountains: '#c46a4a', red_oasis: '#c86a3a',
  rocky_jungle: '#5a7a2a', rocky_mountains: '#727272', rocky_shrubland: '#8a8a6a', sakura_grove: '#f0a0c8',
  sakura_valley: '#f7b8d6', sandstone_valley: '#d8b070', savanna_badlands: '#c8803a', savanna_slopes: '#b0a055',
  scarlet_mountains: '#b8483a', shield: '#3f6a4a', shield_clearing: '#6a9a5a', shrubland: '#9aa860',
  siberian_grove: '#3a6050', siberian_taiga: '#2a5a4c', skylands: '#9fd0ff', skylands_autumn: '#d89a4a',
  skylands_spring: '#b8e08a', skylands_summer: '#8ad07a', skylands_winter: '#e0f0ff', snowy_badlands: '#e8c8b8',
  snowy_cherry_grove: '#f6d6e6', snowy_maple_forest: '#c88a7a', snowy_shield: '#d8e4dc', steppe: '#a8a070',
  stony_spires: '#8a8a8a', temperate_highlands: '#5a8a4a', tropical_jungle: '#3a8a10', valley_clearing: '#8ac060',
  volcanic_crater: '#3a2a2a', volcanic_peaks: '#4a3a38', warm_river: '#2a5aff', warped_mesa: '#4a9a8a',
  white_cliffs: '#e8e8e0', white_mesa: '#e0d8c8', windswept_spires: '#9a9aa0', wintry_forest: '#5a7a70',
  wintry_lowlands: '#d0e0e0', yellowstone: '#c8b04a', yosemite_cliffs: '#7a8a6a', yosemite_lowlands: '#5a8a3a',
  'cave/andesite_caves': '#6a6a6a', 'cave/desert_caves': '#a8803a', 'cave/diorite_caves': '#b8b8b0',
  'cave/fungal_caves': '#8a5a9a', 'cave/granite_caves': '#8a5040', 'cave/ice_caves': '#80b0d0',
  'cave/infested_caves': '#5a5a50', 'cave/mantle_caves': '#5a2a1a', 'cave/thermal_caves': '#a04020',
  'cave/tuff_caves': '#4a4a44', 'cave/underground_jungle': '#2a5a1a', 'cave/crystal_caves': '#a070d0',
  'cave/deep_caves': '#2a2a30', 'cave/frostfire_caves': '#5a7ab0',
};

// Hue hints for unknown ids, checked in order.
const HINTS = [
  [/ocean|sea|river|lake|water/, 225], [/frozen|ice|snow|glacial|winter|frost/, 200],
  [/desert|sand|dune|beach/, 40], [/badlands|mesa|canyon|red|scarlet/, 15],
  [/swamp|marsh|bog|mangrove/, 160], [/jungle|rainforest|tropical/, 85],
  [/savanna|steppe|shrub|arid/, 55], [/cherry|sakura|blossom|pink/, 330],
  [/lavender|amethyst|purple|orchid/, 275], [/mountain|peak|cliff|spire|highland|stone|rock/, 90],
  [/taiga|pine|spruce|grove/, 160], [/forest|wood/, 120], [/plain|meadow|field|valley|clearing/, 95],
];

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function biomeColor(id) {
  const [ns, path = ns] = id.includes(':') ? id.split(':') : ['minecraft', id];
  if (ns === 'minecraft' && VANILLA[path]) return VANILLA[path];
  if (ns === 'terralith' && TERRALITH[path]) return TERRALITH[path];
  if (VANILLA[path]) return VANILLA[path];
  const h = fnv1a(id);
  const hint = HINTS.find(([re]) => re.test(path));
  const hue = hint ? (hint[1] + (h % 30) - 15 + 360) % 360 : h % 360;
  return hslToHex(hue, 35 + ((h >>> 9) % 30), 38 + ((h >>> 17) % 24));
}

export function biomeName(id) {
  const path = id.includes(':') ? id.split(':')[1] : id;
  const last = path.split('/').pop();
  return last.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function biomeSource(id) {
  const ns = id.includes(':') ? id.split(':')[0] : 'minecraft';
  return ns === 'minecraft' ? 'Vanilla' : ns.charAt(0).toUpperCase() + ns.slice(1);
}
