/**
 * @file sw.js
 * @description Service Worker cho HOME MONI v1.6.0
 * - Quản lý vòng đời cập nhật an toàn: giữ bản mới ở trạng thái `waiting` và chỉ kích hoạt khi người dùng bấm "Cập nhật ngay" (`SKIP_WAITING`).
 * - Chỉ dọn bộ nhớ đệm vỏ ứng dụng (CacheStorage), tuyệt đối không đụng chạm tới `localStorage` (`HOME_MONI_DATA_V4`).
 * - Bỏ qua cache cho `/api/*`, `/version.json`, `/sw.js` và dùng Network-First cho HTML điều hướng để tránh lỗi màn hình trắng sau khi nâng cấp.
 */

const SW_VERSION = '1.6.0';
const CACHE_PREFIX = 'homemoni-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v${SW_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
];

// 1. Cài đặt Service Worker & Pre-cache tài nguyên cốt lõi
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Chỉ tự kích hoạt ngay ở lần cài đặt đầu tiên khi chưa có Service Worker nào đang kiểm soát.
  // Khi nâng cấp từ bản cũ, giữ nguyên trạng thái `waiting` để hiển thị thông báo 1-chạm cho người dùng.
  if (!self.registration.active) {
    self.skipWaiting();
  }
});

// 2. Kích hoạt & Dọn bộ nhớ đệm vỏ ứng dụng của các phiên bản cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Chiến lược Fetch thông minh:
// - Bỏ qua cache cho API, version.json, sw.js và dịch vụ bên ngoài
// - Network-First (dự phòng cache) cho trang điều hướng HTML
// - Stale-While-Revalidate cho các tài nguyên tĩnh (JS/CSS/Icon)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Luôn đi thẳng mạng cho Google AI, Supabase, API nội bộ, tệp kiểm tra phiên bản và tệp SW
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/version.json' ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Điều hướng HTML: Network-First để luôn lấy đúng index.html gắn hash bundle mới nhất
  const isNavigationRequest =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html';

  if (isNavigationRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(event.request)) ||
            (await cache.match('/index.html')) ||
            (await cache.match('/'))
          );
        })
    );
    return;
  }

  // Tài nguyên tĩnh khác: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Lắng nghe lệnh điều khiển từ giao diện ứng dụng
self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'GET_SW_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      version: SW_VERSION,
      cacheName: CACHE_NAME,
    });
    return;
  }

  if (event.data.type === 'PURGE_APP_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key))
        )
      )
    );
  }
});
