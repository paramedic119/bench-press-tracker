/**
 * ビルド。src/ のモジュールを1枚の dist/index.html にまとめる。
 *
 * 分割して書きながら、配布物は単一ファイルのまま保つのが狙い:
 *   ・file:// で開いても動く（ESモジュールは file:// では読めないため）
 *   ・GitHub Pages / Firebase / GAS のどれも「1ファイル置くだけ」で済む
 *   ・Service Worker のプリキャッシュ一覧とキャッシュ名を実ファイルから生成する
 */
import { build as esbuild, context } from 'esbuild';
import { bundle as bundleCss } from 'lightningcss';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const p = (...s) => join(ROOT, ...s);
const WATCH = process.argv.includes('--watch');

const pkg = JSON.parse(await readFile(p('package.json'), 'utf8'));
/** ブラウザの下限。ここを下げると lightningcss が古い書き方へ展開する。 */
const TARGETS = {safari: 16 << 16, chrome: 108 << 16, firefox: 110 << 16, edge: 108 << 16};

async function buildCss(){
  const {code} = bundleCss({filename: p('src/styles/app.css'), minify: true, targets: TARGETS});
  const woff2 = await readFile(p('src/assets/fonts/bebas-neue-latin.woff2'));
  const dataUri = `data:font/woff2;base64,${woff2.toString('base64')}`;
  const css = code.toString();
  if(!css.includes('__BEBAS_WOFF2__')) throw new Error('fonts.css の差し込み口が見つかりません');
  return css.replaceAll('__BEBAS_WOFF2__', () => dataUri);
}

async function buildJs(){
  const r = await esbuild({
    entryPoints: [p('src/ui/app.js')],
    bundle: true, write: false, format: 'iife', target: 'es2022',
    minify: true, legalComments: 'none',
    define: {__APP_VERSION__: JSON.stringify(pkg.version)},
  });
  return r.outputFiles[0].text;
}

async function buildHtml(css, js){
  const tpl = await readFile(p('src/index.html'), 'utf8');
  /* 差し込み口はちょうど1つずつ。2つあると片方が置換されず、
     バンドルが head で走って DOM が見つからない、という壊れ方をする。 */
  for(const mark of ['<!--STYLES-->', '<!--SCRIPT-->']){
    const n = tpl.split(mark).length - 1;
    if(n !== 1) throw new Error(`src/index.html の ${mark} が ${n} 個あります（1個であること）`);
  }
  /* 置換文字列そのままだと $& や $` が特殊解釈され、minify後のコードが壊れる。
     必ず関数を渡すこと（実際に一度ここで壊した）。 */
  return tpl
    .replace('<!DOCTYPE html>', () => '<!DOCTYPE html>\n<!-- 生成物です。編集は src/ 側で行い、npm run build で作り直してください。 -->')
    .replace('<!--STYLES-->', () => `<style>${css}</style>`)
    .replace('<!--SCRIPT-->', () => `<script>${js}</script>`);
}

/** dist に置いた実ファイルからプリキャッシュ一覧を作る（書き忘れでオフラインが壊れないように） */
async function listAssets(){
  const icons = await readdir(join(DIST, 'icons'));
  return ['./', './index.html', './manifest.webmanifest', ...icons.map(f => `./icons/${f}`)];
}

async function buildSw(assets){
  const parts = await Promise.all(assets.filter(a => a !== './')
    .map(a => readFile(join(DIST, a.slice(2)))));
  const hash = createHash('sha256');
  for(const b of parts) hash.update(b);
  const version = `${pkg.version}-${hash.digest('hex').slice(0, 8)}`;
  const tpl = await readFile(p('src/sw.js'), 'utf8');
  return {
    code: tpl.replace('__CACHE_VERSION__', () => version)
             .replace('__PRECACHE__', () => JSON.stringify(assets, null, 2)),
    version,
  };
}

async function runOnce(){
  const t0 = Date.now();
  await rm(DIST, {recursive: true, force: true});
  await mkdir(join(DIST, 'icons'), {recursive: true});

  /* アイコンは決定的に生成されるので、ビルドのたびに作り直して差分を出さない */
  await import(`./make-icons.mjs?${Date.now()}`);

  const [css, js] = await Promise.all([buildCss(), buildJs()]);
  await writeFile(join(DIST, 'index.html'), await buildHtml(css, js));
  await copyFile(p('src/manifest.webmanifest'), join(DIST, 'manifest.webmanifest'));

  const assets = await listAssets();
  const {code, version} = await buildSw(assets);
  await writeFile(join(DIST, 'sw.js'), code);

  const size = (await readFile(join(DIST, 'index.html'))).length;
  console.log(`dist/index.html  ${(size/1024).toFixed(1)} KB  (css ${(css.length/1024).toFixed(1)} / js ${(js.length/1024).toFixed(1)})`);
  console.log(`dist/sw.js       ${assets.length} ファイルをプリキャッシュ / cache=${version}`);
  console.log(`${Date.now()-t0} ms`);
}

await runOnce();

if(WATCH){
  const {watch} = await import('node:fs');
  let timer = null;
  for(const dir of ['src']){
    watch(p(dir), {recursive: true}, () => {
      clearTimeout(timer);
      timer = setTimeout(() => runOnce().catch(e => console.error(e.message)), 80);
    });
  }
  console.log('watching src/ …');
}
