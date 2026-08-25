(function(){

  const cfg =
    window.UPSC_FIREBASE_CONFIG || {};


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


  function setState(state){

    window.dispatchEvent(
      new CustomEvent(
        'study-push-state',
        {
          detail: state
        }
      )
    );

  }


  /*
  =========================================================
   NOT CONFIGURED
  =========================================================
  */

  if(!configured){

    window.StudyPush = {

      isEnabled:
        () => false,

      isConfigured:
        () => false,

      enable:
        async () => {

          throw new Error(
            'Firebase is not configured. Check firebase-config.js.'
          );

        },

      syncProgress:
        async () => {},

      ackSession:
        async () => {},

      disable:
        async () => {}

    };


    setState(
      'not-configured'
    );

    return;

  }


  /*
  =========================================================
   FIREBASE INITIALIZATION
  =========================================================
  */

  try{

    if(!firebase.apps.length){

      firebase.initializeApp(
        cfg
      );

    }


    db =
      firebase.firestore();


    messaging =
      firebase.messaging();


    /*
    =======================================================
     ENSURE ANONYMOUS USER
    =======================================================
    */

    async function ensureUser(){

      if(user){

        return user;

      }


      const result =
        await firebase.auth()
          .signInAnonymously();


      user =
        result.user;


      console.log(
        '[StudyPush] Firebase user:',
        user.uid
      );


      return user;

    }


    /*
    =======================================================
     REMOVE OLD FIREBASE MESSAGING SW
    =======================================================
    */

    async function removeOldMessagingWorker(){

      if(
        !navigator.serviceWorker ||
        !navigator.serviceWorker.getRegistrations
      ){

        return;

      }


      const registrations =
        await navigator.serviceWorker
          .getRegistrations();


      for(
        const registration
        of registrations
      ){

        const scriptURL =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          '';


        if(
          scriptURL.includes(
            'firebase-messaging-sw.js'
          )
        ){

          console.log(
            '[StudyPush] Removing old Firebase messaging service worker'
          );


          await registration.unregister();

        }

      }

    }


    /*
    =======================================================
     ENSURE OUR MAIN SERVICE WORKER
    =======================================================
    */

    async function getServiceWorker(){

      await removeOldMessagingWorker();


      /*
      Register the ONE service worker used
      by the entire PWA.
      */

      const registration =
        await navigator.serviceWorker.register(
          './service-worker.js',
          {
            scope: './'
          }
        );


      console.log(
        '[StudyPush] Service worker registered:',
        registration.scope
      );


      /*
      Wait until it becomes active.
      */

      if(
        registration.installing
      ){

        await new Promise(resolve => {

          registration.installing
            .addEventListener(
              'statechange',
              function(){

                if(
                  this.state === 'activated'
                ){

                  resolve();

                }

              }
            );

        });

      }


      await navigator.serviceWorker.ready;


      console.log(
        '[StudyPush] Service worker ready'
      );


      return registration;

    }


    /*
    =======================================================
     SAVE TOKEN
    =======================================================
    */

    async function saveToken(t){

      const u =
        await ensureUser();


      token =
        t;


      await db
        .collection('users')
        .doc(u.uid)
        .set({

          fcmToken:
            t,

          timezone:
            Intl.DateTimeFormat()
              .resolvedOptions()
              .timeZone,

          enabled:
            true,

          notificationFrequencyMinutes:
            30,

          strictMode:
            true,

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()

        }, {

          merge:
            true

        });


      localStorage.setItem(
        'upsc_push_enabled',
        '1'
      );


      console.log(
        '[StudyPush] FCM TOKEN SAVED'
      );


      console.log(
        '[StudyPush] UID:',
        u.uid
      );


      setState(
        'enabled'
      );

    }


    /*
    =========================================================
     PUBLIC API
    =========================================================
    */

    window.StudyPush = {

      isEnabled:
        () => {

          return !!token ||
            localStorage.getItem(
              'upsc_push_enabled'
            ) === '1';

        },


      isConfigured:
        () => true,


      /*
      =======================================================
       ENABLE NOTIFICATIONS
      =======================================================
      */

      enable:
        async () => {

          console.log(
            '[StudyPush] Starting notification setup...'
          );


          if(
            !('Notification' in window)
          ){

            throw new Error(
              'This browser does not support notifications.'
            );

          }


          if(
            !('serviceWorker' in navigator)
          ){

            throw new Error(
              'This browser does not support service workers.'
            );

          }


          /*
          -----------------------------------------------
           Permission
          -----------------------------------------------
          */

          console.log(
            '[StudyPush] Current permission:',
            Notification.permission
          );


          let permission =
            Notification.permission;


          if(
            permission !== 'granted'
          ){

            permission =
              await Notification.requestPermission();

          }


          console.log(
            '[StudyPush] Permission:',
            permission
          );


          if(
            permission !== 'granted'
          ){

            throw new Error(
              'Notification permission was not granted.'
            );

          }


          /*
          -----------------------------------------------
           Firebase user
          -----------------------------------------------
          */

          const u =
            await ensureUser();


          console.log(
            '[StudyPush] Using Firebase user:',
            u.uid
          );


          /*
          -----------------------------------------------
           ONE service worker
          -----------------------------------------------
          */

          const registration =
            await getServiceWorker();


          console.log(
            '[StudyPush] SW ready:',
            registration.scope
          );


          /*
          -----------------------------------------------
           FCM token
          -----------------------------------------------
          */

          console.log(
            '[StudyPush] Requesting FCM token...'
          );


          const t =
            await messaging.getToken({

              vapidKey:
                cfg.vapidKey,

              serviceWorkerRegistration:
                registration

            });


          console.log(
            '[StudyPush] FCM token received:',
            !!t
          );


          if(!t){

            throw new Error(
              'Firebase did not return an FCM token.'
            );

          }


          /*
          -----------------------------------------------
           Save to Firestore
          -----------------------------------------------
          */

          await saveToken(
            t
          );


          /*
          -----------------------------------------------
           Sync progress
          -----------------------------------------------
          */

          if(
            window.upscGetStatusMap
          ){

            await window.StudyPush
              .syncProgress(
                window.upscGetStatusMap()
              );

          }


          console.log(
            '[StudyPush] Notification setup complete.'
          );


          return true;

        },


      /*
      =======================================================
       SYNC PROGRESS
      =======================================================
      */

      syncProgress:
        async statusMap => {

          try{

            const u =
              await ensureUser();


            await db
              .collection('users')
              .doc(u.uid)
              .set({

                status:
                  statusMap || {},

                updatedAt:
                  firebase.firestore
                    .FieldValue
                    .serverTimestamp()

              }, {

                merge:
                  true

              });

          }
          catch(e){

            console.warn(
              '[StudyPush] Progress sync failed:',
              e
            );

          }

        },


      /*
      =======================================================
       ACK SESSION
      =======================================================
      */

      ackSession:
        async s => {

          try{

            const u =
              await ensureUser();


            await db
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
                  firebase.firestore
                    .FieldValue
                    .serverTimestamp()

              }, {

                merge:
                  true

              });

          }
          catch(e){

            console.warn(
              '[StudyPush] Session sync failed:',
              e
            );

          }

        },


      /*
      =======================================================
       DISABLE
      =======================================================
      */

      disable:
        async () => {

          try{

            const u =
              await ensureUser();


            await db
              .collection('users')
              .doc(u.uid)
              .set({

                enabled:
                  false

              }, {

                merge:
                  true

              });

          }
          finally{

            localStorage.removeItem(
              'upsc_push_enabled'
            );


            token =
              null;


            setState(
              'disabled'
            );

          }

        }

    };


    /*
    =========================================================
     AUTH STATE
    =========================================================
    */

    firebase.auth()
      .onAuthStateChanged(
        u => {

          if(u){

            user =
              u;


            console.log(
              '[StudyPush] Auth ready:',
              u.uid
            );

          }

        }
      );


    /*
    =========================================================
     FOREGROUND MESSAGE
    =========================================================
    */

    messaging.onMessage(
      payload => {

        console.log(
          '[StudyPush] Foreground FCM:',
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


        if(
          Notification.permission ===
          'granted'
        ){

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

              renotify:
                true

            }
          );

        }

      }
    );


    /*
    =========================================================
     INITIAL STATE
    =========================================================
    */

    setState(

      Notification.permission ===
        'granted' &&

      localStorage.getItem(
        'upsc_push_enabled'
      ) === '1'

        ? 'enabled'

        : 'ready'

    );

  }

  catch(e){

    console.error(
      '[StudyPush] Firebase initialization failed:',
      e
    );


    window.StudyPush = {

      isEnabled:
        () => false,

      isConfigured:
        () => true,

      enable:
        async () => {

          throw e;

        },

      syncProgress:
        async () => {},

      ackSession:
        async () => {},

      disable:
        async () => {}

    };


    setState(
      'error'
    );

  }

})();
