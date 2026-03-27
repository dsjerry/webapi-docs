---
title: Service Worker vs Worker
description: Clarifying the boundaries between three types of Workers; Service Worker is not a regular Web Worker
outline: [2, 3]
---

:::tip Browser Support
Dedicated Worker / SharedWorker: virtually all browsers

Service Worker: Chrome 40+ · Firefox 44+ · Safari 11.1+ · Edge 79+

Worklet: Chrome 49+ / Safari incomplete support
:::

## Overview

Many people conflate Service Worker with Dedicated/Shared Workers, thinking they're all "background threads." Actually, they solve completely different problems:

- **Dedicated / Shared Worker**: Offloads computation from the main thread, communicates via `postMessage`
- **Service Worker**: Acts as a proxy between the browser and the network, responding to intercepted/fetched requests via event-driven mechanisms

A Service Worker is not a Worker thread — it's an independent lifecycle registered in the browser domain. It's more like a script running in the background that can intercept network requests, push notifications, and manage caches.

## Core Concepts

### Comparison Table

| Feature | Dedicated Worker | Shared Worker | Service Worker |
|---------|-----------------|--------------|----------------|
| Creation | `new Worker(url)` | `new SharedWorker(url, name)` | `navigator.serviceWorker.register(url)` |
| Thread model | Independent thread | Independent thread (cross-tab) | Independent thread (event-driven) |
| DOM access | None | None | None |
| Network requests | `fetch` | `fetch` | `fetch` + **intercept fetch** |
| Cache management | None | None | **Cache API / Cache Storage** |
| Push notifications | None | None | **Push API / Notification API** |
| Lifecycle | `terminate()` / `close()` | `close()` | install → activate → obsolete |
| Offline capability | None | None | **Can implement offline apps** |
| Scope | self | same-origin | **has path scope** |
| Communication | `postMessage` | `postMessage` (via port) | **events (fetch, push, message)** |
| Use case | Computation-intensive tasks | Cross-tab shared state | Network proxy, PWA offline, push |

### Service Worker Lifecycle

```
Browser downloads sw.js
       ↓
  install event → cache static assets
       ↓
  activate event → clean old caches
       ↓
  idle (waiting) ←→ handle fetch / push / sync events
```

```js
// === sw.js ===

// Install: cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/app.js',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== 'v1').map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Intercept network requests: cache-first, fallback to network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        const clone = response.clone();
        caches.open('v1').then((cache) => cache.put(e.request, clone));
        return response;
      });
    })
  );
});
```

```js
// === Main thread registers Service Worker ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('Service Worker registered, scope:', reg.scope);
  });
}
```

## When to Use Which?

```
Need to intercept network requests?
  ├── No → Need cross-tab shared state?
  │         ├── No → Dedicated Worker
  │         └── Yes → Shared Worker (or BroadcastChannel)
  └── Yes → Service Worker (PWA / offline / push)
```

## Notes

- **HTTPS required**: Service Worker must run under HTTPS (localhost is exempt)
- **Scope restriction**: The Service Worker's `scope` determines which path requests it can intercept; sub-paths are covered, parent paths are not
- **Multiple versions can coexist**: Old versions are garbage collected after all pages stop using them
- **`self` in Service Worker is `ServiceWorkerGlobalScope`**: It has `caches`, `fetch`, `clients` etc. not available in Dedicated Workers
- **Service Workers are event-driven**: It only lives when an event is triggered; idle instances are suspended by the browser — this is by design, not a bug
