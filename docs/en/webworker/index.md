---
title: Web Worker
description: Browser background thread module
---

# Web Worker

Offload heavy computation from the main thread. Keep the UI responsive while running complex logic in the background.

## Module Contents

- [Overview](./overview) — What is a Worker, and why do you need one
- [Basic Usage](./basic) — Creating, postMessage, terminate
- [Dedicated vs Shared](./dedicated-vs-shared) — Choosing between Dedicated / Shared Worker
- [MessageChannel](./message-channel) — Direct communication between two Workers
- [Service Worker](./service-worker) — Network proxy and offline caching
- [Practical: Offloading Computation](./practical) — Fibonacci + large array sorting in a Worker
