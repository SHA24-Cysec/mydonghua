'use strict';

const CACHE_PREFIX = 'donghuabatch-pwa';
const CACHE_VERSION = '2026-10-26-2';
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `${CACHE_PREFIX}-pages`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images`;

const LEGACY_RUNTIME_CACHES = {
  '-pages-': { target: PAGE_CACHE, maximumEntries: 80 },
  '-assets-': { target: ASSET_CACHE, maximumEntries: 100 },
  '-images-': { target: IMAGE_CACHE, maximumEntries: 160 }
};

const CATALOG_DOCUMENTS = [
  '/',
  '/page/2/',
  '/page/3/'
];

const APP_SHELL = [
  ...CATALOG_DOCUMENTS,
  '/search/',
  '/favorit/',
  '/filter-genre/',
  '/offline/',
  '/manifest.webmanifest',
  '/icons/icon-192.webp',
  '/img/favicon.webp',
  '/img/Huo-Linger.webp'
];

const DISCOVERABLE_ASSET = /\.(?:css|js|mjs|woff2?)$/i;
const CACHEABLE_ASSET = /\.(?:css|js|mjs|woff2?|ico|png|webp|jpe?g|svg)$/i;

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function navigationCacheKey(request) {
  const url = new URL(request.url);
  return new Request(`${url.origin}${url.pathname}`, {
    method: 'GET',
    headers: { Accept: 'text/html' }
  });
}

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const overflow = keys.length - maximumEntries;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function migrateCache(sourceName, targetName, maximumEntries) {
  const source = await caches.open(sourceName);
  const target = await caches.open(targetName);
  const entries = await source.keys();
  for (const request of entries) {
    try {
      if (await target.match(request)) continue;
      const response = await source.match(request);
      if (response) await target.put(request, response);
    } catch {}
  }
  await trimCache(targetName, maximumEntries);
}

async function putResponse(cacheName, request, response, maximumEntries) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  if (maximumEntries) await trimCache(cacheName, maximumEntries);
}

async function fetchWithTimeout(request, timeoutMilliseconds) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function collectDocumentAssets(documentUrl, html, output) {
  const referencePattern = /(?:src|href)\s*=\s*(?:"([^"#]+)"|'([^'#]+)'|([^\s>]+))/gi;
  let match;
  while ((match = referencePattern.exec(html))) {
    const reference = match[1] || match[2] || match[3] || '';
    if (!reference) continue;
    try {
      const assetUrl = new URL(reference, documentUrl);
      if (sameOrigin(assetUrl) && DISCOVERABLE_ASSET.test(assetUrl.pathname)) {
        output.add(assetUrl.href);
      }
    } catch {}
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shellCache = await caches.open(SHELL_CACHE);
    const discoveredAssets = new Set();

    await Promise.allSettled(APP_SHELL.map(async (path) => {
      const request = new Request(path);
      const response = await fetch(request);
      if (!response.ok) return;
      await shellCache.put(request, response.clone());

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await response.clone().text();
        collectDocumentAssets(new URL(path, self.location.origin), html, discoveredAssets);
      }
    }));

    await Promise.allSettled(Array.from(discoveredAssets).map(async (url) => {
      const request = new Request(url);
      const response = await fetch(request);
      if (response.ok) await shellCache.put(request, response);
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const activeCaches = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, IMAGE_CACHE]);
    const cacheNames = await caches.keys();
    let legacyShellFound = false;

    for (const cacheName of cacheNames) {
      if (!cacheName.startsWith(CACHE_PREFIX)) continue;
      if (activeCaches.has(cacheName)) continue;

      if (cacheName.includes('-shell-')) {
        legacyShellFound = true;
      }

      for (const [prefix, migration] of Object.entries(LEGACY_RUNTIME_CACHES)) {
        if (!cacheName.includes(prefix)) continue;
        await migrateCache(cacheName, migration.target, migration.maximumEntries);
        break;
      }

      await caches.delete(cacheName);
    }

    if (legacyShellFound) {
      await caches.delete(PAGE_CACHE);
      await caches.delete(ASSET_CACHE);
      await caches.delete(IMAGE_CACHE);
    }

    await self.clients.claim();
  })());
});

async function handleNavigation(request) {
  const cacheKey = navigationCacheKey(request);
  try {
    const response = await fetchWithTimeout(request, 8000);
    await putResponse(PAGE_CACHE, cacheKey, response, 80);
    return response;
  } catch {
    return (await caches.match(cacheKey))
      || (await caches.match(request))
      || (await caches.match('/offline/'))
      || Response.error();
  }
}

async function cacheFirst(request, cacheName, maximumEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await putResponse(cacheName, request, response, maximumEntries);
  return response;
}

async function staleWhileRevalidate(request, cacheName, maximumEntries, event) {
  const cached = await caches.match(request);
  const networkResponse = fetch(request)
    .then(async (response) => {
      await putResponse(cacheName, request, response, maximumEntries);
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkResponse);
    return cached;
  }

  return (await networkResponse) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname === '/index.json') {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, 0, event));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, 160, event));
    return;
  }

  if (CACHEABLE_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, 100));
  }
});
