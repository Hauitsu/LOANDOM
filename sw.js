/* LOANDOM service worker.
 *
 * Cache-first: the shell and every module are precached, so a launch costs a
 * cache read instead of a round trip (and works with no network at all).
 * Freshness is separate: a navigation still refetches the HTML in the
 * background and only tells the client when the body actually changed.
 *
 * Bump VERSION on every deploy. The cache name is the version, so the browser
 * installs the new file set next to the old one and swaps on activate.
 */
const VERSION = 'loandom-2026-11-20-1';
const CACHE = VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './README.md',
  './SETUP.md',
  './assets/favicon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/css/app.css',
  './assets/js/api.js',
  './assets/js/app.js',
  './assets/js/classbadge.js',
  './assets/js/classes.js',
  './assets/js/classpicker.js',
  './assets/js/icons.js',
  './assets/js/image.js',
  './assets/js/model.js',
  './assets/js/portraits.js',
  './assets/js/seed.js',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/util.js',
  './assets/js/views/board.js',
  './assets/js/views/ledger.js',
  './assets/js/views/roster.js',
  './assets/js/views/settings.js',
  './assets/js/views/summary.js',
  './assets/classes/aeromancer.svg',
  './assets/classes/arcanist.svg',
  './assets/classes/artillerist.svg',
  './assets/classes/artist.svg',
  './assets/classes/bard.svg',
  './assets/classes/berserker.svg',
  './assets/classes/breaker.svg',
  './assets/classes/deadeye.svg',
  './assets/classes/deathblade.svg',
  './assets/classes/destroyer.svg',
  './assets/classes/dimensionalist.svg',
  './assets/classes/glaivier.svg',
  './assets/classes/guardianknight.svg',
  './assets/classes/gunlancer.svg',
  './assets/classes/gunslinger.svg',
  './assets/classes/machinist.svg',
  './assets/classes/paladin.svg',
  './assets/classes/reaper.svg',
  './assets/classes/scrapper.svg',
  './assets/classes/shadowhunter.svg',
  './assets/classes/sharpshooter.svg',
  './assets/classes/slayer.svg',
  './assets/classes/sorceress.svg',
  './assets/classes/souleater.svg',
  './assets/classes/soulfist.svg',
  './assets/classes/striker.svg',
  './assets/classes/summoner.svg',
  './assets/classes/valkyrie.svg',
  './assets/classes/wardancer.svg',
  './assets/classes/wildsoul.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // One missing file must not fail the whole install; the list is checked
      // by the boot test, not by silently breaking the worker.
      await Promise.all(
        SHELL.map(async (path) => {
          try {
            const response = await fetch(new Request(path, { cache: 'reload' }));
            if (response.ok) await cache.put(path, response);
          } catch (error) {
            /* leave it to the runtime cache */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'version') {
    event.source?.postMessage({ type: 'version', version: VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Portraits live on Google Drive: never cached, never intercepted.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request, event));
    return;
  }
  event.respondWith(asset(request));
});

async function navigation(request, event) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match('./index.html')) || (await cache.match('./'));
  if (!cached) {
    try {
      return await fetch(request);
    } catch (error) {
      return new Response(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0c11;color:#e9edf6;font:14px system-ui"><p>LOANDOM needs one online visit to install itself.</p></body>',
        { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }
  }
  // The body is locked once the response is returned, so read it now.
  const servedBody = cached.clone().text();
  event.waitUntil(refreshShell(request, servedBody));
  return cached;
}

/** Compare the shell we served with the one on the network; tell the client only on a real change. */
async function refreshShell(request, servedBodyPromise) {
  try {
    const response = await fetch(new Request(request.url, { cache: 'no-store' }));
    if (!response.ok) return;
    const fresh = await response.clone().text();
    const served = await servedBodyPromise;
    if (fresh === served) return;
    const cache = await caches.open(CACHE);
    await cache.put('./index.html', response.clone());
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage({ type: 'shell-updated' }));
  } catch (error) {
    /* offline: the cached shell is the answer */
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
