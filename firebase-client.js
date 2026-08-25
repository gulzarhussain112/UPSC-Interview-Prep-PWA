(function () {
  const cfg = window.UPSC_FIREBASE_CONFIG || {};

  const configured =
    cfg.apiKey &&
    cfg.projectId &&
    cfg.appId &&
    cfg.vapidKey &&
    !String(cfg.apiKey).startsWith('PASTE_') &&
    !String(cfg.vapidKey).startsWith('PASTE_');

  let messaging = null;
  let db = null;
  let user = null;
  let token = null;

  function setState(t) {
    window.dispatchEvent(
      new CustomEvent('study-push-state', {
        detail: t
      })
    );
  }

  /*
   * ------------------------------------------------------------
   * Firebase configuration check
   * ------------------------------------------------------------
   */

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

  try {
    /*
     * ------------------------------------------------------------
     * Initialize Firebase
     * ------------------------------------------------------------
     */

    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }

    db = firebase.firestore();
    messaging = firebase.messaging();

    /*
     * ------------------------------------------------------------
     * Anonymous Firebase user
     * ------------------------------------------------------------
     */

    async function ensureUser() {
      if (user) {
        return user;
      }

      const current = firebase.auth().currentUser;

      if (current) {
        user = current;
        return user;
      }

      const result = await firebase.auth().signInAnonymously();

      user = result.user;

      console.log(
        'Firebase anonymous user:',
        user.uid
      );

      return user;
    }

    /*
     * ------------------------------------------------------------
     * Save FCM token
     * ------------------------------------------------------------
     */

    async function saveToken(fcmToken) {
      const u = await ensureUser();

      token = fcmToken;

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'Asia/Kolkata';

      await db
        .collection('users')
        .doc(u.uid)
        .set(
          {
            fcmToken: fcmToken,

            timezone: timezone,

            enabled: true,

            notificationFrequencyMinutes: 30,

            strictMode: true,

            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

      /*
       * Keep a local copy so the UI remembers that this
       * browser/device has successfully registered.
       */
      localStorage.setItem(
        'upsc_push_enabled',
        '1'
      );

      localStorage.setItem(
        'upsc_fcm_token',
        fcmToken
      );

      setState('enabled');

      console.log(
        'FCM TOKEN SAVED'
      );

      console.log(
        'User UID:',
        u.uid
      );

      console.log(
        'FCM token:',
        fcmToken
      );
    }

    /*
     * ------------------------------------------------------------
     * Public StudyPush API
     * ------------------------------------------------------------
     */

    window.StudyPush = {

      /*
       * ----------------------------------------------------------
       * Check whether this device is registered
       * ----------------------------------------------------------
       */

      isEnabled: () => {
        return (
          !!token ||
          localStorage.getItem(
            'upsc_push_enabled'
          ) === '1'
        );
      },

      /*
       * ----------------------------------------------------------
       * Firebase configuration exists
       * ----------------------------------------------------------
       */

      isConfigured: () => true,

      /*
       * ----------------------------------------------------------
       * COMPLETE NOTIFICATION REGISTRATION
       *
       * This is what the UI button calls.
       *
       * No DevTools commands are required.
       * ----------------------------------------------------------
       */

      enable: async () => {

        console.log(
          '===================================='
        );

        console.log(
          'STUDY PUSH SETUP START'
        );

        console.log(
          '===================================='
        );

        /*
         * 1. Browser Notification API
         */

        if (!('Notification' in window)) {
          throw new Error(
            'This browser does not support notifications.'
          );
        }

        /*
         * 2. Service Worker support
         */

        if (!('serviceWorker' in navigator)) {
          throw new Error(
            'This browser does not support service workers.'
          );
        }

        /*
         * 3. Check current permission
         */

        console.log(
          'Current notification permission:',
          Notification.permission
        );

        let permission =
          Notification.permission;

        /*
         * Only request permission if it has not already
         * been granted.
         */

        if (permission !== 'granted') {

          permission =
            await Notification.requestPermission();

        }

        console.log(
          'Notification permission result:',
          permission
        );

        if (permission !== 'granted') {

          throw new Error(
            'Notification permission was not granted. Please allow notifications for this site and try again.'
          );

        }

        /*
         * 4. Make sure Firebase Anonymous Auth exists
         */

        const u = await ensureUser();

        console.log(
          'Using Firebase user:',
          u.uid
        );

        /*
         * 5. Register Firebase Messaging service worker
         */

        console.log(
          'Registering Firebase Messaging service worker...'
        );

        const registration =
          await navigator.serviceWorker.register(
            './firebase-messaging-sw.js',
            {
              scope: './'
            }
          );

        console.log(
          'Firebase Messaging service worker registered:',
          registration.scope
        );

        /*
         * 6. Wait until service worker is ready
         */

        const readyRegistration =
          await navigator.serviceWorker.ready;

        console.log(
          'Service worker ready:',
          readyRegistration.scope
        );

        /*
         * 7. Get FCM token
         */

        console.log(
          'Requesting FCM token...'
        );

        const fcmToken =
          await messaging.getToken({
            vapidKey: cfg.vapidKey,

            serviceWorkerRegistration:
              registration
          });

        console.log(
          'FCM getToken() result:',
          fcmToken
            ? fcmToken
            : 'NO TOKEN'
        );

        /*
         * 8. Token is mandatory
         */

        if (!fcmToken) {

          throw new Error(
            'Firebase did not return an FCM token. Check the Web Push VAPID key and Firebase Messaging service worker.'
          );

        }

        /*
         * 9. Save token to Firestore
         */

        await saveToken(
          fcmToken
        );

        /*
         * 10. Sync current study progress
         */

        if (
          window.upscGetStatusMap
        ) {

          await window.StudyPush.syncProgress(
            window.upscGetStatusMap()
          );

        }

        /*
         * 11. Final state
         */

        setState(
          'enabled'
        );

        console.log(
          '===================================='
        );

        console.log(
          'STUDY PUSH SETUP COMPLETE'
        );

        console.log(
          '===================================='
        );

        return true;
      },

      /*
       * ----------------------------------------------------------
       * Sync study progress
       * ----------------------------------------------------------
       */

      syncProgress: async (
        statusMap
      ) => {

        try {

          const u =
            await ensureUser();

          await db
            .collection('users')
            .doc(u.uid)
            .set(
              {
                status:
                  statusMap || {},

                updatedAt:
                  firebase.firestore.FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );

        } catch (e) {

          console.warn(
            'Could not sync progress:',
            e
          );

        }
      },

      /*
       * ----------------------------------------------------------
       * Acknowledge study session
       * ----------------------------------------------------------
       */

      ackSession: async (
        s
      ) => {

        try {

          const u =
            await ensureUser();

          await db
            .collection('users')
            .doc(u.uid)
            .collection('sessions')
            .doc(s.id)
            .set(
              {
                date: s.date,

                slot: s.slot,

                start: s.start,

                end: s.end,

                subject: s.e[1],

                topic: s.e[2],

                acknowledged: true,

                acknowledgedAt:
                  firebase.firestore.FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );

        } catch (e) {

          console.warn(
            'Could not sync session acknowledgement:',
            e
          );

        }
      },

      /*
       * ----------------------------------------------------------
       * Disable notifications
       * ----------------------------------------------------------
       */

      disable: async () => {

        try {

          const u =
            await ensureUser();

          await db
            .collection('users')
            .doc(u.uid)
            .set(
              {
                enabled: false,

                updatedAt:
                  firebase.firestore.FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );

        } finally {

          localStorage.removeItem(
            'upsc_push_enabled'
          );

          localStorage.removeItem(
            'upsc_fcm_token'
          );

          token = null;

          setState(
            'disabled'
          );

        }
      }
    };

    /*
     * ------------------------------------------------------------
     * Keep Firebase user reference updated
     * ------------------------------------------------------------
     */

    firebase
      .auth()
      .onAuthStateChanged(
        u => {

          if (u) {
            user = u;

            console.log(
              'Firebase auth ready:',
              u.uid
            );
          }

        }
      );

    /*
     * ------------------------------------------------------------
     * Foreground FCM messages
     * ------------------------------------------------------------
     *
     * This handles notifications while the PWA is open.
     * ------------------------------------------------------------
     */

    messaging.onMessage(
      payload => {

        console.log(
          'FCM foreground message:',
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

          new Notification(
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

              renotify: true,

              data: {
                url:
                  './index.html'
              }
            }
          );

        }

      }
    );

    /*
     * ------------------------------------------------------------
     * Initial state
     * ------------------------------------------------------------
     */

    const alreadyEnabled =
      Notification.permission ===
        'granted' &&
      localStorage.getItem(
        'upsc_push_enabled'
      ) === '1';

    setState(
      alreadyEnabled
        ? 'enabled'
        : 'ready'
    );

  } catch (e) {

    console.warn(
      'Firebase push initialization failed:',
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

    setState(
      'error'
    );
  }
})();
