const CACHE = "ftl-logbook-v1.9.4";
const SCOPE = self.registration.scope;
const url = path => new URL(path, SCOPE).toString();

const CRITICAL_ASSETS = [
  url("./"),
  url("index.html"),
  url("styles.css"),
  url("app.js"),
  url("manifest.webmanifest"),
  url("icon.svg")
];

const DATA_ASSETS = [
  url("airports.json"),
  url("app-version.json")
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Critical shell must be present for the app to start offline.
    await cache.addAll(CRITICAL_ASSETS);

    // Cache large/optional data files independently so one failed request
    // does not invalidate the complete service-worker installation.
    await Promise.allSettled(
      DATA_ASSETS.map(async asset => {
        const response = await fetch(asset, { cache: "reload" });
        if (!response.ok) throw new Error(`Could not cache ${asset}`);
        await cache.put(asset, response);
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallbackUrl ? await cache.match(fallbackUrl) : undefined);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("Offline resource unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);

  // Only manage files inside this GitHub Pages app scope.
  if (!requestUrl.href.startsWith(SCOPE)) return;

  if (requestUrl.pathname.endsWith("/app-version.json")) {
    event.respondWith(networkFirst(request, url("app-version.json")));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, url("index.html")));
    return;
  }

  event.respondWith(cacheFirst(request));
});