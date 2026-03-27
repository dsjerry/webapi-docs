---
title: Worker Basic Usage
description: Creating Workers, postMessage communication, terminate — complete lifecycle
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+
:::

## Overview

Dedicated Worker is the most commonly used Worker type. It's simple to create, communicates directly, and closes cleanly. Master these four APIs: `new Worker()`, `postMessage`, `onmessage`, `terminate()` — and you've learned Workers.

## Quick Start

```js
// === main.js ===
const worker = new Worker('./worker.js');

worker.onmessage = (e) => {
  console.log('Worker says:', e.data);
};

worker.postMessage(42);
```

```js
// === worker.js ===
self.onmessage = (e) => {
  const num = e.data;
  self.postMessage(`Received ${num}`);
};
```

## Core Concepts

### Creating a Worker

```js
// Method 1: external script file
const worker = new Worker('./worker.js');

// Method 2: inline Worker (no extra file needed)
const blob = new Blob([`
  self.onmessage = (e) => self.postMessage(e.data * 2);
`], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
```

:::tip
Inline Workers save a network request, good for short utility functions. If Worker code exceeds 30 lines, put it in a separate file for better maintainability.
:::

### postMessage Bidirectional Communication

Messages between the main thread and Worker are **full-duplex** — both sides can `postMessage` anytime, both receive via `onmessage`:

```js
// Main thread → Worker
worker.postMessage({ type: 'START', payload: 123 });

// Worker → Main thread
self.postMessage({ type: 'RESULT', payload: 246 });
```

Binary data (ArrayBuffer, Blob) can also be passed:

```js
// Send an ArrayBuffer to the Worker for processing
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage(buffer, [buffer]); // transfer ownership, no copy

// Worker processes and sends it back
self.postMessage(buffer, [buffer]);
```

:::warning Ownership Transfer
The second argument `[buffer]` means **transfer ownership** (transferable). After transfer, the main thread can no longer access that buffer — only the Worker can. This avoids the performance cost of copying large data.
:::

### onmessage vs addEventListener

These two写法完全等价:

```js
// Method 1: onmessage (concise)
worker.onmessage = (e) => { /* ... */ };

// Method 2: addEventListener (can bind multiple listeners)
worker.addEventListener('message', (e) => { /* ... */ });
worker.addEventListener('message', (e) => { /* another listener */ });
```

### terminate and close

```js
// Main thread forcefully closes Worker
worker.terminate();
// worker instance is dead, cannot postMessage

// Worker closes itself
self.close();
```

:::danger terminate vs close
- `worker.terminate()`: Main thread closes it, immediately terminates the Worker regardless of what it's doing
- `self.close()`: Worker calls it itself; exits after the current task finishes
:::

### Worker Error Handling

```js
worker.onerror = (e) => {
  console.error('Worker error!');
  console.error('Filename:', e.filename);
  console.error('Line number:', e.lineno);
  console.error('Message:', e.message);
};
```

## Practical Example

Moving a large array sort from the main thread to a Worker:

```js
// === main.js ===
const worker = new Worker('./sort-worker.js');

sortBtn.onclick = async () => {
  const arr = Array.from({ length: 500_000 }, () => Math.random());

  worker.postMessage({ array: arr, order: 'asc' });

  worker.onmessage = ({ data }) => {
    console.log('Sort complete, zero stutter!');
    renderChart(data);
  };
};

window.addEventListener('beforeunload', () => worker.terminate());
```

```js
// === sort-worker.js ===
self.onmessage = ({ data }) => {
  const { array, order } = data;

  const sorted = array.sort((a, b) =>
    order === 'desc' ? b - a : a - b
  );

  self.postMessage(sorted);
};
```

## Notes

- **`this === self` in Worker thread**: `this.postMessage` and `self.postMessage` are completely equivalent; prefer `self` to avoid ambiguity
- **Cannot access `window`**: But can use `importScripts()` to load same-origin scripts
- **`importScripts` is synchronous**: Execution continues only after loading completes; no cross-origin support
- **Worker's `console.log`** prints in the browser's **Worker console** (DevTools → Source → Workers panel), not the main page console
