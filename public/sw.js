// 클린앤파트너즈 Service Worker
const CACHE_NAME = 'cleannpartners-v30';
const IMAGE_CACHE = 'cleannpartners-images-v1';
// main.js, style.css 는 network-first 로 처리하므로 PRECACHE 에서 제외
const PRECACHE = ['/', '/icon.svg', '/manifest.json'];

// main.js, style.css 는 항상 네트워크에서 최신 버전을 가져와야 하는 파일
const NETWORK_FIRST = ['/main.js', '/style.css'];

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

  const path = new URL(e.request.url).pathname;

  // main.js, style.css: network-first (항상 최신 버전 유지)
  if (NETWORK_FIRST.includes(path)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

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
