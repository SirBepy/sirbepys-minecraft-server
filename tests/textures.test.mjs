import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const MC = join(SITE, 'assets', 'textures', 'mc');

function siteSources(dir = SITE) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return siteSources(path);
    return ['.css', '.html', '.js', '.mjs'].includes(extname(e.name)) ? [readFileSync(path, 'utf8')] : [];
  });
}

const sources = siteSources().join('\n');
const shipped = readdirSync(MC).filter((f) => f.endsWith('.png'));
const linked = new Set([...sources.matchAll(/textures\/mc\/([\w-]+\.png)/g)].map((m) => m[1]));

// Mojang's files are redistributed only as far as the site needs them.
test('every shipped Mojang texture is linked by the site', () => {
  assert.deepEqual(shipped.filter((f) => !linked.has(f)), []);
});

test('every linked Mojang texture is shipped', () => {
  assert.deepEqual([...linked].filter((f) => !shipped.includes(f)), []);
});
