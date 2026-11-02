const CACHE = "night-run-v4";
const FILES = [
  "./getaway.html",
  "./getaway.webmanifest",
  "./css/getaway.css",
  "./js/getaway.js",
  "./css/fonts.css",
  "./fonts/saira-condensed-400-latin.woff2",
  "./fonts/saira-condensed-700-latin.woff2",
  "./fonts/saira-stencil-one-400-latin.woff2",
  "./assets/getaway-icon-192.png",
  "./assets/getaway-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
