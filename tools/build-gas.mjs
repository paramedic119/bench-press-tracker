/**
 * Google Apps Script 用のパッケージを作る。
 *   node tools/build-gas.mjs  →  gas_dist/{index.html, Code.gs, appsscript.json}
 *
 * dist/index.html はすでに単一ファイルなので、そのまま HtmlService に載せられる。
 * Service Worker は GAS では動かないため、オフライン機能は無効になる。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'dist', 'index.html');
const OUT = join(ROOT, 'gas_dist');

if(!existsSync(SRC)) throw new Error('先に npm run build を実行してください');
await mkdir(OUT, {recursive: true});

let html = await readFile(SRC, 'utf8');
/* GAS では Service Worker もマニフェストも配信できないので、参照を落とす */
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
await writeFile(join(OUT, 'index.html'), html);

await writeFile(join(OUT, 'Code.gs'), `function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('BENCH 120')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
`);

await writeFile(join(OUT, 'appsscript.json'), JSON.stringify({
  timeZone: 'Asia/Tokyo',
  dependencies: {},
  webapp: {executeAs: 'USER_DEPLOYING', access: 'ANYONE'},
  exceptionLogging: 'STACKDRIVER',
}, null, 2) + '\n');

console.log(`gas_dist/ を生成しました（index.html ${(html.length/1024).toFixed(1)} KB）`);
