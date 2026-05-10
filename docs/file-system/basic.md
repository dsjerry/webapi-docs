---
title: File System Access 基础用法
description: 打开文件、保存文件、选择目录 — 三个核心场景
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 86+ / Edge 86+ 支持完整 API，Firefox / Safari 仅支持 OPFS。
所有调用必须在用户手势事件回调内。
:::

## 打开文件

```js
button.onclick = async () => {
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: '文本文件',
        accept: { 'text/plain': ['.txt', '.md'] },
      },
    ],
    excludeAcceptAllOption: false,
    multiple: false,
  });

  const file = await handle.getFile();
  const text = await file.text();
  // => 文件内容字符串
};
```

| 选项 | 类型 | 说明 |
|------|------|------|
| `types` | array | 文件类型过滤 |
| `multiple` | boolean | 是否允许多选 |
| `excludeAcceptAllOption` | boolean | 是否隐藏"所有文件"选项 |
| `startIn` | string \| handle | 默认打开位置：`'desktop'` / `'documents'` / `'downloads'` 或某个目录句柄 |
| `id` | string | 记住上次的打开位置 |

### 多选

```js
const handles = await window.showOpenFilePicker({ multiple: true });
for (const h of handles) {
  const file = await h.getFile();
  console.log(file.name, file.size);
}
```

### 读不同格式

`File` 继承自 `Blob`，所以这些方法都可用：

```js
const file = await handle.getFile();

await file.text();           // => 字符串（UTF-8）
await file.arrayBuffer();    // => ArrayBuffer
await file.bytes();          // => Uint8Array (Chrome 121+)
file.stream();               // => ReadableStream（适合大文件）
file.size;                   // 字节
file.name;                   // 文件名
file.lastModified;           // 修改时间戳
file.type;                   // MIME 类型
```

## 保存文件（新文件）

```js
saveBtn.onclick = async () => {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'untitled.txt',
    types: [
      { description: 'Text', accept: { 'text/plain': ['.txt'] } },
    ],
  });

  const writable = await handle.createWritable();
  await writable.write('Hello, world!');
  await writable.close();
};
```

`createWritable()` 返回一个 `FileSystemWritableFileStream`，支持：

```js
const writable = await handle.createWritable({
  keepExistingData: false,  // 是否保留原内容（默认 false 即截断）
});

await writable.write('追加内容');                 // 写字符串
await writable.write(blob);                        // 写 Blob
await writable.write(arrayBuffer);                 // 写二进制
await writable.write({ type: 'write', data, position: 100 });  // 指定偏移
await writable.seek(0);                            // 移动写指针
await writable.truncate(1024);                     // 截断到 1024 字节
await writable.close();                            // 必须 close 才会真正落盘
```

:::warning 必须 close()
`write()` 写的是临时文件，只有 `close()` 才会替换原文件。期间断电的话原文件不会损坏。
:::

## 修改已打开的文件

`showOpenFilePicker` 返回的句柄默认只读。要改它：

```js
const [handle] = await window.showOpenFilePicker();

// 第一次写时会弹出"允许修改？"对话框
const perm = await handle.requestPermission({ mode: 'readwrite' });
if (perm !== 'granted') return;

const writable = await handle.createWritable();
await writable.write('新内容');
await writable.close();
```

## 选择目录

```js
const dir = await window.showDirectoryPicker({
  mode: 'readwrite',  // 'read' / 'readwrite'
});

// 列出第一层
for await (const [name, handle] of dir.entries()) {
  console.log(name, handle.kind);
  // => "README.md" "file"
  // => "src" "directory"
}
```

### 递归遍历

```js
async function* walk(dir, prefix = '') {
  for await (const handle of dir.values()) {
    const path = prefix + handle.name;
    if (handle.kind === 'file') {
      yield { path, handle };
    } else {
      yield* walk(handle, path + '/');
    }
  }
}

const dir = await window.showDirectoryPicker();
for await (const { path, handle } of walk(dir)) {
  console.log(path);
  // => "src/index.js"
  // => "src/utils/format.js"
}
```

### 在目录里创建文件

```js
const file = await dir.getFileHandle('new.txt', { create: true });
const writable = await file.createWritable();
await writable.write('hello');
await writable.close();
```

### 创建子目录

```js
const sub = await dir.getDirectoryHandle('logs', { create: true });
const log = await sub.getFileHandle('today.log', { create: true });
```

### 删除文件

```js
await dir.removeEntry('old.txt');                   // 文件
await dir.removeEntry('temp', { recursive: true }); // 目录
```

## 完整示例：一键打开 + 修改 + 保存

```js
// 高级用法：完整的"打开 - 编辑 - 保存"流程
let currentHandle = null;

document.getElementById('open').onclick = async () => {
  [currentHandle] = await window.showOpenFilePicker({
    types: [{ description: 'Text', accept: { 'text/plain': ['.txt'] } }],
  });
  const text = await (await currentHandle.getFile()).text();
  document.getElementById('editor').value = text;
};

document.getElementById('save').onclick = async () => {
  if (!currentHandle) {
    currentHandle = await window.showSaveFilePicker({
      suggestedName: 'note.txt',
    });
  }

  const perm = await currentHandle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    await currentHandle.requestPermission({ mode: 'readwrite' });
  }

  const writable = await currentHandle.createWritable();
  await writable.write(document.getElementById('editor').value);
  await writable.close();
};
```

## 注意事项

- **Picker 必须在用户手势内调用**：异步回调里调（如 `setTimeout`）会抛 `SecurityError`
- **句柄不能跨 origin 共享**：URL 不同的页面不能用同一个 handle
- **`createWritable` 期间原文件被锁**：移动平台上别在写入期间退出页面，否则可能写一半
- **`startIn` 提示而已**：用户可以无视，去任何目录选文件
