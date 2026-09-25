/*
 * Service worker da Locamania — o mínimo para a PWA ser instalável e abrir
 * sem internet mostrando o aviso, em vez da tela de erro do navegador (§35).
 *
 * De propósito NÃO guarda respostas da API: dado financeiro velho na tela é
 * pior que tela nenhuma. Guarda só a página offline e os ícones.
 */
const CACHE = 'locamania-shell-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Só navegação (abrir uma página). Chamadas à API e assets seguem direto.
  if (request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res || Response.error())),
  );
});
