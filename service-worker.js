const CACHE = 'upsc-prep-v13.2.2';

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./firebase-config.js",
  "./firebase-client.js",
  "./service-worker.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/screenshots/desktop-wide.png",
  "./assets/screenshots/mobile.png"
];

/* =========================
   Firebase Messaging
========================= */

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js'
);

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js'
);

firebase.initializeApp({

  apiKey:
    "AIzaSyAiyANqQh7Lqs80oOuavU93nvEY2diaGag",

  authDomain:
    "interview-prep-upsc.firebaseapp.com",

  projectId:
    "interview-prep-upsc",

  storageBucket:
    "interview-prep-upsc.firebasestorage.app",

  messagingSenderId:
    "632920971695",

  appId:
    "1:632920971695:web:1d3c90a1484fbe1c95b75a"

});

const messaging = firebase.messaging();


messaging.onBackgroundMessage(payload => {

  console.log(
    '[firebase-messaging-sw] Background message:',
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

  self.registration.showNotification(
    title,
    {

      body,

      icon:
        './assets/icons/icon-192.png',

      badge:
        './assets/icons/icon-192.png',

      tag:
        payload.data?.sessionId ||
        'upsc-study',

      renotify:true,

      data:{
        url:
          payload.data?.url ||
          './index.html'
      }

    }
  );

});


/* =========================
   PWA CACHE
========================= */

self.addEventListener(
  'install',
  event => {

    event.waitUntil(

      caches
        .open(CACHE)
        .then(cache =>
          cache.addAll(ASSETS)
        )
        .then(() =>
          self.skipWaiting()
        )

    );

  }
);


self.addEventListener(
  'activate',
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys =>
          Promise.all(

            keys
              .filter(key => key !== CACHE)
              .map(key =>
                caches.delete(key)
              )

          )
        )
        .then(() =>
          self.clients.claim()
        )

    );

  }
);


self.addEventListener(
  'fetch',
  event => {

    /*
     * Do not cache Firebase/Google requests.
     */
    const url = new URL(event.request.url);

    if(
      url.origin !== self.location.origin
    ){
      return;
    }

    event.respondWith(

      caches
        .match(event.request)
        .then(cached => {

          if(cached){
            return cached;
          }

          return fetch(event.request);

        })

    );

  }
);


/* =========================
   Notification click
========================= */

self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    event.waitUntil(

      clients
        .matchAll({
          type:'window',
          includeUncontrolled:true
        })
        .then(list => {

          const target =
            new URL(
              event.notification.data?.url ||
              './index.html',
              self.location.origin
            ).href;

          for(const c of list){

            if(
              c.url === target &&
              'focus' in c
            ){

              return c.focus();

            }

          }

          for(const c of list){

            if('focus' in c){

              return c.focus();

            }

          }

          return clients.openWindow(target);

        })

    );

  }
);
