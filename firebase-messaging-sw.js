/* =========================================================
   UPSC INTERVIEW PREP
   Firebase Cloud Messaging Service Worker
   Firebase JS SDK 10.12.5
   ========================================================= */

'use strict';


/* =========================================================
   LOAD FIREBASE
   ========================================================= */

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js'
);

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js'
);


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

firebase.initializeApp({

  apiKey:
    'AIzaSyAiyANqQh7Lqs80oOuavU93nvEY2diaGag',

  authDomain:
    'interview-prep-upsc.firebaseapp.com',

  projectId:
    'interview-prep-upsc',

  storageBucket:
    'interview-prep-upsc.firebasestorage.app',

  messagingSenderId:
    '632920971695',

  appId:
    '1:632920971695:web:1d3c90a1484fbe1c95b75a'

});


/* =========================================================
   FIREBASE MESSAGING
   ========================================================= */

const messaging =
  firebase.messaging();


/* =========================================================
   SERVICE WORKER INSTALL
   ========================================================= */

self.addEventListener(
  'install',
  function () {

    console.log(
      '[UPSC SW] Service Worker installed'
    );

    self.skipWaiting();

  }
);


/* =========================================================
   SERVICE WORKER ACTIVATE
   ========================================================= */

self.addEventListener(
  'activate',
  function (event) {

    console.log(
      '[UPSC SW] Service Worker activated'
    );

    event.waitUntil(
      self.clients.claim()
    );

  }
);


/* =========================================================
   BACKGROUND FCM MESSAGE
   ========================================================= */

messaging.onBackgroundMessage(
  function (payload) {

    console.log(
      '[UPSC SW] Background FCM message:',
      payload
    );


    var title =
      'UPSC Study Reminder';


    var body =
      'Your scheduled study session needs attention.';


    var sessionId =
      'upsc-study';


    var targetUrl =
      './index.html';


    /*
      FCM data message
    */

    if (
      payload &&
      payload.data
    ) {

      if (
        payload.data.title
      ) {

        title =
          payload.data.title;

      }


      if (
        payload.data.body
      ) {

        body =
          payload.data.body;

      }


      if (
        payload.data.sessionId
      ) {

        sessionId =
          payload.data.sessionId;

      }


      if (
        payload.data.url
      ) {

        targetUrl =
          payload.data.url;

      }

    }


    /*
      FCM notification message fallback
    */

    if (
      payload &&
      payload.notification
    ) {

      if (
        payload.notification.title
      ) {

        title =
          payload.notification.title;

      }


      if (
        payload.notification.body
      ) {

        body =
          payload.notification.body;

      }

    }


    console.log(
      '[UPSC SW] Showing notification:',
      title,
      body
    );


    return self.registration.showNotification(
      title,
      {

        body:
          body,

        icon:
          './assets/icons/icon-192.png',

        badge:
          './assets/icons/icon-192.png',

        tag:
          sessionId,

        renotify:
          true,

        data:
          {
            url:
              targetUrl
          }

      }
    );

  }
);


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  'notificationclick',
  function (event) {

    console.log(
      '[UPSC SW] Notification clicked'
    );


    event.notification.close();


    var targetUrl =
      './index.html';


    if (
      event.notification &&
      event.notification.data &&
      event.notification.data.url
    ) {

      targetUrl =
        event.notification.data.url;

    }


    event.waitUntil(

      clients
        .matchAll({

          type:
            'window',

          includeUncontrolled:
            true

        })

        .then(
          function (clientList) {

            var target =
              new URL(
                targetUrl,
                self.location.origin
              ).href;


            /*
              First try to focus the exact app page.
            */

            for (
              var i = 0;
              i < clientList.length;
              i++
            ) {

              var client =
                clientList[i];


              if (
                client.url === target &&
                'focus' in client
              ) {

                return client.focus();

              }

            }


            /*
              Otherwise focus any existing
              UPSC app window.
            */

            for (
              var j = 0;
              j < clientList.length;
              j++
            ) {

              var existingClient =
                clientList[j];


              if (
                'focus' in existingClient
              ) {

                return existingClient.focus();

              }

            }


            /*
              No existing window.
              Open the PWA.
            */

            if (
              clients.openWindow
            ) {

              return clients.openWindow(
                target
              );

            }

          }
        )

    );

  }
);


/* =========================================================
   ERROR LOGGING
   ========================================================= */

self.addEventListener(
  'error',
  function (event) {

    console.error(
      '[UPSC SW] ERROR:',
      event.error || event.message
    );

  }
);


self.addEventListener(
  'unhandledrejection',
  function (event) {

    console.error(
      '[UPSC SW] UNHANDLED PROMISE ERROR:',
      event.reason
    );

  }
);


console.log(
  '[UPSC SW] firebase-messaging-sw.js loaded successfully'
);
