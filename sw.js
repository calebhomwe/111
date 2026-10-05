// Michi service worker: the page works offline once opened.
//  - shell (page, icons, manifest): network first, cached copy when offline; replaced on every new build
//  - audio packs and images: cache first, kept until the audio version changes
const SHELL = 'michi-shell-d3ff361d46', MEDIA = 'michi-media-0b63d921e6';
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('michi-') && k !== SHELL && k !== MEDIA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.headers.has('range')) return; // let the browser stream ranged media itself
  const media = /\/(audio|img)\//.test(url.pathname);
  if (media) {
    e.respondWith(caches.open(MEDIA).then(async c => {
      const hit = await c.match(req, { ignoreSearch: false }); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
