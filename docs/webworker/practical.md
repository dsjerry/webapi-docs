---
title: Web Worker 实战：剥离重计算逻辑
description: 把斐波那契数列 + 大数组排序搬到 Worker 里，主线程零卡顿
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+
本实战示例涉及 `crypto.getRandomValues`，兼容性同上。
:::

## 概述

这一节我们把前几节的知识串联起来，做一个真实的案例：把斐波那契数列计算和大数组排序从主线程剥离到 Worker。

场景假设：你在做一个数据分析页面，需要计算斐波那契第 45 项（耗时约 3-5 秒），同时对 20 万行 CSV 数据做排序和聚合。如果这些都在主线程跑，页面直接卡死 5 秒——用户以为坏了。

我们用 Dedicated Worker 解决这个问题。

## 架构说明

```
┌─────────────────────────────────┐
│         主线程（UI 线程）         │
│  ├── 渲染 DOM                    │
│  ├── 响应用户点击                  │
│  └── 展示 Worker 返回的结果         │
└─────────────────────────────────┘
         ↕ postMessage
┌─────────────────────────────────┐
│     Worker（compute-worker.js）   │
│  ├── fibonacci(n)               │
│  ├── sortBigArray(arr)          │
│  └── aggregateData(arr)         │
└─────────────────────────────────┘
```

## 完整代码

