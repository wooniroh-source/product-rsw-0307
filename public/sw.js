// 클린앤파트너즈 Service Worker
const CACHE_NAME = 'cleannpartners-v3';
const IMAGE_CACHE = 'cleannpartners-images-v1';
const PRECACHE = ['/', '/style.css', '/main.js', '/icon.svg', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== IMAGE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 외부 이미지 여부 판별
function isExternalImage(url) {
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url) &&
    !url.startsWith(self.location.origin);
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  // 외부 이미지: stale-while-revalidate (캐시 우선, 백그라운드 갱신)
  if (isExternalImage(e.request.url)) {
    e.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 나머지: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
