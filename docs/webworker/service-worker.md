---
title: Service Worker vs Worker
description: 厘清三种 Worker 的边界，Service Worker 不是普通的 Web Worker
outline: [2, 3]
---

:::tip 浏览器支持
Dedicated Worker / SharedWorker: 几乎所有浏览器

Service Worker: Chrome 40+ · Firefox 44+ · Safari 11.1+ · Edge 79+

Worklet: Chrome 49+ / Safari 不完整支持
:::

## 概述

很多人把 Service Worker 和 Dedicated/Shared Worker 混为一谈，觉得都是"后台线程"。其实它们解决的问题完全不同：

- **Dedicated / Shared Worker**：帮主线程分担计算量，用 `postMessage` 通信
- **Service Worker**：充当浏览器和网络之间的代理，用事件驱动的 fetch 响应来拦截/缓存请求

Service Worker 不是 Worker 线程，它是**运行在浏览器注册域下的一个独立的生命周期**，它更像一个在后台运行的脚本，可以拦截网络请求、推送通知、管理缓存。

## 核心概念

### 一张表说清楚区别

| 特性 | Dedicated Worker | Shared Worker | Service Worker |
|------|-----------------|--------------|----------------|
| 创建方式 | `new Worker(url)` | `new SharedWorker(url, name)` | `navigator.serviceWorker.register(url)` |
| 线程模型 | 独立线程 | 独立线程（可跨 Tab 共享） | 独立线程（事件驱动） |
| DOM 访问 | 无 | 无 | 无 |
| 网络请求 | `fetch` | `fetch` | `fetch` + **拦截 fetch** |
| 缓存管理 | 无 | 无 | **Cache API / Cache Storage** |
| 推送通知 | 无 | 无 | **Push API / Notification API** |
| 生命周期 | `terminate()` / `close()` | `close()` | 安装 → 激活 → 废弃 |
| 离线能力 | 无 | 无 | **可实现离线应用** |
| 作用域 | 自身 | 同源 | **有路径作用域** |
| 通信方式 | `postMessage` | `postMessage`（经 port） | **事件（fetch、push、message）** |
| 用途 | 计算密集任务 | 跨 Tab 共享状态 | 网络代理、PWA 离线、推送 |

### Service Worker 生命周期

```
浏览器下载 sw.js
       ↓
  install（安装）事件 → 缓存静态资源
       ↓
  activate（激活）事件 → 清理旧缓存
       ↓
  idle（空闲待机） ←→ 处理 fetch / push / sync 事件
```

```js
// === sw.js ===

// 安装：缓存静态资源
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
  self.skipWaiting(); // 立即激活新版本
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== 'v1').map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // 让新 SW 立即控制已有页面
});

// 拦截网络请求：缓存优先，兜底网络
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // 缓存新的响应
        const clone = response.clone();
        caches.open('v1').then((cache) => cache.put(e.request, clone));
        return response;
      });
    })
  );
});
```

```js
// === 主线程注册 Service Worker ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('Service Worker 注册成功，作用域:', reg.scope);
  });
}
```

## 什么时候用哪个？

```
是否需要拦截网络请求？
  ├── 否 → 是否需要跨 Tab 共享状态？
  │         ├── 否 → Dedicated Worker
  │         └── 是 → Shared Worker（或 BroadcastChannel）
  └── 是 → Service Worker（PWA / 离线应用 / 推送）
```

## 注意事项

- **HTTPS 强制**：Service Worker 必须跑在 HTTPS 下（localhost 除外）
- **作用域限制**：Service Worker 的 `scope` 决定它能拦截哪些路径的请求；子路径会被覆盖，父路径不行
- **Service Worker 可以被浏览器同时存在多个版本**：旧版本会在所有页面都不再使用后被回收
- **Service Worker 里的 `self` 是 `ServiceWorkerGlobalScope`**：它有 `caches`、`fetch`、`clients` 等 Dedicated Worker 里没有的 API
- **Service Worker 退出后事件消失**：它只在有事件触发时才活着；空闲时会被浏览器挂起，这是设计意图，不是 bug