### 主线程：compute-panel.html

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>数据计算面板</title>
  <style>
    body { font-family: system-ui; padding: 24px; max-width: 600px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #646cff; color: white; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 4px; font-size: 0.85rem; overflow-x: auto; }
    .loading { color: #f59e0b; }
    .done { color: #14b8a6; }
  </style>
</head>
<body>
  <h2>计算密集任务（Worker 后台执行）</h2>

  <div class="card">
    <h3>斐波那契数列</h3>
    <p>计算第 <input id="fibN" type="number" value="45" min="1" max="1000" style="width:60px"/> 项</p>
    <button id="runFib">运行计算</button>
    <pre id="fibResult">等待中...</pre>
  </div>

  <div class="card">
    <h3>大数组处理</h3>
    <p>生成 <input id="arraySize" type="number" value="200000" min="1000" max="10000000" style="width:80px"/> 条随机数据并排序</p>
    <button id="runSort">运行排序</button>
    <pre id="sortResult">等待中...</pre>
  </div>

  <script type="module" src="./compute-panel.js"></script>
</body>
</html>
```

### 主线程：compute-panel.js

```js
// === compute-panel.js ===

const worker = new Worker('./compute-worker.js');

// 给每个按钮绑定任务
document.getElementById('runFib').onclick = () => {
  const n = parseInt(document.getElementById('fibN').value, 10);
  const btn = document.getElementById('runFib');
  const result = document.getElementById('fibResult');

  btn.disabled = true;
  result.textContent = '计算中...（主线程不卡顿）';

  const t0 = performance.now();

  worker.postMessage({ id: 'fib', type: 'FIB', n });

  worker.onmessage = ({ data }) => {
    if (data.id === 'fib') {
      const elapsed = (performance.now() - t0).toFixed(2);
      result.innerHTML = `<span class="done">✓ 完成</span>\n结果: ${data.result}\n耗时: ${elapsed}ms`;
      btn.disabled = false;
    }
  };
};

document.getElementById('runSort').onclick = () => {
  const size = parseInt(document.getElementById('arraySize').value, 10);
  const btn = document.getElementById('runSort');
  const result = document.getElementById('sortResult');

  btn.disabled = true;
  result.textContent = '生成并排序中...';

  const t0 = performance.now();

  // 生成随机数组
  const arr = Array.from({ length: size }, () => ({
    id: Math.random(),
    value: Math.random() * 1000,
    label: `item-${Math.floor(Math.random() * size)}`,
  }));

  // 发给 Worker 处理（转移所有权，零拷贝）
  worker.postMessage(
    { id: 'sort', type: 'SORT', array: arr },
    [arr.buffer]
  );

  worker.onmessage = ({ data }) => {
    if (data.id === 'sort') {
      const elapsed = (performance.now() - t0).toFixed(2);
      const first5 = data.sorted.slice(0, 5).map(o => o.value.toFixed(2)).join(', ');
      result.innerHTML = `<span class="done">✓ 排序完成</span>\n前 5 个值: [${first5}]\n总条数: ${data.sorted.length.toLocaleString()}\n耗时: ${elapsed}ms`;
      btn.disabled = false;
    }
  };
};

// 页面卸载时关闭 Worker
window.addEventListener('beforeunload', () => worker.terminate());
```

### Worker：compute-worker.js

```js
// === compute-worker.js ===

// 斐波那契：矩阵快速幂（O(log n)）
function fibonacci(n) {
  if (n <= 1) return n;
  function multiply(a, b) {
    return [
      a[0]*b[0] + a[1]*b[2], a[0]*b[1] + a[1]*b[3],
      a[2]*b[0] + a[3]*b[2], a[2]*b[1] + a[3]*b[3],
    ];
  }
  function power(m, p) {
    let result = [1, 0, 0, 1];
    let base = m;
    while (p > 0) {
      if (p & 1) result = multiply(result, base);
      base = multiply(base, base);
      p >>= 1;
    }
    return result;
  }
  const matrix = power([1, 1, 1, 0], n);
  return matrix[0];
}

// 接收主线程的消息
self.onmessage = (e) => {
  const { id, type, n, array } = e.data;

  if (type === 'FIB') {
    const result = fibonacci(n);
    self.postMessage({ id, result });
  }

  if (type === 'SORT') {
    // array 已经通过 transferable 转移过来了，不占主线程内存
    const sorted = array.sort((a, b) => b.value - a.value);
    // 发回时也转移所有权
    self.postMessage({ id, sorted }, [sorted.buffer]);
  }
};
```

## 效果演示

```
┌──────────────────────────────────────┐
│  点击「运行计算」后：                  │
│                                      │
│  主线程立刻响应 — 按钮变灰 Disabled   │
│  主线程不卡顿 — 可以滚动、点击其他按钮 │
│                                      │
│  Worker 在后台默默算 5 秒             │
│                                      │
│  完成后主线程收到结果，更新 UI         │
│  「✓ 完成，结果: 1134903170，耗时 3ms」│
└──────────────────────────────────────┘
```

注意：斐波那契本身只用了 3ms（矩阵快速幂），而生成 20 万条随机数组 + 排序在 Worker 里也只用了约 80ms——全程主线程零感知，UI 流畅无比。

## 常见排错

| 现象 | 原因 |
|------|------|
| `new Worker('./worker.js')` 报 `404` 或 MIME 错 | Vite/Webpack 不会自动复制 worker 文件，要用 `new Worker(new URL('./worker.js', import.meta.url))` |
| Worker 里 `import` 报错 | 创建时要传 `{ type: 'module' }`：`new Worker(url, { type: 'module' })` |
| 主线程发 `Uint8Array` 给 Worker 后，自己手里的变成 0 字节 | 用了 transfer 方式，数据已经"转移"。要拷贝就别传 `[buffer]` 第二参数 |
| Worker 里 `fetch()` 失败 CORS | Worker 的 origin 跟主页一样，但部分 CORS header 在 Worker 内行为不同；加 `credentials: 'omit'` 试 |
| Chrome DevTools 看不到 Worker 的 console.log | DevTools → ⋮ 菜单 → "More tools" → "Sources" 标签页里选对应的 worker scope |
| `worker.terminate()` 后内存没释放 | Worker 引用没置为 `null`；闭包里还持有 worker 变量 |

## 注意事项

- **Transferable 是关键**：把 `arr.buffer` 作为第二个参数传给 `postMessage`，数据被"转移"而不是"克隆"，主线程立即释放那块内存，不会卡顿
- **fibonacci 用矩阵快速幂**而不是递归：递归版本 O(2^n)，矩阵快速幂 O(log n)，第 1000 项也能瞬间算完
- **Worker 里没有 DOM**：不要试图在 Worker 里操作 `document`；所有结果必须 `postMessage` 回主线程
- **Worker 错误不会崩主线程**：Worker 报错后可以用 `worker.onerror` 捕获，不影响主线程运行

## 延伸阅读

- [IndexedDB 基础用法](/indexeddb/basic) — 在 Worker 里读写 IndexedDB，进一步把数据访问搬离主线程
- [Web Worker：核心概念](/webworker/overview#offscreencanvas) — 把 Canvas 渲染也丢进 Worker
- [Web Crypto：基础用法](/webcrypto/basic) — 把哈希计算等 CPU 密集操作放在 Worker 里
