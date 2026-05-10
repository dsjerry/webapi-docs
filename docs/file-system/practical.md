---
title: 实战：本地文本编辑器
description: 仿 VS Code 的极简本地编辑器 — 打开 / 编辑 / ⌘S 保存
outline: [2, 3]
---

:::tip 场景
做一个浏览器里的"记事本"：能打开本地 .md 文件、实时编辑、按 ⌘S（Ctrl+S）原地保存——和 VS Code 体验一致。最终代码不到 200 行。
:::

## 需求拆解

- 打开 / 新建文件按钮
- 大文本框 textarea（生产用 CodeMirror / Monaco）
- ⌘S / Ctrl+S 快捷键保存
- 标题栏显示文件名 + 是否有未保存改动（dirty 标记）
- 关页面时若有未保存内容弹确认
- 用 IndexedDB 记住"最近打开的文件"

## HTML

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>本地编辑器</title>
  <style>
    body { margin: 0; height: 100vh; display: flex; flex-direction: column; font-family: ui-monospace, monospace; }
    .toolbar { padding: 0.6rem; border-bottom: 1px solid #ddd; display: flex; gap: 0.5rem; align-items: center; background: #f5f5f5; }
    .toolbar button { padding: 0.3rem 0.8rem; cursor: pointer; }
    .toolbar .name { flex: 1; padding: 0 1rem; color: #555; }
    .toolbar .dirty::before { content: '●  '; color: #d32f2f; }
    textarea { flex: 1; border: 0; padding: 1rem; font: inherit; resize: none; outline: none; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="new">新建</button>
    <button id="open">打开</button>
    <button id="save">保存</button>
    <button id="saveAs">另存为</button>
    <span class="name" id="name">未命名</span>
  </div>
  <textarea id="editor" placeholder="开始打字..."></textarea>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

## 应用代码

```js
// === app.js ===
import { openDB } from 'https://esm.sh/idb@8';

const db = await openDB('editor', 1, {
  upgrade(db) { db.createObjectStore('handles'); },
});

const $ = (id) => document.getElementById(id);
const editor = $('editor');
const nameEl = $('name');

let currentHandle = null;
let lastSaved = '';

// ====== 状态 ======

function isDirty() {
  return editor.value !== lastSaved;
}

function updateTitle() {
  const name = currentHandle?.name ?? '未命名';
  nameEl.textContent = name;
  nameEl.classList.toggle('dirty', isDirty());
  document.title = (isDirty() ? '● ' : '') + name + ' - 本地编辑器';
}

editor.oninput = updateTitle;

// ====== 操作 ======

async function ensurePermission(handle, mode = 'readwrite') {
  let perm = await handle.queryPermission({ mode });
  if (perm === 'granted') return true;
  perm = await handle.requestPermission({ mode });
  return perm === 'granted';
}

async function openFile(handle) {
  if (!await ensurePermission(handle, 'read')) return;
  const file = await handle.getFile();
  editor.value = await file.text();
  lastSaved = editor.value;
  currentHandle = handle;
  await db.put('handles', handle, 'last');
  updateTitle();
}

async function saveFile() {
  if (!currentHandle) return saveAsFile();
  if (!await ensurePermission(currentHandle)) return;

  const writable = await currentHandle.createWritable();
  await writable.write(editor.value);
  await writable.close();

  lastSaved = editor.value;
  updateTitle();
}

async function saveAsFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: currentHandle?.name ?? 'untitled.md',
    types: [{
      description: 'Markdown / Text',
      accept: { 'text/plain': ['.md', '.txt'] },
    }],
  });

  currentHandle = handle;
  await saveFile();
  await db.put('handles', handle, 'last');
}

// ====== 事件 ======

$('new').onclick = async () => {
  if (isDirty() && !confirm('当前文件有未保存的修改，继续？')) return;
  currentHandle = null;
  editor.value = '';
  lastSaved = '';
  updateTitle();
};

$('open').onclick = async () => {
  if (isDirty() && !confirm('当前文件有未保存的修改，继续？')) return;
  const [handle] = await window.showOpenFilePicker({
    types: [{
      description: 'Text',
      accept: { 'text/plain': ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css'] },
    }],
  });
  await openFile(handle);
};

$('save').onclick = saveFile;
$('saveAs').onclick = saveAsFile;

// 快捷键
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault();
    $('open').click();
  }
});

// 关闭页面前提醒
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ====== 启动时尝试恢复上次的文件 ======

(async () => {
  if (!('showOpenFilePicker' in window)) {
    alert('当前浏览器不支持 File System Access API（需 Chrome / Edge 86+）');
    return;
  }

  const last = await db.get('handles', 'last');
  if (!last) return updateTitle();

  // 不主动申请权限，等用户点击工具栏再询问
  nameEl.textContent = last.name + '（点保存或打开恢复）';

  $('save').addEventListener('click', async function once() {
    if (currentHandle) return;
    if (await ensurePermission(last)) {
      await openFile(last);
    }
    $('save').removeEventListener('click', once);
  }, { once: true });
})();
```

## 测试

```bash
# 本地起服务（File System Access 需要 https/localhost）
npx serve .
# 打开 http://localhost:5000
```

1. 点"打开" → 选一个 `.md` 或 `.txt` 文件
2. 修改内容 → 标题前出现红点 ●
3. 按 ⌘S（Mac）或 Ctrl+S（Windows）→ 红点消失，文件被原地修改
4. 关闭浏览器，重新打开 → 标题栏显示"上次的文件名（点保存或打开恢复）"→ 点保存确认权限即可继续

## 工程化扩展

### 接 Monaco Editor

把 `<textarea>` 换成 Monaco（VS Code 的编辑器内核）：

```js
import * as monaco from 'monaco-editor';

const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '',
  language: 'markdown',
  theme: 'vs-dark',
  automaticLayout: true,
});

// 取值 / 设值
editor.getValue();
editor.setValue(text);

// 监听变化
editor.onDidChangeModelContent(updateTitle);
```

### 自动保存

每秒检测一次：

```js
let saveTimer = null;
editor.oninput = () => {
  updateTitle();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (currentHandle && isDirty()) saveFile();
  }, 2000);
};
```

### 多 tab

把 `currentHandle` 改成数组，用 `BroadcastChannel` 在标签页间同步打开的文件，避免多个 Tab 同时改同一份文件。

### 文件监听

`File System Access` 没有 `watch` API。要做"文件被外部改动后自动重载"，用轮询：

```js
let lastMod = 0;
setInterval(async () => {
  if (!currentHandle) return;
  const file = await currentHandle.getFile();
  if (file.lastModified > lastMod) {
    lastMod = file.lastModified;
    if (!isDirty() || confirm('外部已修改文件，重新载入？')) {
      editor.value = await file.text();
      lastSaved = editor.value;
      updateTitle();
    }
  }
}, 2000);
```

## 常见排错

| 现象 | 原因 |
|------|------|
| `SecurityError: must be handling a user gesture` | picker 不在事件回调内调用，被异步操作分隔了 |
| 刷新后句柄存在但读取失败 | 权限失效，必须 `requestPermission` 重新申请 |
| Firefox / Safari 报 `showOpenFilePicker is not a function` | 这两家不支持显式 API，要做降级到 `<input type=file>` |
| 写入大文件途中页面崩溃 | 内存不够，用流式 `pipeTo` 而不是一次性 `write` |
| 移动 Chrome 找不到选项 | 移动版仅部分版本支持，老安卓直接没有 |

## 注意事项

- **picker 必须用户手势**：用 `await` 等了一会儿再 `showOpenFilePicker` 也不行
- **用户拒绝权限要降级**：不要无限弹权限对话框
- **写入前先 `query/requestPermission`**：跳过这一步在某些 case 下会直接抛错
- **不要假设句柄永久有效**：用户可能把文件删了/移走，读取时要 `try/catch`

## 延伸阅读

- [IndexedDB：存储配额管理](/indexeddb/advanced#存储配额管理) — OPFS 也算配额
- [Web Worker：基础用法](/webworker/basic) — `createSyncAccessHandle` 必须在 Worker 里用
- [Web Crypto：实战端到端加密笔记](/webcrypto/practical) — 配合做"加密的本地编辑器"
