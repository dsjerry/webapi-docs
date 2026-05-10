---
title: File System Access 进阶用法
description: 持久化句柄、OPFS 高性能文件、Drag & Drop、降级方案
outline: [2, 3]
---

:::tip 浏览器支持
显式 API：Chrome 86+ / Edge 86+
OPFS：所有现代浏览器（包括 Firefox / Safari）
:::

## 持久化文件句柄

让用户重启浏览器后还能"打开最近的文件"——把句柄存进 IndexedDB。

```js
// IndexedDB 支持序列化 FileSystemHandle
import { openDB } from 'idb';

const db = await openDB('myapp', 1, {
  upgrade(db) {
    db.createObjectStore('handles');
  },
});

// 保存
async function saveLastFile(handle) {
  await db.put('handles', handle, 'lastFile');
}

// 恢复
async function restoreLastFile() {
  const handle = await db.get('handles', 'lastFile');
  if (!handle) return null;

  // 句柄能取出来，但权限不会保留——必须重新申请
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const result = await handle.requestPermission({ mode: 'readwrite' });
    if (result !== 'granted') return null;
  }
  return handle;
}
```

实际场景：用户打开应用 → 自动调 `restoreLastFile()` → 弹一次"是否允许 myapp 继续访问 xxx.txt？" → 直接进入编辑状态。

## OPFS 高性能文件

OPFS（Origin Private File System）是站点专属的隐藏文件系统。**性能远超 IndexedDB**，是 SQLite WASM、视频缓存的首选。

### 基础用法

```js
const root = await navigator.storage.getDirectory();

// 创建/打开文件
const fileHandle = await root.getFileHandle('cache.bin', { create: true });

// 写
const writable = await fileHandle.createWritable();
await writable.write(new Uint8Array([1, 2, 3]));
await writable.close();

// 读
const file = await fileHandle.getFile();
const buf = await file.arrayBuffer();
```

### 同步访问句柄（仅 Worker 内）

OPFS 在 Worker 里有一个特殊 API：**同步**读写。这是 SQLite WASM 等 C 库的关键：

```js
// === worker.js ===
const root = await navigator.storage.getDirectory();
const fileHandle = await root.getFileHandle('db.sqlite', { create: true });

// 拿到同步句柄（仅 Worker，主线程不行）
const access = await fileHandle.createSyncAccessHandle();

// 这些方法是同步的，没有 await！
access.write(new Uint8Array([1, 2, 3]), { at: 0 });
const buf = new Uint8Array(1024);
const n = access.read(buf, { at: 0 });
access.flush();
access.truncate(0);
access.close();
```

性能对比（Chrome，10MB 数据）：

| 操作 | IndexedDB | OPFS（异步） | OPFS（同步） |
|------|-----------|---------------|---------------|
| 写入 | ~120ms | ~30ms | ~5ms |
| 读取 | ~80ms | ~20ms | ~3ms |

### 列出 OPFS 内容

```js
const root = await navigator.storage.getDirectory();
for await (const [name, handle] of root.entries()) {
  console.log(name, handle.kind);
}
```

### 清空 OPFS

```js
// 删除整个 OPFS 内容
const root = await navigator.storage.getDirectory();
for await (const name of root.keys()) {
  await root.removeEntry(name, { recursive: true });
}
```

OPFS 也算 storage 配额，详见 [IndexedDB 进阶 - 存储配额管理](/indexeddb/advanced#存储配额管理)。

## Drag & Drop 集成

把拖到页面的文件夹直接转成句柄：

```js
const dropZone = document.getElementById('drop');

dropZone.ondragover = (e) => e.preventDefault();

dropZone.ondrop = async (e) => {
  e.preventDefault();

  for (const item of e.dataTransfer.items) {
    if (item.kind === 'file') {
      // Chrome 86+ 才有 getAsFileSystemHandle
      const handle = await item.getAsFileSystemHandle();
      if (handle.kind === 'directory') {
        await processDirectory(handle);
      } else {
        await processFile(handle);
      }
    }
  }
};
```

拖文件夹进来 → 拿到 `FileSystemDirectoryHandle` → 可以递归读所有内容。VS Code Web 就是这么实现"打开文件夹"的。

## 流式处理大文件

大文件（>100MB）不要一次性 `arrayBuffer()`，会爆内存。用流：

```js
const [handle] = await window.showOpenFilePicker();
const file = await handle.getFile();

const reader = file.stream().getReader();
let processed = 0;

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  processed += value.byteLength;
  // 处理这一块（比如算哈希、压缩、发到 Worker）
}
```

写入也支持流：

```js
const writable = await handle.createWritable();
await someReadableStream.pipeTo(writable);   // 直接 pipe
```

## 跨浏览器降级

Firefox / Safari 不支持显式 API，但仍可以用基础方式：

```js
async function pickFile() {
  if ('showOpenFilePicker' in window) {
    const [handle] = await window.showOpenFilePicker();
    return { name: handle.name, getText: async () => (await handle.getFile()).text() };
  }

  // 降级：传统 input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const file = input.files[0];
      resolve({ name: file.name, getText: () => file.text() });
    };
    input.click();
  });
}
```

代价：降级路径不能保存回原文件，得用 `<a download>` 重新下载。

## 完整封装：异步 + 同步统一接口

```js
// === fs.js ===
class AppFile {
  constructor(handle) {
    this.handle = handle;
    this.name = handle.name;
  }

  async read() {
    const file = await this.handle.getFile();
    return file.text();
  }

  async write(content) {
    if (await this.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      const r = await this.handle.requestPermission({ mode: 'readwrite' });
      if (r !== 'granted') throw new Error('权限被拒');
    }
    const w = await this.handle.createWritable();
    await w.write(content);
    await w.close();
  }

  static async pick() {
    const [h] = await window.showOpenFilePicker();
    return new AppFile(h);
  }

  static async create(suggestedName) {
    const h = await window.showSaveFilePicker({ suggestedName });
    return new AppFile(h);
  }
}

// 用法
const f = await AppFile.pick();
console.log(await f.read());
await f.write('新内容');
```

## 注意事项

- **OPFS 数据用户清不掉（除了清站点数据）**：不要把可恢复的重要数据藏在 OPFS 里
- **`createSyncAccessHandle` 仅 Worker 可用**：主线程调用直接报错
- **句柄存 IndexedDB 不是所有浏览器都行**：Firefox 早期版本不支持（要序列化 handle 到 IndexedDB）
- **拖文件夹得用 `getAsFileSystemHandle`**：传统的 `dataTransfer.files` 只给文件不给文件夹
- **OPFS 配额和 IndexedDB 共享**：写入前用 `navigator.storage.estimate()` 看看用量
