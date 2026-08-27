/**
 * ブラウザ実機での動作確認（npm run e2e）
 *   前提: npx playwright install chromium
 *   静的サーバーは自前で立てるので、事前準備は不要。
 * ユニットテスト（npm test）とは別枠。CIでは走らせていない。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.css':'text/css'};

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, normalize(p === '/' ? '/index.html' : p).replace(/^(\.\.[/\\])+/, ''));
  try{
    const buf = await readFile(file);
    res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream'});
    res.end(buf);
  }catch{ res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
const ok = (name, cond, extra='') => {
  if(!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`);
};

const launch = {};
if(process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

const newCtx = async (seed, opts={}) => {
  const ctx = await browser.newContext({viewport:{width:390, height:844}, colorScheme:'dark', ...opts});
  if(seed) await ctx.addInitScript(`if(!localStorage.getItem('bench120.v1'))
    localStorage.setItem('bench120.v1', ${JSON.stringify(JSON.stringify(seed))});`);
  return ctx;
};
const SEED = {maxes:{MB:110, MN:105, ML:100}, onboarded:true, theme:'dark'};
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if(m.type() === 'error' && !/ERR_(CONNECTION|FAILED|NAME|INTERNET)/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
};

/* ---------- 1. 初回起動 ---------- */
{
  const ctx = await newCtx(null);
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE, {waitUntil:'domcontentloaded'}); await p.waitForTimeout(400);
  ok('初回は初期設定が出る', await p.locator('#onboard.show').count() === 1);
  for(let i = 0; i < 3; i++){ await p.locator('#obNext').click(); await p.waitForTimeout(150); }
  ok('3ステップで完了しワークアウトが出る', await p.locator('#onboard.show').count() === 0 && await p.locator('.card').count() > 0);
  await ctx.close();
}

/* ---------- 2. 記録・タイマー・取り消し ---------- */
{
  const ctx = await newCtx(SEED);
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE, {waitUntil:'domcontentloaded'}); await p.waitForTimeout(400);
  ok('既存ユーザーには初期設定を出さない', await p.locator('#onboard.show').count() === 0);

  const card = p.locator('.card').first();
  await card.locator('.setbtn').first().click(); await p.waitForTimeout(250);
  ok('セット✓が反映される', await card.locator('.setbtn').first().evaluate(e => e.classList.contains('on')));
  ok('インターバルタイマーが自動起動', await p.locator('#restbar.show').count() === 1,
     await p.locator('#tTime').textContent());
  const t1 = await p.locator('#tTime').textContent();
  await p.locator('#tPlus').click(); await p.waitForTimeout(120);
  ok('+30 で延長できる', (await p.locator('#tTime').textContent()) !== t1);
  await p.locator('#tStop').click(); await p.waitForTimeout(150);
  ok('✕ でタイマーを閉じられる', await p.locator('#restbar.show').count() === 0);

  await card.locator('.logtoggle').click(); await p.waitForTimeout(150);
  await p.locator('#lw-6-0').fill('95');
  await p.locator('[data-slog="6"][data-i="0"]').click(); await p.waitForTimeout(300);
  ok('記録するとベストe1RMが出る', /ベスト e1RM/.test(await card.locator('.logresult').textContent()));
  ok('次セット推奨が出る', await card.locator('.suggest').count() > 0,
     (await card.locator('.suggest').first().textContent()).trim());

  const before = await p.locator('#lw-6-1').inputValue();
  await p.locator('[data-step="lw-6-1"][data-dir="1"]').first().dispatchEvent('pointerdown');
  await p.waitForTimeout(900);
  await p.evaluate(() => window.dispatchEvent(new Event('pointerup')));
  ok('ステッパー長押しで連続変化', +(await p.locator('#lw-6-1').inputValue()) > +before + 2.5);

  await p.locator('[data-slog="6"][data-i="0"]').click(); await p.waitForTimeout(200);
  ok('取り消しに「元に戻す」が付く', await p.locator('#toast .tundo').count() === 1);
  await p.locator('#toast .tundo').click(); await p.waitForTimeout(300);
  ok('元に戻すで記録が復活する', await card.locator('.logresult').count() === 1);

  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(400);
  ok('リロード後も残る', await p.locator('.card').first().locator('.logresult').count() === 1);
  await ctx.close();
}

