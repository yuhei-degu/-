// 依存なしの静的サーバー。node serve.mjs → http://localhost:5173/viewer/?topic=meteor
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT) || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8' };

// 公開するのは観戦画面と作品だけ（.env などは配信しない）
const PUBLIC_DIRS = ['viewer', 'works'];

createServer(async (req, res) => {
  let path;
  try {
    path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  } catch {
    return res.writeHead(400).end('bad request');
  }
  if (path === '' || path === '.') path = 'viewer/';
  if (!PUBLIC_DIRS.includes(path.split(/[/\\]/)[0])) return res.writeHead(403).end('forbidden');
  let file = join(process.cwd(), path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}/viewer/?topic=meteor`));
