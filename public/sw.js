const CACHE_NAME = "vozzera-shell-v1";
const SHELL_URL = "/";
const MAX_CACHED_ASSETS = 200;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(removeOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request, url));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirstAsset(request));
  }
});

async function removeOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
}

function isShellRequest(url) {
  return url.pathname === SHELL_URL && url.search === "";
}

async function networkFirstNavigation(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && isShellRequest(url)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL_URL);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (!response.ok) return response;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  await trimAssets(cache);
  return response;
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((key) => new URL(key.url).pathname.startsWith("/assets/"));
  const excess = assets.length - MAX_CACHED_ASSETS;
  await Promise.all(assets.slice(0, Math.max(excess, 0)).map((key) => cache.delete(key)));
}
