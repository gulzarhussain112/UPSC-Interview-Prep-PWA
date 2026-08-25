const CACHE = 'upsc-prep-v13.2.4';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './firebase-config.js',
  './firebase-client.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/screenshots/desktop-wide.png',
  './assets/screenshots/mobile.png'
];

/* =========================================================
   FIREBASE CLOUD MESSAGING
   ========================================================= */

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js'
);

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: "AIzaSyAiyANqQh7Lqs80oOuavU93nvEY2diaGag",
  authDomain: "interview-prep-upsc.firebaseapp.com",
  projectId: "interview-prep-upsc",
  storageBucket: "interview-prep-upsc.firebasestorage.app",
  messagingSenderId: "632920971695",
  appId: "1:632920971695:web:1d3c90a1484fbe1c95b75a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {

  const title =
    payload.data?.title ||
    payload.notification?.title ||
    'UPSC Study Reminder';

  const body =
    payload.data?.body ||
    payload.notification?.body ||
    'Your scheduled study session needs attention.';

  self.registration.showNotification(title, {

    body,

    icon: './assets/icons/icon-192.png',

    badge: './assets/icons/icon-192.png',

    tag:
      payload.data?.sessionId ||
      'upsc-study',

    renotify: true,

    data: {
      url:
        payload.data?.url ||
        './index.html'
    }

  });

});


/* =========================================================
   PWA CACHE
   ========================================================= */

self.addEventListener('install', event => {

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

  /*
   * Only handle GET requests.
   * This prevents the cache handler from interfering
   * with POST/other Firebase/network requests.
   */

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(

    caches.match(event.request)

      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(event.request);

      })

  );

});


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener('notificationclick', event => {

  event.notification.close();

  event.waitUntil(

    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })

      .then(list => {

        const target =
          new URL(
            event.notification.data?.url ||
            './index.html',
            self.location.origin
          ).href;


        /* Try to focus the exact app window */

        for (const client of list) {

          if (
            client.url === target &&
            'focus' in client
          ) {

            return client.focus();

          }

        }


        /* Otherwise focus any existing app window */

        for (const client of list) {

          if ('focus' in client) {
            return client.focus();
          }

        }


        /* Otherwise open the app */

        return clients.openWindow(target);

      })

  );

});
