'use strict';

const CACHE_PREFIX = 'donghuabatch-pwa';
const CACHE_VERSION = '2026-08-22-2';
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;

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
  '/index.json',
  '/offline/',
  '/manifest.webmanifest',
  '/icons/icon-192.webp',
  '/icons/icon-512.webp',
  '/icons/apple-touch-icon.png',
  '/img/favicon.webp',
  '/img/DonghuaBatch.webp',
  '/img/Huo-Linger.webp'
];

const DISCOVERABLE_ASSET = /\.(?:css|js|woff2?|ico|png|webp)$/i;
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
  const referencePattern = /(?:src|href)=["']([^"'#]+)["']/gi;
  let match;
  while ((match = referencePattern.exec(html))) {
    try {
      const assetUrl = new URL(match[1], documentUrl);
      if (sameOrigin(assetUrl) && DISCOVERABLE_ASSET.test(assetUrl.pathname)) {
        output.add(assetUrl.href);
      }
    } catch {
      // Abaikan URL yang tidak valid dalam markup pihak ketiga.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shellCache = await caches.open(SHELL_CACHE);
    const discoveredAssets = new Set();

    await Promise.allSettled(APP_SHELL.map(async (path) => {
      const request = new Request(path, { cache: 'reload' });
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
      const request = new Request(url, { cache: 'reload' });
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
    await Promise.all(cacheNames.map((cacheName) => {
      if (cacheName.startsWith(CACHE_PREFIX) && !activeCaches.has(cacheName)) {
        return caches.delete(cacheName);
      }
      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

async function handleNavigation(request) {
  const cacheKey = navigationCacheKey(request);
  try {
    const response = await fetchWithTimeout(request, 4500);
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
