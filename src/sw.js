/* BENCH 120 — Service Worker
   ・アプリ本体はネットワーク優先＋キャッシュ退避（更新を取りこぼさない）
   ・その他の静的ファイルはキャッシュ優先
   このファイルは tools/build.mjs がキャッシュ名とプリキャッシュ一覧を差し込んで dist/sw.js を作る。
   一覧を手で書かないので、ファイルを足してオフラインが静かに壊れることがない。 */
/// <reference lib="webworker" />
/** self を ServiceWorkerGlobalScope として扱う（型チェックのため1度だけ確定させる） */
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const VERSION = '__CACHE_VERSION__';
const SHELL = `bench120-shell-${VERSION}`;
const PRECACHE = __PRECACHE__;

sw.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // 1つ失敗しても install 全体を落とさない
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, {cache: 'reload'})).catch(() => {})));
  })());
});

sw.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('bench120-') && k !== SHELL).map(k => caches.delete(k)));
    if(sw.registration.navigationPreload) await sw.registration.navigationPreload.enable();
    await sw.clients.claim();
  })());
});

sw.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') sw.skipWaiting();
});

const cacheFirst = async req => {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res && res.ok) cache.put(req, res.clone());
  return res;
};

sw.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== location.origin) return;

  // ページ遷移：ネットワーク優先、失敗したらキャッシュした index.html
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      try{
        const preload = await e.preloadResponse;
        const res = preload || await fetch(req);
        (await caches.open(SHELL)).put('./index.html', res.clone());
        return res;
      }catch(err){
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(cacheFirst(req).catch(() => caches.match(req).then(r => r || Response.error())));
});
