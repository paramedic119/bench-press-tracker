/**
 * dist/ を配信する開発用の静的サーバー。Service Worker の確認に localhost が要るため。
 *   npm run serve  →  http://127.0.0.1:8080
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2',
};

export function createStaticServer(root = ROOT){
  return createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
    try{
      const buf = await readFile(join(root, rel));
      res.writeHead(200, {
        'Content-Type': MIME[extname(rel)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
    }catch{
      res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('not found');
    }
  });
}

if(import.meta.url === `file://${process.argv[1]}`){
  const port = Number(process.env.PORT ?? 8080);
  createStaticServer().listen(port, () => console.log(`http://127.0.0.1:${port}  (dist/)`));
}
