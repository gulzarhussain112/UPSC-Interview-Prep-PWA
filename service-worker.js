/* =========================================================
   UPSC INTERVIEW PREP — PWA + FIREBASE MESSAGING SERVICE WORKER
   ========================================================= */

const CACHE = 'upsc-prep-v13.2.4';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './firebase-config.js',
  './firebase-client.js',
  './firebase-messaging-sw.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/screenshots/desktop-wide.png',
  './assets/screenshots/mobile.png'
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener('install', event => {

  event.waitUntil(

    caches
      .open(CACHE)

      .then(cache => cache.addAll(ASSETS))

      .then(() => self.skipWaiting())

  );

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener('activate', event => {

  event.waitUntil(

    caches
      .keys()

      .then(keys =>

        Promise.all(

          keys

            .filter(key => key !== CACHE)

            .map(key => caches.delete(key))

        )

      )

      .then(() => self.clients.claim())

  );

});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener('fetch', event => {

  /*
     Only handle GET requests.
     Firebase / browser internal requests should not
     accidentally be intercepted by our cache logic.
  */

  if (event.request.method !== 'GET') {
    return;
  }


  event.respondWith(

    caches
      .match(event.request)

      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(event.request);

      })

  );

});