/* ---------- 3. 画面遷移・テーマ・ダイアログ ---------- */
{
  const ctx = await newCtx(SEED);
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE, {waitUntil:'domcontentloaded'}); await p.waitForTimeout(400);
  for(const [tab, sel] of [['progress','#chart polyline'], ['history','#heat .hc'], ['settings','#maxRows .stepper']]){
    await p.locator(`nav [data-page="${tab}"]`).click(); await p.waitForTimeout(300);
    ok(`${tab} が描画される`, await p.locator(sel).count() > 0);
  }

  /* レップマックス: 記録が無ければ空状態、記録すると3本の線が出る */
  await p.locator('nav [data-page="progress"]').click(); await p.waitForTimeout(300);
  ok('記録がなければレップマックスは空状態',
     !(await p.locator('#rmEmpty').isHidden()) && await p.locator('#rmChart').isHidden());
  await p.locator('nav [data-page="workout"]').click(); await p.waitForTimeout(300);
  await p.locator('.card').first().locator('.logtoggle').click(); await p.waitForTimeout(150);
  await p.locator('[data-slog="6"][data-i="0"]').click(); await p.waitForTimeout(250);
  await p.locator('nav [data-page="progress"]').click(); await p.waitForTimeout(350);
  ok('記録するとレップマックスが描画される',
     (await p.locator('#rmEmpty').isHidden()) && await p.locator('#rmRow .rmcell').count() === 3,
     (await p.locator('#rmRow').textContent()).replace(/\s+/g, ' ').trim());
  await p.locator('#themeOpts .opt', {hasText:'ライト'}).click(); await p.waitForTimeout(250);
  ok('ライトテーマに切り替わる', await p.evaluate(() => document.documentElement.dataset.theme) === 'light'
    && await p.locator('#metaTheme').getAttribute('content') === '#F4F5F3');
  await p.locator('#themeOpts .opt', {hasText:'ダーク'}).click(); await p.waitForTimeout(200);

  /* どの丸め刻みを選んでも、表示される重量は必ずバーに載る */
  for(const step of ['5 kg', '2.5 kg', '1 kg', '0.5 kg']){
    await p.locator('#roundOpts .opt').filter({hasText:new RegExp('^'+step.replace('.','\\.')+'$')}).click();
    await p.waitForTimeout(150);
    await p.locator('nav [data-page="workout"]').click(); await p.waitForTimeout(250);
    const labels = await p.locator('.card .plates + .meta').allTextContents();
    ok(`${step} 刻みでもプレートが組める`, !labels.some(l => /載せられません/.test(l)), labels[0]?.trim());
    await p.locator('nav [data-page="settings"]').click(); await p.waitForTimeout(200);
  }
  await p.locator('#roundOpts .opt').filter({hasText:/^2\.5 kg$/}).click(); await p.waitForTimeout(150);

  await p.locator('nav [data-page="settings"]').click(); await p.waitForTimeout(250);
  await p.locator('#btnReset').click(); await p.waitForTimeout(300);
  ok('確認ダイアログが出る', await p.locator('#scrim.show .sheet').count() === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok('Escで閉じる', await p.locator('#scrim.show').count() === 0);
  await ctx.close();
}

/* ---------- 4. PWA / オフライン ---------- */
{
  const ctx = await newCtx(SEED);
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE, {waitUntil:'load'});
  await p.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {timeout:15000}).catch(() => {});
  ok('Service Worker が有効', await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active));
  ok('アプリシェルをプリキャッシュ', (await p.evaluate(() => caches.keys())).some(k => k.startsWith('bench120-shell-')));
  for(const u of ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/maskable-512.png', '/sw.js']){
    const r = await p.request.get(BASE + u);
    ok(`${u} が配信される`, r.ok(), String(r.status()));
  }
  await ctx.setOffline(true);
  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  ok('オフラインでも起動する', await p.locator('.card').count() > 0);
  await p.locator('.card').first().locator('.setbtn').first().click(); await p.waitForTimeout(250);
  ok('オフラインでも記録できる', await p.locator('.card').first().locator('.setbtn').first().evaluate(e => e.classList.contains('on')));
  await ctx.setOffline(false);
  await ctx.close();
}

await browser.close();
server.close();
console.log(errors.length ? `\n未処理のエラー:\n  ${errors.join('\n  ')}` : '\nコンソールエラーなし');
if(errors.length) failed += errors.length;
console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
