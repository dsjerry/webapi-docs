---
title: Web Worker 概述
description: Web Worker 是什么，为什么它能让 JavaScript 真正"多线程"
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+
所有现代浏览器均已支持，包括移动端。
:::

## 概述

JavaScript 天生是单线程的。UI 更新、事件循环、渲染，全部挤在一条线程里。一旦你跑了个耗时计算（比如大数阶乘、图片滤镜、JSON 解析），页面就卡成 PPT——用户点了半天没反应。

**Web Worker** 就是解决方案：它让你在主线程之外创建一条独立的工作线程，专门干脏活累活，主线程继续流畅响应用户操作。Worker 和主线程之间通过消息传递（`postMessage`）通信，互不阻塞。

简单说：你想让页面不卡？把计算扔进 Worker 里。

## 快速上手

<!-- 快速上手：主线程往 Worker 发数据，Worker 算完发回来 -->
```js
// === main.js ===
const worker = new Worker('./worker.js');

// 监听 Worker 的消息
worker.onmessage = ({ data }) => {
  console.log('计算结果是:', data);
  // => 计算结果是: 3628800
};

// 发一段耗时任务给 Worker
worker.postMessage(10); // 告诉它：帮我算 10!
```

```js
// === worker.js ===
self.onmessage = (e) => {
  const n = e.data;
  // 算 n!（阶乘）
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  // 发回主线程
  self.postMessage(result);
};
```

这就是 Worker 的全部精髓：主线程发消息 → Worker 处理 → Worker 发回结果。

## 核心概念

### 为什么需要 Worker？

| 场景 | 无 Worker | 有 Worker |
|------|---------|---------|
| 大数组排序 10 万条 | UI 卡死 2-3 秒 | UI 流畅，后台计算 |
| 图片灰度处理 | 逐帧卡顿 | 实时预览不卡 |
| JSON 解析 10MB | 页面假死 | 完全无感 |
| WebSocket 心跳 | 被计算阻塞 | 始终及时响应 |

### Worker 的限制

Worker 线程和主线程是**完全隔离的上下文**（除了通过 `postMessage` 传递消息）：
- Worker 里没有 `document`、`window`、`DOM`
- Worker 里没有 `localStorage`（但有 `fetch`、WebSocket、IndexedDB）
- Worker 和主线程之间**传递的是副本**，不是同一个对象引用

### Worker 类型

| 类型 | 创建方式 | 作用域 |
|------|---------|--------|
| Dedicated Worker | `new Worker()` | 只属于创建它的主线程 |
| Shared Worker | `new SharedWorker()` | 可被同源多个页面/标签页共享 |
| Service Worker | `navigator.serviceWorker.register()` | 代理网络请求，可离线缓存 |
| Worklet | `CSS.paintWorklet.addModule()` | 渲染阶段自定义绘制 |

### OffscreenCanvas

Worker 里没有 DOM，但能用 **`OffscreenCanvas`** 画图——把 `<canvas>` 控制权转交到 Worker，渲染逻辑彻底脱离主线程：

```js
// === main.js ===
const canvas = document.querySelector('canvas');
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('./paint.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);  // 必须 transfer
```

```js
// === paint.js ===
self.onmessage = ({ data: { canvas } }) => {
  const ctx = canvas.getContext('2d');
  // 在 Worker 里绘图，主线程一点都不卡
  setInterval(() => {
    ctx.fillStyle = `hsl(${Date.now() / 10 % 360}, 70%, 50%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, 16);
};
```

适合复杂图表、游戏渲染、离屏图像处理。WebGL / WebGPU 也都能在 OffscreenCanvas 上跑。

### Comlink：把 postMessage 变成函数调用

原生 `postMessage` 写多了很啰嗦。**Comlink** 是 Google 出的封装库（2KB），把 Worker 暴露成"远程对象"，用法就像调用普通函数：

```js
// === main.js ===
import * as Comlink from 'comlink';
const api = Comlink.wrap(new Worker('./worker.js'));
const sum = await api.add(1, 2);
// => 3
```

```js
// === worker.js ===
import * as Comlink from 'comlink';
Comlink.expose({
  add: (a, b) => a + b,
  heavyTask: async (data) => { /* ... */ },
});
```

写法直观，代码量减半。社区主流方案，写复杂多 Worker 应用强烈推荐。

## 注意事项

- **Worker 代码必须同源**：`new Worker('./worker.js')` 里的路径必须和主页面同源
- **Worker 是独立 GC**：Worker 里的对象不会引起主线程的垃圾回收，但要记得 `worker.terminate()` 关闭它
- **postMessage 传递大数据有成本**：大对象会触发结构化克隆（structured clone），注意不要频繁传递超大数组
