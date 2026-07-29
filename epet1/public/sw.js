// PWA Service Worker for MoMo 庭院
// 作用: 启用 standalone 模式 (iOS Safari 16.4+ 支持 PWA standalone 模式)
// 注: 缓存策略保持最简单, 因为本应用主要 API 数据由后端实时返回
// Stage A 改动:
//   - SHELL_ASSETS 改用 /epet/ 前缀 (vite base 决定)
//   - fetch handler 跳过 /admin/ (防御: PWA scope=/ 不要碰内部)
const CACHE_NAME = 'epet-shell-v3';
const SHELL_ASSETS = [
  '/epet/favicon.svg',
  '/epet/icons.svg',
  '/epet/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API 请求走网络
  if (url.pathname.startsWith('/api/')) return;
  // Admin 路径不缓存, 让 nginx 直通 (防御内部页面污染 PWA 缓存)
  if (url.pathname.startsWith('/admin/')) return;
  // 只缓存同源 GET
  if (url.origin !== self.location.origin) return;
  // Network-first 策略
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
