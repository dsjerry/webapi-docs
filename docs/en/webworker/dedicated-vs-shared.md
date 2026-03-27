---
title: Dedicated Worker vs Shared Worker
description: When to use Dedicated Worker and when to use SharedWorker
outline: [2, 3]
---

:::tip Browser Support
Dedicated Worker: Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+

SharedWorker: Chrome 4+ · Firefox 29+ · Safari 15.2+ · Edge 79+

**Note**: Safari's SharedWorker support is relatively recent; full support on mobile Safari from 15.2+.
:::

## Overview

A **Dedicated Worker** is owned exclusively by the main thread that created it — close that tab and it dies. A **Shared Worker** can be shared across multiple pages, tabs, and Worker instances of the same origin — initialized once, reused everywhere.

Which to choose? Need to share state or resources across tabs? Use SharedWorker. Only running computation within one page? Use Dedicated Worker.

## Quick Start

```js
// === SharedWorker (server entry) ===
const connections = new Set();

self.onconnect = (e) => {
  const port = e.ports[0];
  connections.add(port);

  port.onmessage = (e) => {
    console.log('Received:', e.data);
    // broadcast to all connections
    connections.forEach(p => p.postMessage(e.data));
  };

  port.start();
};
```

```js
// === main.js (any tab) ===
const worker = new SharedWorker('./shared-worker.js', 'my-shared-worker');

worker.port.onmessage = (e) => {
  console.log('Received broadcast:', e.data);
};

worker.port.start();
worker.port.postMessage('hello from tab 1');
```

## Core Concepts

### Dedicated Worker Lifecycle

```
Main thread Tab A ── new Worker('w.js') ──→ Worker Process A (exclusive)
                                          │
Tab A closed ──────────────────────────────→ Worker A destroyed
```

Every `new Worker()` creates an **independent** process — they don't interfere with each other.

### SharedWorker Lifecycle

```
Tab A ── new SharedWorker('w.js') ──┐
                                     ├──→ Same Worker Process (shared)
Tab B ── new SharedWorker('w.js') ──┘
                                     │
Tab A closed ─────────────────────────┤ (Worker still alive)
Tab B closed ─────────────────────────┘ Worker destroyed when all connections close
```

All connections pointing to the same SharedWorker share one process. The Worker is only destroyed when all tabs are closed.

### When to Use Dedicated Worker?

- Background computation (sorting, compression, encryption)
- Audio/video encoding
- Large JSON parsing
- Periodic polling (WebSocket heartbeat, server streaming)

### When to Use SharedWorker?

- **Cross-tab data sharing**: e.g., user logs in on one tab, another tab automatically syncs login state
- **Cross-tab connection sharing**: one WebSocket connection, multiple tabs use it together, avoid duplicate connections
- **Counter/status broadcasting**: global event bus

### Connection Ports

Communication in SharedWorker is port-based. Each `new SharedWorker()` gets a `MessagePort` for communicating with the SharedWorker:

```js
// Main thread: get port
const sw = new SharedWorker('./shared.js', 'name');
sw.port.start();
sw.port.postMessage('hi');

// Inside SharedWorker: get port via onconnect
self.onconnect = (e) => {
  const port = e.ports[0];
  port.onmessage = (e) => { /* ... */ };
  port.start();
  port.postMessage('reply');
};
```

## Notes

- **The `name` parameter of SharedWorker matters**: Same name points to the same Worker instance; different names create different Workers.
- **Safari compatibility**: If you need to support Safari below 15.2, don't use SharedWorker, or prepare a fallback (BroadcastChannel).
- **BroadcastChannel is a lighter alternative**: If you only need cross-tab communication without keeping a long-lived connection, the `BroadcastChannel` API is simpler and Safari supported it earlier (Safari 15.4+).
- **SharedWorker ports must `.start()`**: Some browsers require explicitly calling `port.start()` to activate the port.
