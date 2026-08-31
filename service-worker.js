/* =========================================================
   UPSC INTERVIEW PREP
   PWA CACHE + FIREBASE CLOUD MESSAGING
   ========================================================= */


/* =========================================================
   FIREBASE
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


/* =========================================================
   PWA CACHE
   ========================================================= */

const CACHE = 'upsc-prep-v13.2.7';


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
   INSTALL
   ========================================================= */

self.addEventListener('install', event => {

  console.log('[StudyPush SW] Installing', CACHE);

  event.waitUntil(

    caches.open(CACHE)

      .then(cache => {

        return cache.addAll(ASSETS);

      })

      .then(() => {

        console.log('[StudyPush SW] Assets cached');

        return self.skipWaiting();

      })

  );

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener('activate', event => {

  console.log('[StudyPush SW] Activating');

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

        console.log('[StudyPush SW] Old caches removed');

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

  console.log(
    '[StudyPush SW] Background message:',
    payload
  );


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

      icon:
        './assets/icons/icon-192.png',

      badge:
        './assets/icons/icon-192.png',

      tag:
        sessionId,

      renotify:
        true,

      data: {
        url: url
      }

    }

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

        const target =
          new URL(

            event.notification.data?.url ||
            './index.html',

            self.location.origin

          ).href;


        /* -----------------------------------------------
           Focus exact app page
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
           Focus any open app page
           ----------------------------------------------- */

        for (const client of list) {

          if ('focus' in client) {

            return client.focus();

          }

        }


        /* -----------------------------------------------
           Open app
           ----------------------------------------------- */

        if (clients.openWindow) {

          return clients.openWindow(target);

        }

      })

    );

  }
);
