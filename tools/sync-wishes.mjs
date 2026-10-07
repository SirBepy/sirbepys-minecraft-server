// Pulls the plugin's wishes.jsonl (read-only, single `-get`) and writes the public "wishes
// granted" list to site/data/wishes.json. A missing remote file (no DragonBalls wishes yet, or
// no SFTP access) still writes a valid file with an empty list.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sftp, CACHE_DIR, SITE_DIR } from './lib/config.mjs';
import { publicWishes } from './lib/wishes.mjs';

export const WISHES_OUTPUT = join(SITE_DIR, 'data', 'wishes.json');

function sftpArgs(batchFile) {
  if (!sftp.user) throw new Error('No SFTP user: set MC_SFTP_USER or "user" in map.config.local.json');
  return ['-b', batchFile, '-P', String(sftp.port), '-i', sftp.key,
    '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', `${sftp.user}@${sftp.host}`];
}

const quote = (p) => `"${p.replaceAll('\\', '/')}"`;

export async function syncWishes({ log = console.log } = {}) {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(dirname(WISHES_OUTPUT), { recursive: true });

  const localPath = join(CACHE_DIR, 'wishes.jsonl');
  rmSync(localPath, { force: true });

  let found = false;
  if (!sftp.user) {
    // No SFTP secrets configured (e.g. a CI run without MC_SFTP_USER/KEY): publish still needs a
    // valid file, so fall through to the empty-list case instead of throwing.
    log('no SFTP user configured, writing an empty wishes list');
  } else {
    // Leading '-' keeps a missing remote file from aborting the batch; whether it landed is
    // checked below by existence, not by the sftp exit code.
    const batchFile = join(CACHE_DIR, 'wishes.batch');
    writeFileSync(batchFile, `-get ${quote(sftp.wishesFile)} ${quote(localPath)}\n`);
    const result = spawnSync('sftp', sftpArgs(batchFile), { encoding: 'utf8' });
    if (result.error) throw new Error(`sftp failed to start: ${result.error.message}`);
    found = existsSync(localPath);
    if (!found) log(`${sftp.wishesFile} not found on remote, writing an empty wishes list`);
  }

  const jsonlText = found ? readFileSync(localPath, 'utf8') : '';

  const data = publicWishes(jsonlText, new Date().toISOString());
  writeFileSync(WISHES_OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
  log(`${data.wishes.length} public wish(es) written to ${WISHES_OUTPUT}`);
  return data;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncWishes().catch((err) => { console.error(err.message); process.exit(1); });
}
