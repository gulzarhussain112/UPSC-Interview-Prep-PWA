const CACHE='upsc-prep-v8';const ASSETS=[
 "./",
 "./index.html",
 "./style.css",
 "./data.js",
 "./app.js",
 "./manifest.json",
 "./assets/icons/icon-192.png",
 "./assets/icons/icon-512.png",
 "./assets/screenshots/desktop-wide.png",
 "./assets/screenshots/mobile.png"
];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request))));
