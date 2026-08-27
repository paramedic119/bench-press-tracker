/* BENCH 120 — Service Worker
   ・アプリ本体はネットワーク優先＋キャッシュ退避（更新を取りこぼさない）
   ・アイコン等の静的ファイルはキャッシュ優先
   ・Google Fonts は stale-while-revalidate（初回以降はオフラインでも同じ見た目）
*/
const VERSION = 'v2.0.0';
const SHELL = `bench120-shell-${VERSION}`;
const FONTS = 'bench120-fonts';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // 1つ失敗しても install 全体を落とさない
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, {cache:'reload'})).catch(() => {})));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('bench120-shell-') && k !== SHELL).map(k => caches.delete(k)));
    if(self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const cacheFirst = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res && res.ok) cache.put(req, res.clone());
  return res;
};

const staleWhileRevalidate = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(FONT_HOSTS.includes(url.hostname)){
    e.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }
  if(url.origin !== location.origin) return;

  // ページ遷移：ネットワーク優先、失敗したらキャッシュした index.html
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      try{
        const preload = await e.preloadResponse;
        const res = preload || await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', res.clone());
        return res;
      }catch(err){
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(cacheFirst(req, SHELL).catch(() => caches.match(req).then(r => r || Response.error())));
});
