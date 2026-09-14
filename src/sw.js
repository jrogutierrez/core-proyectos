/* Service Worker v5 — Ficha SOS Brigadista */
const CACHE_NAME = 'ficha-sos-v5';
const urlsToCache = ['./index.html', './script.js', './style.css'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Solo servir recursos del mismo origen
  if (url.origin !== location.origin) return;
  
  // No cachear rutas con datos médicos
  if (url.pathname.includes('medical') || url.pathname.includes('notes')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  
  // Cachear archivos locales estáticos
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
