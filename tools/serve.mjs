// Tiny static server for previewing site/ locally (no dependencies). PORT env or 8080.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { SITE_DIR } from './lib/config.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip', '.txt': 'text/plain',
  '.mrpack': 'application/x-modrinth-modpack+zip',
};

const port = Number(process.env.PORT || 8080);
createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(SITE_DIR, path));
  if (!file.startsWith(SITE_DIR)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving ${SITE_DIR} on http://127.0.0.1:${port}/`));
