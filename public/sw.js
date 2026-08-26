/* DavaoBook Service Worker — v1
 *
 * Strategies per spec §9:
 *   App shell / static assets → cache-first, versioned precache
 *   Package pages / images    → stale-while-revalidate
 *   /api/*                   → network-only (never serve stale)
 *   /v/[code] (voucher)      → network-first with cached fallback banner
 *
 * Offline booking queue lives in the main app (IndexedDB via offline-queue.ts),
 * not in the SW. SW just enables offline page loads.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `davaobook-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `davaobook-pages-${CACHE_VERSION}`;
const VOUCHER_CACHE = `davaobook-vouchers-${CACHE_VERSION}`;

// Precache app shell on install
const SHELL_ASSETS = [
  "/",
  "/globals.css",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== PAGE_CACHE && k !== VOUCHER_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // /api/* → network-only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // /v/* (voucher/status) → network-first with cached fallback
  if (url.pathname.startsWith("/v/")) {
    event.respondWith(networkFirstWithBanner(request, VOUCHER_CACHE));
    return;
  }

  // Package pages (/p/*) and images → stale-while-revalidate
  if (
    url.pathname.startsWith("/p/") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
  ) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Everything else (shell) → cache-first
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// ── Strategy: Cache-first ────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached → navigation fallback
    if (request.mode === "navigate") {
      return caches.match("/") || new Response("Offline", { status: 503 });
    }
    return new Response("Offline", { status: 503 });
  }
}

// ── Strategy: Stale-while-revalidate ─────────────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached); // network failed → serve stale

  return cached || fetchPromise;
}

// ── Strategy: Network-first with "saved copy" banner ─────────────────
async function networkFirstWithBanner(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      // Inject offline banner via client message
      notifyClientsOfOfflineCopy();
      return cached;
    }
    return new Response("Offline — no saved copy available", { status: 503 });
  }
}

function notifyClientsOfOfflineCopy() {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: "OFFLINE_COPY_SHOWN" });
    });
  });
}

// ── Listen for skip-waiting trigger from main thread ──────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
