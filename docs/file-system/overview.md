---
title: File System Access 概述
description: File System Access API 是什么，浏览器为什么终于能读写本地文件
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 86+ · Edge 86+ · Opera 72+
**Firefox / Safari 不支持** `showOpenFilePicker` 等"显式"API；但 OPFS（私有文件系统）在所有现代浏览器都可用。
:::

## 概述

20 多年来，浏览器读文件只能用 `<input type="file">` 上传，写文件只能 `<a download>` 下载。**真正的"打开 → 修改 → 保存"流程**——VS Code、Photoshop 这种——浏览器一直做不到。

**File System Access API** 让这件事终于成为可能：用户授权后，网页可以直接读写本地文件和目录，**不复制、不上传、不下载**。Photopea（在线 PS）、Excalidraw、VS Code Web 全部基于它。

简单说：你想让网页像桌面应用一样直接编辑用户的文件？这就是答案。

## 和传统方案的区别

| | `<input type=file>` | `<a download>` | File System Access |
|--|--|--|--|
| 读文件 | 只能拷一份到内存 | — | 能反复读源文件 |
| 写文件 | — | 只能下载新文件 | **能改原文件** |
| 文件夹 | 只能逐个选 | — | 整个目录递归访问 |
| 用户体验 | "选文件 → 编辑 → 下载" | 同左 | "打开 → 编辑 → ⌘S 保存" |
| 适用场景 | 上传到服务器 | 导出 | 真正的本地编辑器 |

## 快速上手

<!-- 快速上手：打开 → 修改 → 保存 -->
```js
// 1. 让用户选一个文件
const [handle] = await window.showOpenFilePicker();

// 2. 读
const file = await handle.getFile();
const text = await file.text();
console.log(text);
// => 文件内容

// 3. 写（覆盖）
const writable = await handle.createWritable();
await writable.write(text + '\n新增一行');
await writable.close();
```

整个过程文件**永远在用户磁盘上**，浏览器只是代理读写——零拷贝。

## 核心概念

### FileSystemHandle

句柄（Handle）是 File System Access 的核心抽象。它代表"用户授权访问的某个文件或目录"，不是文件内容本身：

| 类型 | 说明 |
|------|------|
| `FileSystemFileHandle` | 单个文件 |
| `FileSystemDirectoryHandle` | 一个目录（可递归列出子项） |

句柄拿到后可以**存进 IndexedDB**，下次启动应用时不用让用户重选文件，直接 `requestPermission()` 续上权限。

```js
const handle = await window.showOpenFilePicker();
// 把 handle 存 IndexedDB
db.put({ id: 'lastFile', handle });
```

### 三个入口 API

| API | 作用 |
|-----|------|
| `showOpenFilePicker()` | 让用户选一个或多个文件（读） |
| `showSaveFilePicker()` | 让用户选保存位置（写新文件） |
| `showDirectoryPicker()` | 让用户选一个目录（读写整个文件夹） |

全部返回 Promise，**必须由用户手势触发**（点击事件回调内）。

### 权限模型

句柄有两种状态：`granted` 和 `prompt`。每次浏览器**重新加载页面**，权限会重置为 `prompt`，需要再次询问：

```js
const perm = await handle.queryPermission({ mode: 'readwrite' });
// => 'granted' | 'prompt' | 'denied'

if (perm !== 'granted') {
  await handle.requestPermission({ mode: 'readwrite' });
}
```

### OPFS（Origin Private File System）

如果你**不需要**用户参与，只想要"自己应用的私有文件系统"——比如 SQLite WASM、视频缓存、虚拟机磁盘镜像——用 OPFS。它是个沙箱化的本地文件系统：

```js
const root = await navigator.storage.getDirectory();
const file = await root.getFileHandle('cache.bin', { create: true });
```

| 特性 | OPFS | 显式 API |
|------|------|------|
| 用户可见 | ❌ 不可见 | ✅ 在文件管理器里 |
| 需要授权 | ❌ 不需要 | ✅ 需要 |
| 读写性能 | **极快**（无授权检查） | 中等 |
| 跨浏览器 | ✅ 全支持 | ❌ Firefox / Safari 不支持显式 API |
| 用途 | 数据库、缓存、临时文件 | 用户文档 |

## 注意事项

- **必须 HTTPS**：除 localhost 外，所有 File System Access 调用要 HTTPS
- **必须用户手势**：所有 picker 必须在 click / keydown 等事件回调内调用
- **Firefox / Safari 没有显式 API**：要做跨浏览器应用，OPFS 是唯一通用选项
- **句柄存 IndexedDB 可恢复，但权限不能**：刷新页面后必须重新 `requestPermission`
- **不能写系统目录**：浏览器禁止写 `/`、`C:\Windows` 等系统路径，会自动拦截
