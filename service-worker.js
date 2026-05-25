/* ==================================================
   service-worker.js — オフラインキャッシュ
   ローカル/ホスティング配置時にPWAとして動作させる。
   GAS環境ではアプリ側でSW登録をスキップする。
   ================================================== */

// バージョンを上げるとアクティベート時に旧キャッシュが purge され、最新コードが配信される
const CACHE_NAME = 'bp-tracker-v3';

// オフラインで動かすリソース。スクリプトを追加した際は必ずここにも反映する
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/style.css',
    './js/data.js',
    './js/app.js',
    './js/menu.js',
    './js/history.js',
    './js/progress.js',
    './js/chart.js',
    './js/achievements.js',
    './js/program-editor.js',
    './js/program-generator.js',
    './Blue_Angels_Insignia.svg.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
            .catch(err => console.warn('SW precache failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // GET のみキャッシュ
    if (req.method !== 'GET') return;
    // 同一オリジンのみキャッシュ（Chart.js CDN は network passthrough）
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                // 成功したレスポンスはキャッシュに追加（HTML/JS/CSS 変更追従用）
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone));
                }
                return res;
            }).catch(() => cached);
        })
    );
});
