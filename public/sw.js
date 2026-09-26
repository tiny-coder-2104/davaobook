/* DavaoBook Service Worker — v3
 *
 * RULE: navigations are network-only. Guest-facing availability, booking
 * status and capacity all come from the network — a cached page shell serves
 * stale data to guests, which is worse than having no offline support.
 * (v2 cache-first catch-all served a stale /track HTML that pinned the OLD
 * hashed chunk forever, and precached a 307 for "/" that broke "Back to
 * resort". Both were unrecoverable for the guest.)
 *
 * Only genuinely immutable, content-hashed build output is cached:
 *   /_next/static/*  → cache-first (the URL changes when the content does)
 *   /icons/*         → cache-first (static SVGs)
 * Everything else (/api, /admin, /auth, /p, /b, /track, /v, …) is left to the
 * browser default, which is network.
 *
 * Offline booking queue lives in the main app (IndexedDB via offline-queue.ts),
 * not in the SW. The SW only makes the app shell's static assets repeat-visits
 * instant.
 */

const CACHE_VERSION = "v3";
const SHELL_CACHE = `davaobook-shell-${CACHE_VERSION}`;

// Precache on install. No navigations here on purpose: "/" is a redirect to
// /seaclouds and precaching a redirect is what broke "Back to resort".
const SHELL_ASSETS = [
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
// Purge every cache that is not this version's (clears the broken v2 set).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin — browser default (network) handles them.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigations: network-only, always. See RULE at the top.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }

  // Immutable static build output + icons: safe to serve cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Everything else → no respondWith, i.e. the browser's own network path.
});

// ── Strategy: Cache-first (immutable URLs only) ──────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

// ── Listen for skip-waiting trigger from main thread ──────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
