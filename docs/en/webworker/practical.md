---
title: "Web Worker Practical: Offloading Computation"
description: Moving Fibonacci calculation and large array sorting into a Worker for zero main-thread stutter
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 3.5+ · Safari 4+ · Edge 12+
This practical example involves `crypto.getRandomValues` — same compatibility as above.
:::

## Overview

This section ties together everything covered in previous sections: a real-world case — moving Fibonacci calculation and large array sorting from the main thread to a Worker.

Scenario: you're building a data analysis page. You need to compute Fibonacci(45) (takes ~3-5 seconds) and sort + aggregate 200k rows of CSV data. If all this runs on the main thread, the page freezes for 5 seconds — users think it's broken.

We'll solve this with a Dedicated Worker.

## Architecture

```
┌─────────────────────────────────┐
│         Main Thread (UI)         │
│  ├── Render DOM                   │
│  ├── Respond to user clicks       │
│  └── Display Worker results       │
└─────────────────────────────────┘
         ↕ postMessage
┌─────────────────────────────────┐
│   Worker (compute-worker.js)     │
│  ├── fibonacci(n)               │
│  ├── sortBigArray(arr)          │
│  └── aggregateData(arr)         │
└─────────────────────────────────┘
```

## Complete Code

### Main Thread: compute-panel.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Data Computation Panel</title>
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
  <h2>Compute-Intensive Tasks (Worker background execution)</h2>

  <div class="card">
    <h3>Fibonacci Sequence</h3>
    <p>Compute term <input id="fibN" type="number" value="45" min="1" max="1000" style="width:60px"/></p>
    <button id="runFib">Run Computation</button>
    <pre id="fibResult">Waiting...</pre>
  </div>

  <div class="card">
    <h3>Large Array Processing</h3>
    <p>Generate <input id="arraySize" type="number" value="200000" min="1000" max="10000000" style="width:80px"/> random items and sort them</p>
    <button id="runSort">Run Sort</button>
    <pre id="sortResult">Waiting...</pre>
  </div>

  <script type="module" src="./compute-panel.js"></script>
</body>
</html>
```

### Main Thread: compute-panel.js

```js
const worker = new Worker('./compute-worker.js');

document.getElementById('runFib').onclick = () => {
  const n = parseInt(document.getElementById('fibN').value, 10);
  const btn = document.getElementById('runFib');
  const result = document.getElementById('fibResult');

  btn.disabled = true;
  result.textContent = 'Computing... (main thread not blocked)';

  const t0 = performance.now();
  worker.postMessage({ id: 'fib', type: 'FIB', n });

  worker.onmessage = ({ data }) => {
    if (data.id === 'fib') {
      const elapsed = (performance.now() - t0).toFixed(2);
      result.innerHTML = `<span class="done">Done</span>\nResult: ${data.result}\nTime: ${elapsed}ms`;
      btn.disabled = false;
    }
  };
};

document.getElementById('runSort').onclick = () => {
  const size = parseInt(document.getElementById('arraySize').value, 10);
  const btn = document.getElementById('runSort');
  const result = document.getElementById('sortResult');

  btn.disabled = true;
  result.textContent = 'Generating and sorting...';

  const t0 = performance.now();

  const arr = Array.from({ length: size }, () => ({
    id: Math.random(),
    value: Math.random() * 1000,
    label: `item-${Math.floor(Math.random() * size)}`,
  }));

  worker.postMessage(
    { id: 'sort', type: 'SORT', array: arr },
    [arr.buffer]
  );

  worker.onmessage = ({ data }) => {
    if (data.id === 'sort') {
      const elapsed = (performance.now() - t0).toFixed(2);
      const first5 = data.sorted.slice(0, 5).map(o => o.value.toFixed(2)).join(', ');
      result.innerHTML = `<span class="done">Sorted</span>\nFirst 5 values: [${first5}]\nTotal items: ${data.sorted.length.toLocaleString()}\nTime: ${elapsed}ms`;
      btn.disabled = false;
    }
  };
};

window.addEventListener('beforeunload', () => worker.terminate());
```

### Worker: compute-worker.js

```js
// Fibonacci: matrix fast power (O(log n))
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

self.onmessage = (e) => {
  const { id, type, n, array } = e.data;

  if (type === 'FIB') {
    const result = fibonacci(n);
    self.postMessage({ id, result });
  }

  if (type === 'SORT') {
    const sorted = array.sort((a, b) => b.value - a.value);
    self.postMessage({ id, sorted }, [sorted.buffer]);
  }
};
```

## Notes

- **Transferable is key**: Pass `arr.buffer` as the second argument to `postMessage`; the data is "transferred" rather than "cloned", the main thread immediately releases that memory with no stutter
- **Use matrix fast power for Fibonacci** instead of recursion: recursive version is O(2^n), matrix fast power is O(log n) — computes Fibonacci(1000) instantly
- **No DOM in Workers**: Don't try to manipulate `document` in a Worker; all results must come back via `postMessage`
- **Worker errors don't crash the main thread**: Worker errors can be caught with `worker.onerror` and don't affect main thread execution
