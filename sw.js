/* Static PWA cache for GitHub Pages; network-first keeps redeployed cards fresh. */
const CACHE='law175-3themes-v4';
const CORE=['./','./index.html','./styles.css','./themes.css','./topics.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',evt=>evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',evt=>evt.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('law175-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',evt=>{
  const req=evt.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  evt.respondWith((async()=>{
    try{
      const response=await fetch(req);
      if(response.ok){const cache=await caches.open(CACHE);cache.put(req,response.clone()).catch(()=>{});}
      return response;
    }catch(e){
      const cached=await caches.match(req,{ignoreSearch:true});
      if(cached)return cached;
      if(req.mode==='navigate'){const page=await caches.match('./index.html');if(page)return page;}
      return Response.error();
    }
  })());
});
