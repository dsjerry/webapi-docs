---
title: Web Worker Overview
description: What Web Worker is and why it enables true JavaScript "multithreading"
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+
All modern browsers support it, including mobile.
:::

## Overview

JavaScript is inherently single-threaded. UI updates, event loops, rendering — all挤在一条线程里. Run a heavy computation (big number factorial, image filters, JSON parsing) and the page freezes — the user clicks around with no response.

**Web Worker** is the solution: it lets you create an independent worker thread outside the main thread, dedicated to doing the heavy lifting while the main thread stays responsive. Workers and the main thread communicate via messages (`postMessage`), without blocking each other.

In short: want your page to stay smooth? Move the computation into a Worker.

## Quick Start

```js
// === main.js ===
const worker = new Worker('./worker.js');

// Listen for Worker messages
worker.onmessage = ({ data }) => {
  console.log('Worker says:', data);
  // => Worker says: Result: 3628800
};

// Send a heavy task to the Worker
worker.postMessage(10); // ask it to compute 10!
```

```js
// === worker.js ===
self.onmessage = (e) => {
  const n = e.data;
  // compute n! (factorial)
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  // send back to main thread
  self.postMessage(result);
};
```

This is the entire essence of Workers: main thread sends message → Worker processes → Worker sends result back.

## Core Concepts

### Why Workers?

| Scenario | Without Worker | With Worker |
|---------|----------------|-------------|
| Sorting 100k items | UI frozen 2-3s | Smooth, background computation |
| Grayscale image processing | Frame-by-frame stutter | Real-time preview, no lag |
| Parsing 10MB JSON | Page unresponsive | Completely invisible |
| WebSocket heartbeat | Blocked by computation | Always timely response |

### Worker Limitations

Workers and the main thread are **completely isolated contexts** (except via `postMessage`):

- No `document`, `window`, DOM in a Worker
- No `localStorage` in a Worker (but `fetch`, WebSocket, IndexedDB are available)
- Data **passed by copy** between Worker and main thread, not the same object reference

### Worker Types

| Type | How to Create | Scope |
|------|--------------|-------|
| Dedicated Worker | `new Worker()` | Owned by the creating main thread only |
| Shared Worker | `new SharedWorker()` | Shareable across same-origin pages/tabs |
| Service Worker | `navigator.serviceWorker.register()` | Proxies network requests, offline cache |
| Worklet | `CSS.paintWorklet.addModule()` | Custom painting during render phase |

## Notes

- **Worker code must be same-origin**: The path in `new Worker('./worker.js')` must be same-origin as the main page
- **Worker has independent GC**: Objects in the Worker won't trigger garbage collection in the main thread, but remember to `worker.terminate()` to close it
- **postMessage with large data has cost**: Large objects trigger structured clone; avoid frequently passing huge arrays
