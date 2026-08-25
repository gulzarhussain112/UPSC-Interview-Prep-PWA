/* Firebase Cloud Messaging service worker.
 * IMPORTANT: replace the placeholder values below with the SAME Firebase Web App config
 * used in firebase-config.js before deploying.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAiyANqQh7Lqs80oOuavU93nvEY2diaGag",
  authDomain: "interview-prep-upsc.firebaseapp.com",
  projectId: "interview-prep-upsc",
  storageBucket: "interview-prep-upsc.firebasestorage.app",
  messagingSenderId: "632920971695",
  appId: "1:632920971695:web:1d3c90a1484fbe1c95b75a"
});

const messaging=firebase.messaging();

messaging.onBackgroundMessage(payload=>{
  const title=payload.data?.title || payload.notification?.title || 'UPSC Study Reminder';
  const body=payload.data?.body || payload.notification?.body || 'Your scheduled study session needs attention.';
  self.registration.showNotification(title,{
    body,
    icon:'./assets/icons/icon-192.png',
    badge:'./assets/icons/icon-192.png',
    tag:payload.data?.sessionId || 'upsc-study',
    renotify:true,
    data:{url:payload.data?.url || './index.html'}
  });
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      const target=new URL(event.notification.data?.url || './index.html',self.location.origin).href;
      for(const c of list){
        if(c.url===target && 'focus' in c)return c.focus();
      }
      for(const c of list){
        if('focus' in c)return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});