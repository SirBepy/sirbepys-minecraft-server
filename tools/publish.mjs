// Publishes site/ to the gh-pages branch as a single orphan commit (force-pushed), so the
// nightly map data never piles up in git history. If site/data/map is missing (a code-only
// publish without SFTP access), the map data currently live on gh-pages is carried over.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, SITE_DIR, MAP_DATA_DIR } from './lib/config.mjs';

const BRANCH = 'gh-pages';

export const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

export function remoteUrl() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (token && repo) return `https://x-access-token:${token}@github.com/${repo}.git`;
  return git(ROOT, 'remote', 'get-url', 'origin');
}

export function publish({ log = console.log, message } = {}) {
  const url = remoteUrl();
  const out = mkdtempSync(join(tmpdir(), 'sirbepys-pages-'));
  try {
    git(out, 'init', '-q', '-b', BRANCH);
    git(out, 'remote', 'add', 'origin', url);
    cpSync(SITE_DIR, out, { recursive: true });

    if (!existsSync(join(MAP_DATA_DIR, 'meta.json'))) {
      log('no local map data, carrying over the live data from gh-pages');
      try {
        git(out, 'fetch', '-q', '--depth=1', 'origin', BRANCH);
        git(out, 'checkout', `origin/${BRANCH}`, '--', 'data/map');
      } catch {
        throw new Error('no map data locally or on gh-pages: run `npm run map:update` once with SFTP access');
      }
    }

    // .nojekyll: serve files as-is, no Jekyll pass.
    writeFileSync(join(out, '.nojekyll'), '');
    git(out, 'add', '-A');
    if (process.env.GITHUB_ACTIONS) {
      git(out, 'config', 'user.name', 'github-actions[bot]');
      git(out, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    }
    git(out, 'commit', '-q', '-m', message || `Publish site ${new Date().toISOString()}`);
    git(out, 'push', '-q', '--force', 'origin', BRANCH);
    log(`published to ${BRANCH}`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    publish();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
