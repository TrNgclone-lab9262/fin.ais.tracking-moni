/**
 * @file sw.js
 * @description Service Worker cho HOME MONI v1.1.0-pwa
 * Hỗ trợ bộ nhớ đệm ngoại tuyến (Offline-First) và chiến lược Stale-While-Revalidate.
 */

const CACHE_NAME = 'homemoni-pwa-v1.1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

// 1. Cài đặt Service Worker & Pre-cache tài nguyên cốt lõi
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Kích hoạt & Xóa bộ nhớ đệm các phiên bản cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Xử lý Fetch Request: Stale-While-Revalidate cho tài nguyên tĩnh
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bỏ qua các yêu cầu không phải GET hoặc chrome-extension
  if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Bỏ qua các request đến Google AI API hoặc Supabase Cloud (để luôn realtime)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Khi ngoại tuyến và không có kết nối mạng
          return cachedResponse;
        });

      // Trả về bản cache ngay lập tức (0ms) nếu có, ngầm tải bản mới từ mạng
      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Lắng nghe thông điệp bỏ qua chờ đợi
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
