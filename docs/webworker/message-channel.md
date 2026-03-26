---
title: MessageChannel
description: 创建私有通信管道，让两个 Worker 直接对话，不走主线程
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 41+ · Safari 10+ · Edge 12+
MessageChannel 在主线程、Worker、ServiceWorker 中均可用。
:::

## 概述

`MessageChannel` 让你在两个上下文之间建立一条**私有、直连**的通信管道，而不需要经过 Worker 的主脚本。

典型场景：主线程同时管理两个 Worker，但这两个 Worker 之间需要直接交换大量数据。如果走主线程中转，所有数据都要"主线程进、主线程出"，白白多一次拷贝。用 MessageChannel，可以让两个 Worker 直接对话，主线程只负责建立连接。

## 快速上手

<!-- 快速上手：在主线程创建 MessageChannel，让两个 Worker 直连 -->
```js
// === main.js ===
// 创建一条私有管道
const channel = new MessageChannel();

// 拿到两个端口（port1 和 port2）
const port1 = channel.port1;
const port2 = channel.port2;

// 把 port2 发给 Worker B
const workerB = new Worker('./worker-b.js');
workerB.postMessage({ type: 'PORT', port: port2 }, [port2]);

// 主线程自己保留 port1
port1.onmessage = (e) => console.log('A 说:', e.data);
// => A 说: 你好 B！我是 A！

// 等 Worker B 连接 port1
port1.start();
```

```js
// === worker-a.js ===
// 假设通过某种方式（主线程转发）拿到了 port1
let port1;

self.onmessage = (e) => {
  if (e.data.type === 'SET_PORT') {
    port1 = e.data.port;
    port1.start();
    // 直接给 B 发消息，不经过主线程
    port1.postMessage('你好 B！我是 A！');
  }
};
```

这个例子省略了 B 端拿到端口的步骤——实际应用中，通常由主线程负责把端口转发给两个 Worker。

## 核心概念

### MessageChannel 的两个端口

`new MessageChannel()` 返回一个 `{ port1, port2 }` 对象。规则很简单：

- `port1` 发送 → `port2` 接收
- `port2` 发送 → `port1` 接收
- 一端关闭后，另一端会收到 `onmessageerror`

```
  port1  ──────────────────────────  port2
  send()  ────── 数据流向 ────────>  onmessage
  onmessage  <───── 数据流向 ─────  send()
```

### Transferable（可转移对象）

MessageChannel 和 `postMessage` 一样支持 **Transferable**：

```js
const channel = new MessageChannel();
const buffer = new ArrayBuffer(1024);

// 转移 buffer 的所有权
channel.port1.postMessage(buffer, [buffer]);

// 现在只有 port2 能访问这个 buffer
// port1 已经无法访问了
```

### BroadcastChannel 的区别

| 特性 | MessageChannel | BroadcastChannel |
|------|---------------|------------------|
| 通信对象 | 两个特定端口 | 同源所有 Tab + Worker |
| 是否需要中转 | 端口需手动分发 | 不需要，天然广播 |
| 方向 | 全双工，直连 | 全双工，广播 |
| 兼容性 | 更好（IE10+） | Safari 15.4+ 才开始支持 |

## API 详解

### MessageChannel 构造函数

```js
// 创建一条新管道（两端都未激活）
const channel = new MessageChannel();

// port1 和 port2 初始状态是 "pending"
// 必须调用 .start() 才激活
channel.port1.start();
channel.port2.start();

// 或者用 onmessage 自动激活（浏览器自动调用 start）
channel.port1.onmessage = (e) => { /* ... */ };
channel.port2.onmessage = (e) => { /* ... */ };
```

### 关闭端口

```js
// 关闭一端，另一端触发 onmessageerror
channel.port1.close();

// 关闭后 port1 不可再用
```

### 在 Worker 里创建 MessageChannel

Worker 也可以创建自己的 MessageChannel，把端口发回主线程：

```js
// === worker.js ===
self.onmessage = (e) => {
  const { action } = e.data;

  if (action === 'OPEN_CHANNEL') {
    const ch = new MessageChannel();
    // 把一个 port 留在 Worker 里处理
    self.port = ch.port1;
    self.port.start();
    self.port.onmessage = (e) => {
      // 处理来自主线程的直连消息
      self.port.postMessage('收到: ' + e.data);
    };

    // 把另一个 port 发回主线程
    self.postMessage({ type: 'PORT' }, [ch.port2]);
  }
};
```

## 实战案例

用 MessageChannel 实现 Worker 池（Worker 池里的 Worker 之间直连通信）：

```js
// === worker-pool.js（主线程管理） ===
class WorkerPool {
  constructor(path, size) {
    this.path = path;
    this.idle = [];
    this.busy = [];
    this.channelMap = new Map(); // workerId -> MessageChannel

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
        // 归还 Worker
        this.busy = this.busy.filter(b => b.port !== port);
        this.idle.push({ worker, port });
      };
      port.postMessage(task);
    });
  }

  destroy() {
    [...this.idle, ...this.busy].forEach(({ worker }) => worker.terminate());
    this.idle = [];
    this.busy = [];
  }
}

// 用法
const pool = new WorkerPool('./compute-worker.js', 4);
const result = await pool.run({ data: bigArray });
pool.destroy();
```

## 注意事项

- **端口必须 `.start()`**：即使绑定了 `onmessage`，部分浏览器仍要求显式调用 `.start()` 激活端口
- **不要在 port 上同时绑定 `onmessage` 和 `addEventListener('message')` 两次**：消息会被处理两遍
- **端口转移后原线程失去所有权**：如果 `postMessage` 时把 `port2` 作为 transferable 传出去，原线程就不能再用了
