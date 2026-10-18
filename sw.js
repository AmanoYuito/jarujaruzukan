const CACHE = "yatsu-zukan-v18";
const ASSETS = ["./", "index.html", "styles.css?v=18", "app.js?v=18", "manifest.webmanifest", "data/catalog.json", "data/videos.json", "data/songs.json", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "robots.txt", "sitemap.xml"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("index.html"))));
});
