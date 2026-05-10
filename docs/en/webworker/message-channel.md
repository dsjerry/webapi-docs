---
title: MessageChannel
description: Create a private communication pipe so two Workers can talk directly, bypassing the main thread
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 41+ · Safari 10+ · Edge 12+
MessageChannel works in main thread, Workers, and ServiceWorkers.
:::

## Overview

`MessageChannel` lets you establish a **private, direct** communication pipe between two contexts without going through the Worker's main script.

Typical scenario: the main thread manages two Workers, but these two Workers need to directly exchange large amounts of data. If routed through the main thread, all data passes in and out of the main thread, resulting in unnecessary copying. With MessageChannel, the two Workers can talk directly — the main thread only sets up the connection.

## Quick Start

```js
// === main.js ===
// Create a private pipe
const channel = new MessageChannel();

// Get the two ports (port1 and port2)
const port1 = channel.port1;
const port2 = channel.port2;

// Send port2 to Worker B
const workerB = new Worker('./worker-b.js');
workerB.postMessage({ type: 'PORT', port: port2 }, [port2]);

// Main thread keeps port1
port1.onmessage = (e) => console.log('A says:', e.data);
// => A says: Hello B! I'm A!

port1.start();
```

```js
// === worker-a.js ===
let port1;

self.onmessage = (e) => {
  if (e.data.type === 'SET_PORT') {
    port1 = e.data.port;
    port1.start();
    port1.postMessage('Hello B! I\'m A!');
  }
};
```

This example omits how B gets the port — in practice, the main thread typically forwards ports to both Workers.

## Core Concepts

### The Two Ports of MessageChannel

`new MessageChannel()` returns a `{ port1, port2 }` object. The rules are simple:

- `port1` sends → `port2` receives
- `port2` sends → `port1` receives
- When one end closes, the other receives `onmessageerror`

```
  port1  ──────────────────────────  port2
  send()  ────── data ─────────>  onmessage
  onmessage  <───── data ───────  send()
```

### Transferable

MessageChannel supports **Transferable** just like `postMessage`:

```js
const channel = new MessageChannel();
const buffer = new ArrayBuffer(1024);

// Transfer buffer ownership
channel.port1.postMessage(buffer, [buffer]);

// Now only port2 can access this buffer
// port1 no longer can
```

### Difference from BroadcastChannel

| Feature | MessageChannel | BroadcastChannel |
|---------|----------------|------------------|
| Communication target | Two specific ports | All same-origin tabs + Workers |
| Needs relay | Ports need manual distribution | No relay, natural broadcast |
| Direction | Full-duplex, direct | Full-duplex, broadcast |
| Compatibility | Better (IE10+) | Safari 15.4+ only |

## API Reference

### MessageChannel Constructor

```js
// Create a new pipe (both ends inactive)
const channel = new MessageChannel();

// port1 and port2 start in "pending" state
// Must call .start() to activate
channel.port1.start();
channel.port2.start();
```

### Closing Ports

```js
// Closing one end triggers onmessageerror on the other
channel.port1.close();
```

## Practical Example

Worker pool using MessageChannel for Workers to communicate directly:

```js
// === worker-pool.js (main thread manager) ===
class WorkerPool {
  constructor(path, size) {
    this.path = path;
    this.idle = [];
    this.busy = [];
    this.channelMap = new Map();

    for (let i = 0; i < size; i++) {
      const w = new Worker(path);
      const ch = new MessageChannel();
      w.postMessage({ type: 'SET_PORT', port: ch.port2 }, [ch.port2]);
      ch.port1.start();
      this.idle.push({ worker: w, port: ch.port1 });
      this.channelMap.set(i, ch);
    }
  }

  async run(task) {
    const { worker, port } = this.idle.shift();
    this.busy.push({ worker, port });

    return new Promise((resolve) => {
      port.onmessage = (e) => {
        resolve(e.data);
        this.busy = this.busy.filter(b => b.port !== port);
        this.idle.push({ worker, port });
      };
      port.postMessage(task);
    });
  }

  destroy() {
    [...this.idle, ...this.busy].forEach(({ worker }) => worker.terminate());
  }
}

const pool = new WorkerPool('./compute-worker.js', 4);
const result = await pool.run({ data: bigArray });
pool.destroy();
```

## Notes

- **Ports must `.start()`**: Even with `onmessage` bound, some browsers require explicitly calling `.start()` to activate the port
- **Don't bind both `onmessage` and `addEventListener('message')` on the same port**: Messages will be processed twice
- **Ownership is transferred when port is moved**: If `port2` is passed as a transferable in `postMessage`, the original thread loses access
