(function () {

  'use strict';


  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const cfg = window.UPSC_FIREBASE_CONFIG || {};

  const configured =
    !!(
      cfg.apiKey &&
      cfg.projectId &&
      cfg.appId &&
      cfg.vapidKey &&
      !String(cfg.apiKey).startsWith('PASTE_') &&
      !String(cfg.vapidKey).startsWith('PASTE_')
    );


  let messaging = null;
  let db = null;
  let user = null;
  let token = null;
  let messagingRegistration = null;


  const ENABLE_TIMEOUT = 30000;


  /* =========================================================
     HELPERS
     ========================================================= */

  function log(step, ...args) {

    console.log(
      `[StudyPush] ${step}`,
      ...args
    );

  }


  function warn(step, ...args) {

    console.warn(
      `[StudyPush] ${step}`,
      ...args
    );

  }


  function setState(state) {

    window.dispatchEvent(
      new CustomEvent(
        'study-push-state',
        {
          detail: state
        }
      )
    );

  }


  function timeout(promise, ms, message) {

    return Promise.race([

      promise,

      new Promise((_, reject) => {

        setTimeout(() => {

          reject(
            new Error(message)
          );

        }, ms);

      })

    ]);

  }


  function getServiceWorkerUrl() {

    /*
      This is important for GitHub Pages.

      If the application is running at:

      /UPSC-Interview-Prep-PWA/

      the browser gets:

      /UPSC-Interview-Prep-PWA/firebase-messaging-sw.js
    */

    return new URL(
      'firebase-messaging-sw.js',
      window.location.href
    ).href;

  }


  /* =========================================================
     NOT CONFIGURED
     ========================================================= */

  if (!configured) {

    window.StudyPush = {

      isEnabled: () => false,

      isConfigured: () => false,

      enable: async () => {

        throw new Error(
          'Firebase is not configured yet. Add your Firebase web config and Web Push VAPID key to firebase-config.js.'
        );

      },

      syncProgress: async () => {},

      ackSession: async () => {},

      disable: async () => {}

    };

    setState('not-configured');

    return;

  }


  /* =========================================================
     FIREBASE INITIALIZATION
     ========================================================= */

  try {

    log(
      'INIT',
      'Starting Firebase initialization'
    );


    if (!window.firebase) {

      throw new Error(
        'Firebase JavaScript SDK is not loaded.'
      );

    }


    if (!firebase.apps.length) {

      log(
        'INIT',
        'Initializing Firebase'
      );

      firebase.initializeApp(cfg);

    }
    else {

      log(
        'INIT',
        'Firebase app already initialized'
      );

    }


    db =
      firebase.firestore();

    messaging =
      firebase.messaging();


    log(
      'INIT',
      'Firebase Messaging initialized'
    );


    /* =======================================================
       ANONYMOUS USER
       ======================================================= */

    async function ensureUser() {

      if (user) {

        return user;

      }


      log(
        'AUTH',
        'Checking Firebase authentication'
      );


      const currentUser =
        firebase.auth().currentUser;


      if (currentUser) {

        user = currentUser;

        log(
          'AUTH',
          'Existing Firebase user:',
          user.uid
        );

        return user;

      }


      log(
        'AUTH',
        'Signing in anonymously...'
      );


      const result =
        await timeout(
          firebase.auth().signInAnonymously(),
          ENABLE_TIMEOUT,
          'Firebase anonymous sign-in timed out.'
        );


      user =
        result.user;


      if (!user) {

        throw new Error(
          'Firebase anonymous sign-in returned no user.'
        );

      }


      log(
        'AUTH',
        'Anonymous user ready:',
        user.uid
      );


      return user;

    }


    /* =======================================================
       SAVE FCM TOKEN
       ======================================================= */

    async function saveToken(t) {

      if (!t) {

        throw new Error(
          'Cannot save an empty FCM token.'
        );

      }


      const u =
        await ensureUser();


      token = t;


      const timezone =
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone ||
        'UTC';


      log(
        'FIRESTORE',
        'Saving FCM token for user:',
        u.uid
      );


      await timeout(

        db
          .collection('users')
          .doc(u.uid)
          .set({

            fcmToken: t,

            timezone: timezone,

            enabled: true,

            notificationFrequencyMinutes: 30,

            strictMode: true,

            updatedAt:
              firebase.firestore.FieldValue
                .serverTimestamp()

          }, {

            merge: true

          }),

        ENABLE_TIMEOUT,

        'Saving the notification token to Firestore timed out.'

      );


      /*
        Only mark the device enabled AFTER Firestore
        successfully accepts the token.
      */

      localStorage.setItem(
        'upsc_push_enabled',
        '1'
      );


      log(
        'FIRESTORE',
        'FCM TOKEN SAVED successfully'
      );


      log(
        'FIRESTORE',
        'User UID:',
        u.uid
      );


      setState('enabled');

    }


    /* =======================================================
       GET / REGISTER MESSAGING SERVICE WORKER
       ======================================================= */

    async function getMessagingServiceWorker() {

      if (
        !('serviceWorker' in navigator)
      ) {

        throw new Error(
          'This browser does not support Service Workers.'
        );

      }


      const swUrl =
        getServiceWorkerUrl();


      log(
        'SW',
        'Messaging Service Worker URL:',
        swUrl
      );


      /*
        Explicit registration is much safer than simply using
        navigator.serviceWorker.ready.

        It guarantees that Firebase Messaging gets the exact
        Service Worker we expect.
      */

      log(
        'SW',
        'Registering firebase-messaging-sw.js...'
      );


      let registration;


      try {

        registration =
          await timeout(

            navigator.serviceWorker.register(
              swUrl,
              {
                scope:
                  new URL(
                    './',
                    window.location.href
                  ).pathname
              }
            ),

            ENABLE_TIMEOUT,

            'Service Worker registration timed out.'

          );

      }
      catch (e) {

        console.error(
          '[StudyPush] SERVICE WORKER REGISTRATION FAILED',
          e
        );


        throw new Error(
          'Firebase Messaging Service Worker could not be registered. ' +
          'Open DevTools Console and look for [StudyPush] SW errors. ' +
          'Original error: ' +
          (e.message || e)
        );

      }


      messagingRegistration =
        registration;


      log(
        'SW',
        'Registration created:',
        registration.scope
      );


      /*
        Check registration state.
      */

      log(
        'SW',
        'Installing:',
        !!registration.installing
      );

      log(
        'SW',
        'Waiting:',
        !!registration.waiting
      );

      log(
        'SW',
        'Active:',
        !!registration.active
      );


      /*
        If the worker is installing, wait until it becomes active.
      */

      if (
        registration.installing
      ) {

        log(
          'SW',
          'Service Worker is installing...'
        );


        await timeout(

          new Promise((resolve, reject) => {

            const worker =
              registration.installing;


            const checkState = () => {

              log(
                'SW',
                'Worker state:',
                worker.state
              );


              if (
                worker.state === 'activated'
              ) {

                resolve();

              }


              if (
                worker.state === 'redundant'
              ) {

                reject(
                  new Error(
                    'Firebase Messaging Service Worker became redundant.'
                  )
                );

              }

            };


            worker.addEventListener(
              'statechange',
              checkState
            );


            checkState();

          }),

          ENABLE_TIMEOUT,

          'Firebase Messaging Service Worker did not become active in time.'

        );

      }


      /*
        If waiting, activate it if possible.
      */

      if (
        registration.waiting &&
        navigator.serviceWorker.controller
      ) {

        log(
          'SW',
          'A waiting Service Worker exists.'
        );

      }


      if (!registration.active) {

        throw new Error(
          'Firebase Messaging Service Worker registered but has no active worker.'
        );

      }


      log(
        'SW',
        'Service Worker ACTIVE:',
        registration.active.scriptURL
      );


      return registration;

    }


    /* =======================================================
       PUBLIC API
       ======================================================= */

    window.StudyPush = {

      /* -----------------------------------------------------
         ENABLED STATE
         ----------------------------------------------------- */

      isEnabled: () => {

        return !!token ||
          localStorage.getItem(
            'upsc_push_enabled'
          ) === '1';

      },


      /* -----------------------------------------------------
         CONFIGURED
         ----------------------------------------------------- */

      isConfigured: () => true,


      /* =====================================================
         ENABLE NOTIFICATIONS
         ===================================================== */

      enable: async () => {

        log(
          'ENABLE',
          '========================================'
        );

        log(
          'ENABLE',
          'STARTING NOTIFICATION SETUP'
        );


        try {

          /* -----------------------------------------------
             STEP 1 — Browser support
             ----------------------------------------------- */

          log(
            'STEP 1',
            'Checking browser notification support...'
          );


          if (
            !('Notification' in window)
          ) {

            throw new Error(
              'This browser does not support notifications.'
            );

          }


          if (
            !('serviceWorker' in navigator)
          ) {

            throw new Error(
              'This browser does not support Service Workers.'
            );

          }


          log(
            'STEP 1',
            'Browser support OK'
          );


          /* -----------------------------------------------
             STEP 2 — Permission
             ----------------------------------------------- */

          log(
            'STEP 2',
            'Current notification permission:',
            Notification.permission
          );


          let permission =
            Notification.permission;


          if (
            permission !== 'granted'
          ) {

            log(
              'STEP 2',
              'Requesting notification permission...'
            );


            permission =
              await timeout(

                Notification.requestPermission(),

                ENABLE_TIMEOUT,

                'Notification permission request timed out.'

              );

          }


          log(
            'STEP 2',
            'Permission result:',
            permission
          );


          if (
            permission !== 'granted'
          ) {

            throw new Error(
              'Notification permission was not granted. Current permission: ' +
              permission
            );

          }


          /* -----------------------------------------------
             STEP 3 — Firebase authentication
             ----------------------------------------------- */

          log(
            'STEP 3',
            'Preparing Firebase user...'
          );


          const u =
            await ensureUser();


          log(
            'STEP 3',
            'Firebase user ready:',
            u.uid
          );


          /* -----------------------------------------------
             STEP 4 — Service Worker
             ----------------------------------------------- */

          log(
            'STEP 4',
            'Preparing Firebase Messaging Service Worker...'
          );


          const registration =
            await getMessagingServiceWorker();


          log(
            'STEP 4',
            'Messaging Service Worker ready'
          );


          /* -----------------------------------------------
             STEP 5 — FCM token
             ----------------------------------------------- */

          log(
            'STEP 5',
            'Requesting FCM registration token...'
          );


          if (!messaging) {

            throw new Error(
              'Firebase Messaging is not initialized.'
            );

          }


          const t =
            await timeout(

              messaging.getToken({

                vapidKey:
                  cfg.vapidKey,

                serviceWorkerRegistration:
                  registration

              }),

              ENABLE_TIMEOUT,

              'FCM getToken() timed out. The Firebase Messaging Service Worker may not be working correctly.'

            );


          log(
            'STEP 5',
            'FCM token received:',
            t
          );


          if (!t) {

            throw new Error(
              'Firebase did not return a notification token.'
            );

          }


          /* -----------------------------------------------
             STEP 6 — Firestore
             ----------------------------------------------- */

          log(
            'STEP 6',
            'Saving device registration...'
          );


          await saveToken(t);


          /* -----------------------------------------------
             STEP 7 — Existing progress
             ----------------------------------------------- */

          log(
            'STEP 7',
            'Synchronizing existing progress...'
          );


          if (
            window.upscGetStatusMap
          ) {

            await window.StudyPush
              .syncProgress(
                window.upscGetStatusMap()
              );

          }


          log(
            'ENABLE',
            '========================================'
          );

          log(
            'ENABLE',
            'NOTIFICATIONS ENABLED SUCCESSFULLY'
          );

          log(
            'ENABLE',
            '========================================'
          );


          return true;

        }
        catch (e) {

          /*
            IMPORTANT:
            Never leave the UI in "Enabling..." state.
          */

          localStorage.removeItem(
            'upsc_push_enabled'
          );


          token = null;


          setState('error');


          console.error(
            '[StudyPush] ========================================'
          );

          console.error(
            '[StudyPush] NOTIFICATION SETUP FAILED'
          );

          console.error(
            '[StudyPush] Error:',
            e
          );

          console.error(
            '[StudyPush] ========================================'
          );


          throw e;

        }

      },


      /* =====================================================
         SYNC PROGRESS
         ===================================================== */

      syncProgress: async statusMap => {

        try {

          const u =
            await ensureUser();


          await timeout(

            db
              .collection('users')
              .doc(u.uid)
              .set({

                status:
                  statusMap || {},

                updatedAt:
                  firebase.firestore.FieldValue
                    .serverTimestamp()

              }, {

                merge: true

              }),

            ENABLE_TIMEOUT,

            'Progress synchronization timed out.'

          );


          log(
            'SYNC',
            'Progress synchronized'
          );

        }
        catch (e) {

          warn(
            'SYNC',
            'Could not sync progress:',
            e
          );

        }

      },


      /* =====================================================
         ACKNOWLEDGE SESSION
         ===================================================== */

      ackSession: async s => {

        try {

          const u =
            await ensureUser();


          await timeout(

            db
              .collection('users')
              .doc(u.uid)
              .collection('sessions')
              .doc(s.id)
              .set({

                date:
                  s.date,

                slot:
                  s.slot,

                start:
                  s.start,

                end:
                  s.end,

                subject:
                  s.e[1],

                topic:
                  s.e[2],

                acknowledged:
                  true,

                acknowledgedAt:
                  firebase.firestore.FieldValue
                    .serverTimestamp()

              }, {

                merge: true

              }),

            ENABLE_TIMEOUT,

            'Session acknowledgement timed out.'

          );


          log(
            'SESSION',
            'Session acknowledgement synchronized'
          );

        }
        catch (e) {

          warn(
            'SESSION',
            'Could not sync session acknowledgement:',
            e
          );

        }

      },


      /* =====================================================
         DISABLE
         ===================================================== */

      disable: async () => {

        try {

          const u =
            await ensureUser();


          await db
            .collection('users')
            .doc(u.uid)
            .set({

              enabled:
                false,

              updatedAt:
                firebase.firestore.FieldValue
                  .serverTimestamp()

            }, {

              merge: true

            });

        }
        finally {

          localStorage.removeItem(
            'upsc_push_enabled'
          );

          token = null;

          setState('disabled');

          log(
            'DISABLE',
            'Study notifications disabled'
          );

        }

      }

    };


    /* =======================================================
       AUTH STATE
       ======================================================= */

    firebase.auth()
      .onAuthStateChanged(u => {

        if (u) {

          user = u;

          log(
            'AUTH',
            'Firebase auth ready:',
            u.uid
          );

        }

      });


    /* =======================================================
       FOREGROUND FCM MESSAGE
       ======================================================= */

    messaging.onMessage(payload => {

      log(
        'FCM',
        'Foreground message received:',
        payload
      );


      const title =
        payload.data?.title ||
        payload.notification?.title ||
        'UPSC Study Reminder';


      const body =
        payload.data?.body ||
        payload.notification?.body ||
        'Your study session needs attention.';


      if (
        Notification.permission ===
        'granted'
      ) {

        try {

          new Notification(
            title,
            {

              body:

                body,

              icon:
                './assets/icons/icon-192.png',

              badge:
                './assets/icons/icon-192.png',

              tag:
                payload.data?.sessionId ||
                'upsc-study',

              renotify:
                true,

              data: {

                url:
                  payload.data?.url ||
                  './index.html'

              }

            }
          );

        }
        catch (e) {

          warn(
            'FCM',
            'Could not display foreground notification:',
            e
          );

        }

      }

    });


    /* =======================================================
       INITIAL STATE
       ======================================================= */

    const storedEnabled =
      localStorage.getItem(
        'upsc_push_enabled'
      ) === '1';


    if (
      Notification.permission === 'granted' &&
      storedEnabled
    ) {

      setState('enabled');

    }
    else {

      setState('ready');

    }


    log(
      'INIT',
      'StudyPush ready'
    );

  }
  catch (e) {

    console.error(
      '[StudyPush] Firebase push initialization failed:',
      e
    );


    window.StudyPush = {

      isEnabled: () => false,

      isConfigured: () => true,

      enable: async () => {

        throw e;

      },

      syncProgress: async () => {},

      ackSession: async () => {},

      disable: async () => {}

    };


    setState('error');

  }

})();
