const CACHE='speed-fact-v1-1.0.0';
const CORE=['./','./index.html','./src/styles.css','./src/app.js','./manifest.webmanifest','./assets/icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET')return;
  if(u.pathname.endsWith('/version.json')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/src/app.js')||u.pathname.endsWith('/src/styles.css')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));return;
  }
  if(u.pathname.endsWith('/products-authorized.js')){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));
});
