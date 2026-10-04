// Pulls the overworld region files that changed since the last sync into the local cache.
// READ-ONLY against the live server: the only SFTP commands this ever sends are `ls` and `get`.
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sftp, CACHE_DIR, RAW_DIR, GRID_DIR, MANIFEST } from './lib/config.mjs';
import { gridKey } from './lib/biomes.mjs';

const PARALLEL = Number(process.env.MAP_SYNC_PARALLEL || 4);
const ALLOWED = /^-?(ls|get) /;

function sftpArgs(batchFile) {
  if (!sftp.user) throw new Error('No SFTP user: set MC_SFTP_USER or "user" in map.config.local.json');
  return ['-b', batchFile, '-P', String(sftp.port), '-i', sftp.key,
    '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', `${sftp.user}@${sftp.host}`];
}

function writeBatch(name, commands) {
  for (const c of commands) if (!ALLOWED.test(c)) throw new Error(`refusing non read-only sftp command: ${c}`);
  const file = join(CACHE_DIR, name);
  writeFileSync(file, commands.join('\n') + '\n');
  return file;
}

const quote = (p) => `"${p.replaceAll('\\', '/')}"`;

// `ls -l` lines: perms links uid gid size month day time-or-year name
function parseListing(text) {
  const files = {};
  for (const line of text.split('\n')) {
    const m = /^[-l]\S+\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3}\s+\d+\s+[\d:]+)\s+(?:.*\/)?((?:r\.-?\d+\.-?\d+\.mca)|(?:c\.-?\d+\.-?\d+\.mcc))\s*$/.exec(line.trim());
    if (m) files[m[3]] = { size: Number(m[1]), mtime: m[2].replace(/\s+/g, ' ') };
  }
  return files;
}

function gridIsCurrent(name, remoteEntry) {
  const file = join(GRID_DIR, name.replace(/\.mca$/, '.json'));
  if (!existsSync(file)) return false;
  try { return JSON.parse(readFileSync(file, 'utf8')).key === gridKey(remoteEntry); } catch { return false; }
}

function runParallel(batches) {
  return Promise.all(batches.map((file) => new Promise((resolve, reject) => {
    const child = spawn('sftp', sftpArgs(file), { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`sftp exited ${code}: ${err}`)));
  })));
}

export async function syncRegions({ log = console.log } = {}) {
  mkdirSync(RAW_DIR, { recursive: true });
  const listing = spawnSync('sftp', sftpArgs(writeBatch('list.batch', [`ls -l ${sftp.regionDir}`])), { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error(`sftp listing failed: ${listing.stderr}`);
  const remote = parseListing(listing.stdout);
  const names = Object.keys(remote);
  if (names.length === 0) throw new Error(`no region files found in ${sftp.regionDir}`);

  const known = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const changed = names.filter((n) => {
    const k = known[n];
    if (!k || k.size !== remote[n].size || k.mtime !== remote[n].mtime) return true;
    // Unchanged remotely: only re-fetch if the raw file is gone AND no up-to-date grid exists
    // (CI keeps grids but not raw files).
    return !existsSync(join(RAW_DIR, n)) && n.endsWith('.mca') && !gridIsCurrent(n, k);
  });
  log(`${names.length} remote region files, ${changed.length} new or changed`);

  if (changed.length > 0) {
    // Largest first so the parallel batches finish at roughly the same time.
    changed.sort((a, b) => remote[b].size - remote[a].size);
    const buckets = Array.from({ length: Math.min(PARALLEL, changed.length) }, () => []);
    changed.forEach((n, i) => buckets[i % buckets.length].push(n));
    const batches = buckets.map((bucket, i) => writeBatch(`get-${i}.batch`,
      bucket.map((n) => `-get ${quote(`${sftp.regionDir}/${n}`)} ${quote(join(RAW_DIR, `${n}.part`))}`)));
    const started = Date.now();
    await runParallel(batches);
    let bytes = 0;
    for (const n of changed) {
      const part = join(RAW_DIR, `${n}.part`);
      if (!existsSync(part)) { log(`  skipped ${n} (vanished during sync)`); continue; }
      bytes += statSync(part).size;
      renameSync(part, join(RAW_DIR, n));
      // Recorded from the listing, not the download: a file the server rewrote mid-transfer has a
      // newer mtime by the next sync, so it gets fetched again instead of staying torn.
      known[n] = remote[n];
    }
    log(`downloaded ${(bytes / 1e6).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }

  for (const n of Object.keys(known)) {
    if (!remote[n]) { delete known[n]; rmSync(join(RAW_DIR, n), { force: true }); }
  }
  for (const f of readdirSync(RAW_DIR)) if (f.endsWith('.part')) rmSync(join(RAW_DIR, f), { force: true });
  writeFileSync(MANIFEST, JSON.stringify(known, null, 1));

  const levelBatch = writeBatch('level.batch', [`-get ${quote(sftp.levelDat)} ${quote(join(CACHE_DIR, 'level.dat'))}`]);
  await runParallel([levelBatch]);

  return { total: names.length, changed };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncRegions().catch((err) => { console.error(err.message); process.exit(1); });
}
