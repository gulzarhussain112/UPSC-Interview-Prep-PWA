/* =========================================================
   UPSC INTERVIEW PREP — SERVICE WORKER
   PWA CACHE + FCM WEB PUSH
   ========================================================= */

const CACHE = 'upsc-prep-v13.2.6';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './firebase-config.js',
  './firebase-client.js',
  './service-worker.js',
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

  console.log('[StudyPush SW] Installing');

  event.waitUntil(

    caches.open(CACHE)

      .then(cache => cache.addAll(ASSETS))

      .then(() => self.skipWaiting())

  );

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener('activate', event => {

  console.log('[StudyPush SW] Activating');

  event.waitUntil(

    caches.keys()

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

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(

    caches.match(event.request)

      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(event.request)

          .then(response => {

            if (
              !response ||
              response.status !== 200 ||
              response.type !== 'basic'
            ) {
              return response;
            }

            const copy = response.clone();

            caches.open(CACHE)
              .then(cache => {
                cache.put(event.request, copy);
              });

            return response;

          });

      })

  );

});


/* =========================================================
   FCM / WEB PUSH
   =========================================================

   We deliberately DO NOT use importScripts() here.

   Firebase's CDN script was causing the Service Worker
   evaluation to fail before it could register.

   Instead, receive the Web Push event directly.
   ========================================================= */

self.addEventListener('push', event => {

  console.log('[StudyPush SW] Push received');

  let data = {};

  try {

    if (event.data) {
      data = event.data.json();
    }

  } catch (error) {

    console.warn(
      '[StudyPush SW] Could not parse push data',
      error
    );

    try {

      data = {
        body: event.data
          ? event.data.text()
          : ''
      };

    } catch (_) {}

  }


  const title =
    data?.data?.title ||
    data?.notification?.title ||
    data?.title ||
    'UPSC Study Reminder';


  const body =
    data?.data?.body ||
    data?.notification?.body ||
    data?.body ||
    'Your scheduled study session needs attention.';


  const sessionId =
    data?.data?.sessionId ||
    data?.sessionId ||
    'upsc-study';


  const url =
    data?.data?.url ||
    data?.url ||
    './index.html';


  event.waitUntil(

    self.registration.showNotification(

      title,

      {

        body: body,

        icon: './assets/icons/icon-192.png',

        badge: './assets/icons/icon-192.png',

        tag: sessionId,

        renotify: true,

        data: {
          url: url
        }

      }

    )

  );

});


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();


    event.waitUntil(

      clients.matchAll({

        type: 'window',

        includeUncontrolled: true

      })

      .then(list => {

        const target = new URL(

          event.notification.data?.url ||
          './index.html',

          self.location.origin

        ).href;


        for (const client of list) {

          if (
            client.url === target &&
            'focus' in client
          ) {

            return client.focus();

          }

        }


        for (const client of list) {

          if ('focus' in client) {

            return client.focus();

          }

        }


        return clients.openWindow(target);

      })

    );

  }
);
