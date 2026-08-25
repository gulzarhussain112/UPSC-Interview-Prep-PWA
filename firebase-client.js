(function(){
  const cfg=window.UPSC_FIREBASE_CONFIG||{};
  const configured=cfg.apiKey && cfg.projectId && cfg.appId &&
    cfg.vapidKey && !String(cfg.apiKey).startsWith('PASTE_') &&
    !String(cfg.vapidKey).startsWith('PASTE_');

  let messaging=null, db=null, user=null, token=null;

  function setState(t){window.dispatchEvent(new CustomEvent('study-push-state',{detail:t}));}

  if(!configured){
    window.StudyPush={
      isEnabled:()=>false,
      isConfigured:()=>false,
      enable:async()=>{throw new Error('Firebase is not configured yet. Add your Firebase web config and Web Push VAPID key to firebase-config.js.');},
      ackSession:async()=>{}
    };
    setState('not-configured');
    return;
  }

  try{
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    db=firebase.firestore();
    messaging=firebase.messaging();

    async function ensureUser(){
      if(user)return user;
      const r=await firebase.auth().signInAnonymously();
      user=r.user;
      return user;
    }

    async function saveToken(t){
      const u=await ensureUser();
      token=t;
      await db.collection('users').doc(u.uid).set({
        fcmToken:t,
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabled:true,
        notificationFrequencyMinutes:30,
        strictMode:true,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      localStorage.setItem('upsc_push_enabled','1');
      setState('enabled');
    }

    window.StudyPush={
      isEnabled:()=>!!token || localStorage.getItem('upsc_push_enabled')==='1',
      isConfigured:()=>true,

      enable:async()=>{
        if(!('Notification' in window))throw new Error('This browser does not support notifications.');
        if(!('serviceWorker' in navigator))throw new Error('This browser does not support service workers.');
        const perm=await Notification.requestPermission();
        if(perm!=='granted')throw new Error('Notification permission was not granted.');

        await ensureUser();

        // FCM needs its own messaging service worker at the site root.
        const reg=await navigator.serviceWorker.register('./firebase-messaging-sw.js',{scope:'./'});
        await navigator.serviceWorker.ready;

        const t=await messaging.getToken({
          vapidKey:cfg.vapidKey,
          serviceWorkerRegistration:reg
        });
        if(!t)throw new Error('Firebase did not return a notification token.');
        await saveToken(t);
        if(window.upscGetStatusMap) await window.StudyPush.syncProgress(window.upscGetStatusMap());
        return true;
      },

      syncProgress:async(statusMap)=>{
        try{
          const u=await ensureUser();
          await db.collection('users').doc(u.uid).set({
            status:statusMap||{},
            updatedAt:firebase.firestore.FieldValue.serverTimestamp()
          },{merge:true});
        }catch(e){console.warn('Could not sync progress',e);}
      },

      ackSession:async(s)=>{
        try{
          const u=await ensureUser();
          await db.collection('users').doc(u.uid).collection('sessions').doc(s.id).set({
            date:s.date,
            slot:s.slot,
            start:s.start,
            end:s.end,
            subject:s.e[1],
            topic:s.e[2],
            acknowledged:true,
            acknowledgedAt:firebase.firestore.FieldValue.serverTimestamp()
          },{merge:true});
        }catch(e){console.warn('Could not sync session acknowledgement',e);}
      },

      disable:async()=>{
        try{
          const u=await ensureUser();
          await db.collection('users').doc(u.uid).set({enabled:false},{merge:true});
        }finally{
          localStorage.removeItem('upsc_push_enabled');
          token=null;
          setState('disabled');
        }
      }
    };

    firebase.auth().onAuthStateChanged(u=>{if(u)user=u;});

    messaging.onMessage(payload=>{
      const title=payload.data?.title || payload.notification?.title || 'UPSC Study Reminder';
      const body=payload.data?.body || payload.notification?.body || 'Your study session needs attention.';
      // Foreground: show a browser notification only when permission exists.
      if(Notification.permission==='granted'){
        new Notification(title,{
          body,
          icon:'./assets/icons/icon-192.png',
          badge:'./assets/icons/icon-192.png',
          tag:payload.data?.sessionId||'upsc-study',
          renotify:true,
          data:{url:'./index.html'}
        });
      }
    });

    setState(Notification.permission==='granted' && localStorage.getItem('upsc_push_enabled')==='1'?'enabled':'ready');
  }catch(e){
    console.warn('Firebase push initialization failed',e);
    window.StudyPush={
      isEnabled:()=>false,
      isConfigured:()=>true,
      enable:async()=>{throw e;},
      ackSession:async()=>{}
    };
    setState('error');
  }
})();