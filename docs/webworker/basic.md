---
title: Worker 基础用法
description: 创建 Worker、postMessage 通信、terminate 关闭 — 完整生命周期
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+
:::

## 概述

Dedicated Worker 是最常用的 Worker 类型。它创建简单、通信直接、关闭干净。掌握 `new Worker()`、`postMessage`、`onmessage`、`terminate()` 这四个 API，Worker 你就算入门了。

## 快速上手

<!-- 快速上手：创建 Worker 并收发消息 -->
```js
// === main.js ===
const worker = new Worker('./worker.js');

worker.onmessage = (e) => {
  console.log('Worker 说:', e.data);
  // => Worker 说: 已收到 42
};

worker.postMessage(42);
```

```js
// === worker.js ===
self.onmessage = (e) => {
  const num = e.data;
  self.postMessage(`已收到 ${num}`);
};
```

## 核心概念

### 创建 Worker

```js
// 方式一：通过外部脚本文件
const worker = new Worker('./worker.js');

// 方式二：内联 Worker（不需要额外文件）
const blob = new Blob([`
  self.onmessage = (e) => self.postMessage(e.data * 2);
`], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
```

:::tip
内联 Worker 省去了网络请求，适合短小的工具函数。如果 Worker 代码超过 30 行，建议还是放单独文件，维护性更好。
:::

### postMessage 双向通信

主线程和 Worker 之间的消息是**全双工**的——两方都可以随时 `postMessage`，两方都通过 `onmessage` 接收：

```js
// 主线程 → Worker
worker.postMessage({ type: 'START', payload: 123 });

// Worker → 主线程
// self.postMessage({ type: 'RESULT', payload: 246 });
```

也可以传递二进制数据（ArrayBuffer、Blob）：

```js
// 主线程发一个 ArrayBuffer 给 Worker 处理
const buffer = new ArrayBuffer(1024 * 1024); // 1MB
worker.postMessage(buffer, [buffer]); // 转移所有权，不拷贝

// Worker 处理完后发回来
self.postMessage(buffer, [buffer]);
```

:::warning 所有权转移
第二个参数 `[buffer]` 表示**转移所有权**（transferable）。转移后，主线程不能再访问这个 buffer，只有 Worker 能访问。这样可以避免拷贝大数据的性能开销。
:::

### onmessage 和 addEventListener

两种写法完全等价：

```js
// 方式一：onmessage（简洁）
worker.onmessage = (e) => { /* ... */ };

// 方式二：addEventListener（可绑定多个监听器）
worker.addEventListener('message', (e) => { /* ... */ });
worker.addEventListener('message', (e) => { /* 另一个监听器 */ });
```

### terminate 和 close

```js
// 主线程强制关闭 Worker
worker.terminate();
// worker 实例作废，不能再 postMessage

// Worker 内部自己退出
self.close();
```

:::danger terminate vs close
- `worker.terminate()`：主线程主动关闭，立即终止 Worker，不管它在干什么
- `self.close()`：Worker 自己调用，会等当前任务跑完再退出
:::

### Worker 错误处理

```js
worker.onerror = (e) => {
  console.error('Worker 出错了！');
  console.error('文件名:', e.filename);
  console.error('行号:', e.lineno);
  console.error('错误信息:', e.message);
};

// 等价写法
worker.addEventListener('error', (e) => { /* ... */ });
```

## 实战案例

把一个大数组的排序从主线程搬到 Worker：

```js
// === main.js ===
const worker = new Worker('./sort-worker.js');

sortBtn.onclick = async () => {
  // 生成 50 万个随机数
  const arr = Array.from({ length: 500_000 }, () => Math.random());

  // 发给 Worker 排序
  worker.postMessage({ array: arr, order: 'asc' });

  // 等结果
  worker.onmessage = ({ data }) => {
    console.log('排序完成，耗时 0 卡顿！');
    renderChart(data);
  };
};

// 页面卸载时关掉 Worker
window.addEventListener('beforeunload', () => worker.terminate());
```

```js
// === sort-worker.js ===
self.onmessage = ({ data }) => {
  const { array, order } = data;

  const sorted = array.sort((a, b) =>
    order === 'desc' ? b - a : a - b
  );

  // 发回主线程
  self.postMessage(sorted);
};
```

## 注意事项

- **Worker 线程里 `this === self`**：`this.postMessage` 和 `self.postMessage` 完全等价，推荐用 `self` 避免歧义
- **不能访问 `window`**：但可以 `importScripts()` 加载同源脚本
- **`importScripts` 是同步的**：加载完成后才继续执行，不支持跨域
- **Worker 的 `console.log`** 会打印在浏览器的 **Worker 控制台**里（开发者工具 → Source → Workers 面板），不是主页面控制台
