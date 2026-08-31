/* =========================================================
   UPSC INTERVIEW PREP
   PWA CACHE + FIREBASE CLOUD MESSAGING
   ========================================================= */

/* Firebase libraries hosted locally */
importScripts('./firebase-app-compat.js');
importScripts('./firebase-messaging-compat.js');


/* =========================================================
   FIREBASE INITIALIZATION
   ========================================================= */

firebase.initializeApp({
  apiKey: "AIzaSyAiyANqQh7Lqs80oOuavU93nvEY2diaGag",
  authDomain: "interview-prep-upsc.firebaseapp.com",
  projectId: "interview-prep-upsc",
  storageBucket: "interview-prep-upsc.firebasestorage.app",
  messagingSenderId: "632920971695",
  appId: "1:632920971695:web:1d3c90a1484fbe1c95b75a"
});

const messaging = firebase.messaging();


/* =========================================================
   PWA CACHE
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
  './firebase-app-compat.js',
  './firebase-messaging-compat.js',
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

  console.log('[SW] Installing:', CACHE);

  event.waitUntil(

    caches.open(CACHE)

      .then(cache => {

        return cache.addAll(ASSETS);

      })

      .then(() => {

        console.log('[SW] All assets cached');

        return self.skipWaiting();

      })

  );

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener('activate', event => {

  console.log('[SW] Activating:', CACHE);

  event.waitUntil(

    caches.keys()

      .then(keys => {

        return Promise.all(

          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))

        );

      })

      .then(() => {

        console.log('[SW] Old caches removed');

        return self.clients.claim();

      })

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

        return fetch(event.request);

      })

  );

});


/* =========================================================
   FIREBASE BACKGROUND MESSAGE
   ========================================================= */

messaging.onBackgroundMessage(payload => {

  console.log('[SW] Background FCM message:', payload);


  const title =
    payload.data?.title ||
    payload.notification?.title ||
    'UPSC Study Reminder';


  const body =
    payload.data?.body ||
    payload.notification?.body ||
    'Your scheduled study session needs attention.';


  const sessionId =
    payload.data?.sessionId ||
    'upsc-study';


  const url =
    payload.data?.url ||
    './index.html';


  return self.registration.showNotification(

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

      const target = new URL(
        event.notification.data?.url || './index.html',
        self.location.origin
      ).href;


      /* -----------------------------------------------
         Focus exact existing page
         ----------------------------------------------- */

      for (const client of list) {

        if (
          client.url === target &&
          'focus' in client
        ) {

          return client.focus();

        }

      }


      /* -----------------------------------------------
         Otherwise focus any existing app window
         ----------------------------------------------- */

      for (const client of list) {

        if ('focus' in client) {

          return client.focus();

        }

      }


      /* -----------------------------------------------
         Open the app
         ----------------------------------------------- */

      if (clients.openWindow) {

        return clients.openWindow(target);

      }

    })

  );

});
