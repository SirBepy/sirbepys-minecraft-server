import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE_DIR = join(ROOT, 'site');
export const MAP_DATA_DIR = join(SITE_DIR, 'data', 'map');

// map.config.local.json is gitignored: the SFTP username stays out of this public repo.
const localPath = join(ROOT, 'map.config.local.json');
const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : {};
const env = process.env;

export const sftp = {
  host: env.MC_SFTP_HOST || local.host || 'eu-de-p59-a6-cg.kineticpanel.net',
  port: env.MC_SFTP_PORT || local.port || '2022',
  user: env.MC_SFTP_USER || local.user,
  key: env.MC_SFTP_KEY_FILE || local.keyFile || join(homedir(), '.ssh', 'id_ed25519'),
  // Paper 26.3 keeps every dimension inside one world folder (dimensions/minecraft/<dim>/).
  regionDir: env.MC_REMOTE_REGION_DIR || local.regionDir || 'world/dimensions/minecraft/overworld/region',
  levelDat: env.MC_REMOTE_LEVEL_DAT || local.levelDat || 'world/level.dat',
  wishesFile: env.MC_REMOTE_WISHES_FILE || local.wishesFile || 'plugins/DragonBalls/wishes.jsonl',
};

// Lives outside the repo: the raw region files are several GB.
export const CACHE_DIR = resolve(env.MAP_CACHE_DIR || local.cacheDir
  || join(env.LOCALAPPDATA || join(homedir(), '.cache'), 'sirbepys-minecraft-server', 'map-cache'));
export const RAW_DIR = join(CACHE_DIR, 'region');
export const GRID_DIR = join(CACHE_DIR, 'grids');
export const MANIFEST = join(CACHE_DIR, 'remote-manifest.json');
