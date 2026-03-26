---
title: 专用 Worker vs 共享 Worker
description: 什么时候用 Dedicated Worker，什么时候用 SharedWorker
outline: [2, 3]
---

:::tip 浏览器支持
Dedicated Worker: Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+

SharedWorker: Chrome 4+ · Firefox 29+ · Safari 15.2+ · Edge 79+

**注意**：Safari 对 SharedWorker 的支持相对较晚，移动端 Safari 15.2+ 才完整支持。
:::

## 概述

**Dedicated Worker** 归创建它的那个主线程独享，关闭主线程 Tab 它就死了。**Shared Worker** 则可以被同源的多个页面、多个标签页、多个 Worker 实例共享——一个地方初始化，多个地方复用同一个 Worker 进程。

怎么选？需要跨 Tab 共享状态或资源？用 SharedWorker。只在一个页面内跑计算？用 Dedicated Worker。

## 快速上手

<!-- 快速上手：SharedWorker 建立连接 -->
```js
// === SharedWorker（服务端入口） ===
const connections = new Set();

self.onconnect = (e) => {
  const port = e.ports[0];
  connections.add(port);

  port.onmessage = (e) => {
    console.log('收到消息:', e.data);
    // 广播给所有连接
    connections.forEach(p => p.postMessage(e.data));
  };

  port.start();
};
```

```js
// === main.js（任意 Tab） ===
const worker = new SharedWorker('./shared-worker.js', 'my-shared-worker');

worker.port.onmessage = (e) => {
  console.log('收到广播:', e.data);
};

worker.port.start();
worker.port.postMessage('hello from tab 1');
```

## 核心概念

### Dedicated Worker 生命周期

```
主线程 Tab A ── new Worker('w.js') ──→ Worker 进程 A（独享）
                                          │
Tab A 关闭 ──────────────────────────────→│ Worker A 被销毁
```

每个 `new Worker()` 创建的都是**独立的**进程，互不干扰。

### SharedWorker 生命周期

```
Tab A ── new SharedWorker('w.js') ──┐
                                     ├──→ 同一个 Worker 进程（共享）
Tab B ── new SharedWorker('w.js') ──┘
                                     │
Tab A 关闭 ───────────────────────────┤（Worker 仍存活）
Tab B 关闭 ───────────────────────────┘ Worker 无连接时销毁
```

所有指向同一个 SharedWorker 的连接共享同一个进程。哪怕所有 Tab 都关了，Worker 才会真正销毁。

### 什么时候用 Dedicated Worker？

- 后台计算（排序、压缩、加密）
- 音视频编解码
- 大数据 JSON 解析
- 定时轮询（WebSocket 心跳、服务器推流）

### 什么时候用 SharedWorker？

- **跨 Tab 共享数据**：比如同一个用户开了两个 Tab，一个 Tab 登录了，另一个 Tab 自动同步登录状态
- **跨 Tab 共享连接**：一个 WebSocket 连接，多个 Tab 共用，避免重复建立连接
- **计数器/状态广播**：全局事件总线

### 连接端口（Port）

SharedWorker 里的通信是基于**端口（Port）**的。每个 `new SharedWorker()` 都会得到一个 `MessagePort`，用来和 SharedWorker 通信：

```js
// 主线程：获取 port
const sw = new SharedWorker('./shared.js', 'name');
sw.port.start();       // 显式打开端口（有的浏览器需要）
sw.port.postMessage('hi');

// SharedWorker 内部：通过 onconnect 拿到 port
self.onconnect = (e) => {
  const port = e.ports[0];
  port.onmessage = (e) => { /* ... */ };
  port.start();         // 同上
  port.postMessage('reply');
};
```

## API 详解

### SharedWorker 全局属性

SharedWorker 内部可以使用以下全局属性：

```js
// SharedWorker.js
self.name         // new SharedWorker(url, name) 中的 name 参数
self.location     // Worker 脚本的 URL
self.close()      // 关闭自己
self.onerror      // 错误处理
self.onconnect    // 新连接到来（相当于 Dedicated 的 onmessage）
```

### SharedWorker 的错误处理

```js
// 主线程
sw.onerror = (e) => {
  console.error('SharedWorker 错误:', e.message);
};
```

## 实战案例

用 SharedWorker 做一个跨 Tab 的全局消息总线：

```js
// === message-bus.js ===
const subscribers = new Map(); // tabId -> MessagePort

self.onconnect = (e) => {
  const port = e.ports[0];
  const tabId = crypto.randomUUID();

  subscribers.set(tabId, port);
  port.start();

  port.onmessage = (e) => {
    // 收到某个 Tab 的消息，广播给所有其他 Tab
    const { type, payload } = e.data;
    subscribers.forEach((p, id) => {
      if (id !== tabId) {
        p.postMessage({ type, payload, from: tabId });
      }
    });
  };

  port.onmessageerror = () => {
    subscribers.delete(tabId);
  };
};
```

```js
// === main.js（任意 Tab） ===
const bus = new SharedWorker('./message-bus.js', 'bus');

bus.port.onmessage = ({ data }) => {
  console.log(`[Tab ${data.from}]:`, data.payload);
};

bus.port.start();
bus.port.postMessage({ type: 'CHAT', payload: '大家好！' });
```

## 注意事项

- **SharedWorker 的 `name` 参数**很重要。同一个 name 指向同一个 Worker 实例；不同 name 则创建不同的 Worker。
- **Safari 兼容**：如果你要支持 Safari 15.2 以下，不要用 SharedWorker，或准备兜底方案（BroadcastChannel）。
- **BroadcastChannel 是更轻的替代**：如果只需要跨 Tab 通信、不需要保持长连接状态，`BroadcastChannel` API 更简单，Safari 支持更早（Safari 15.4+）。
- **SharedWorker 端口必须 `.start()`**：部分浏览器必须显式调用 `port.start()` 才能激活端口。
