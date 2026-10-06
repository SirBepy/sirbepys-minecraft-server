import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotMap, BRANCH } from '../tools/snapshot-map.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

test('snapshotMap commits only changed regions and skips a refresh with no change', () => {
  const dir = mkdtempSync(join(tmpdir(), 'maph-'));
  try {
    const remote = join(dir, 'remote.git');
    const grids = join(dir, 'grids');
    const metaFile = join(dir, 'meta.json');
    git(dir, 'init', '-q', '--bare', remote);
    mkdirSync(grids);
    const writeMeta = (generatedAt, regions) => writeFileSync(metaFile, JSON.stringify({ generatedAt, spawn: { x: 1, z: 2 }, regions }));
    writeFileSync(join(grids, 'r.0.0.terrain.gz'), 'a');
    writeFileSync(join(grids, 'r.-1.0.terrain.gz'), 'b');
    // A cached region the map leaves out (no chunks) stays out of the snapshot too.
    writeFileSync(join(grids, 'r.5.5.terrain.gz'), 'empty');
    const opts = { remote, gridDir: grids, metaFile, log: () => {} };

    writeMeta('2026-10-06T03:17:00.000Z', [[0, 0], [-1, 0]]);
    assert.deepEqual(snapshotMap(opts), { committed: true, changed: 2 });

    writeMeta('2026-10-06T11:17:00.000Z', [[0, 0], [-1, 0]]);
    assert.deepEqual(snapshotMap(opts), { committed: false, changed: 0 });

    writeFileSync(join(grids, 'r.-1.0.terrain.gz'), 'b2');
    writeMeta('2026-10-06T19:17:00.000Z', [[0, 0], [-1, 0]]);
    assert.deepEqual(snapshotMap(opts), { committed: true, changed: 1 });

    assert.equal(git(remote, 'rev-list', '--count', BRANCH), '2');
    assert.equal(git(remote, 'diff', '--name-only', `${BRANCH}~1`, BRANCH, '--', 'regions'), 'regions/r.-1.0.terrain.gz');
    assert.equal(git(remote, 'ls-tree', '--name-only', `${BRANCH}:regions`), 'r.-1.0.terrain.gz\nr.0.0.terrain.gz');
    const snap = JSON.parse(git(remote, 'show', `${BRANCH}:snapshot.json`));
    assert.equal(snap.takenAt, '2026-10-06T19:17:00.000Z');
    // %at, not %aI: git versions disagree on printing UTC as Z or +00:00.
    assert.equal(Number(git(remote, 'log', '-1', '--format=%at', BRANCH)), Date.parse('2026-10-06T19:17:00Z') / 1000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
