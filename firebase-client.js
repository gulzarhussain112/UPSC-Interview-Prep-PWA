(function(){
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

  function setState(t){
    window.dispatchEvent(
      new CustomEvent('study-push-state',{detail:t})
    );
  }

  if(!configured){
    window.StudyPush = {
      isEnabled:()=>false,
      isConfigured:()=>false,

      enable:async()=>{
        throw new Error(
          'Firebase is not configured. Check firebase-config.js and make sure vapidKey is present.'
        );
      },

      syncProgress:async()=>{},
      ackSession:async()=>{}
    };

    setState('not-configured');
    return;
  }

  try{

    if(!firebase.apps.length){
      firebase.initializeApp(cfg);
    }

    db = firebase.firestore();
    messaging = firebase.messaging();

    async function ensureUser(){

      if(user) return user;

      const result = await firebase.auth().signInAnonymously();

      user = result.user;

      console.log('Firebase anonymous user:', user.uid);

      return user;
    }

    async function saveToken(t){

      const u = await ensureUser();

      token = t;

      const data = {
        fcmToken: t,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          'Asia/Kolkata',
        enabled: true,
        notificationFrequencyMinutes: 30,
        strictMode: true,
        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      };

      await db
        .collection('users')
        .doc(u.uid)
        .set(data,{merge:true});

      console.log('FCM TOKEN SAVED');
      console.log('User UID:',u.uid);
      console.log('Token:',t);

      localStorage.setItem('upsc_push_enabled','1');

      setState('enabled');
    }

    window.StudyPush = {

      isEnabled:()=>{
        return !!token ||
          localStorage.getItem('upsc_push_enabled') === '1';
      },

      isConfigured:()=>true,

      enable:async()=>{

        if(!('Notification' in window)){
          throw new Error(
            'This browser does not support notifications.'
          );
        }

        if(!('serviceWorker' in navigator)){
          throw new Error(
            'This browser does not support service workers.'
          );
        }

        console.log(
          'Current notification permission:',
          Notification.permission
        );

        const permission =
          await Notification.requestPermission();

        console.log(
          'Notification permission result:',
          permission
        );

        if(permission !== 'granted'){
          throw new Error(
            'Notification permission was not granted.'
          );
        }

        const u = await ensureUser();

        console.log(
          'Using Firebase user:',
          u.uid
        );

        /*
         * IMPORTANT:
         * Use the main PWA service worker.
         * We no longer register firebase-messaging-sw.js separately.
         */
        const registration =
          await navigator.serviceWorker.register(
            './service-worker.js',
            {scope:'./'}
          );

        await navigator.serviceWorker.ready;

        console.log(
          'Service worker ready:',
          registration.scope
        );

        const t = await messaging.getToken({

          vapidKey: cfg.vapidKey,

          serviceWorkerRegistration:
            registration

        });

        console.log(
          'FCM getToken() result:',
          t
        );

        if(!t){
          throw new Error(
            'Firebase did not return an FCM token.'
          );
        }

        await saveToken(t);

        if(window.upscGetStatusMap){
          await window.StudyPush.syncProgress(
            window.upscGetStatusMap()
          );
        }

        return true;
      },

      syncProgress:async(statusMap)=>{

        try{

          const u = await ensureUser();

          await db
            .collection('users')
            .doc(u.uid)
            .set({

              status: statusMap || {},

              updatedAt:
                firebase.firestore.FieldValue.serverTimestamp()

            },{merge:true});

        }catch(e){

          console.warn(
            'Could not sync progress',
            e
          );

        }
      },

      ackSession:async(s)=>{

        try{

          const u = await ensureUser();

          await db
            .collection('users')
            .doc(u.uid)
            .collection('sessions')
            .doc(s.id)
            .set({

              date:s.date,
              slot:s.slot,
              start:s.start,
              end:s.end,
              subject:s.e[1],
              topic:s.e[2],
              acknowledged:true,

              acknowledgedAt:
                firebase.firestore.FieldValue.serverTimestamp()

            },{merge:true});

        }catch(e){

          console.warn(
            'Could not sync session acknowledgement',
            e
          );

        }
      },

      disable:async()=>{

        try{

          const u = await ensureUser();

          await db
            .collection('users')
            .doc(u.uid)
            .set({

              enabled:false

            },{merge:true});

        }finally{

          localStorage.removeItem(
            'upsc_push_enabled'
          );

          token = null;

          setState('disabled');
        }
      }
    };

    firebase.auth().onAuthStateChanged(u=>{

      if(u){
        user = u;

        console.log(
          'Firebase auth ready:',
          u.uid
        );
      }

    });

    messaging.onMessage(payload=>{

      const title =
        payload.data?.title ||
        payload.notification?.title ||
        'UPSC Study Reminder';

      const body =
        payload.data?.body ||
        payload.notification?.body ||
        'Your study session needs attention.';

      console.log(
        'Foreground FCM message:',
        payload
      );

      if(Notification.permission === 'granted'){

        new Notification(title,{

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

        });

      }

    });

    setState(
      Notification.permission === 'granted' &&
      localStorage.getItem('upsc_push_enabled') === '1'
        ? 'enabled'
        : 'ready'
    );

  }catch(e){

    console.error(
      'Firebase push initialization failed:',
      e
    );

    window.StudyPush = {

      isEnabled:()=>false,

      isConfigured:()=>true,

      enable:async()=>{
        throw e;
      },

      syncProgress:async()=>{},

      ackSession:async()=>{}

    };

    setState('error');
  }

})();
