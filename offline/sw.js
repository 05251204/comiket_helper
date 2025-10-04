// キャッシュの名前と、キャッシュするファイルのリストを定義
const CACHE_NAME = 'comiket-tsp-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/data.js',
  '/fonts/NotoSansJP-Regular.ttf'
];

// 1. インストール処理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// 2. ファイル取得時の処理 (キャッシュ優先)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュ内に一致するファイルがあれば、それを返す
        if (response) {
          return response;
        }
        // なければ、ネットワークから取得しにいく
        return fetch(event.request);
      })
  );
});

// 3. 古いキャッシュの削除処理
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
