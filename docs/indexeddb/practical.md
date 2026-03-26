---
title: IndexedDB 实战：离线笔记应用
description: 从零实现一个离线可用的笔记应用，支持增删改查、本地持久化
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
:::

## 概述

这一节把前面的知识串联起来：打开数据库 → 定义 schema → 增删改查全流程。配合 Service Worker 实现离线可用——即使断网，笔记也不会丢失。

## 数据库封装

首先封装一个可复用的 IndexedDB 操作类：

```js
// === db.js ===

class NotesDB {
  constructor(name = 'NotesApp', version = 1) {
    this.dbName = name;
    this.dbVersion = version;
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('updatedAt', 'updatedAt'); // 按更新时间排序
          store.createIndex('title', 'title', { unique: false });
        }
      };

      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      req.onerror = () => reject(req.error);
    });
  }

  _tx(mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notes', mode);
      const store = tx.objectStore('notes');
      const req = callback(store);
      req ? (req.onsuccess = () => resolve(req.result)) : resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async add(note) {
    const now = Date.now();
    return this._tx('readwrite', (s) =>
      s.add({ ...note, createdAt: now, updatedAt: now })
    );
  }

  async update(note) {
    return this._tx('readwrite', (s) =>
      s.put({ ...note, updatedAt: Date.now() })
    );
  }

  async delete(id) {
    return this._tx('readwrite', (s) => s.delete(id));
  }

  async get(id) {
    return this._tx('readonly', (s) => s.get(id));
  }

  async getAll() {
    const all = await this._tx('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt); // 最新优先
  }

  async search(keyword) {
    const all = await this.getAll();
    const kw = keyword.toLowerCase();
    return all.filter(
      (n) =>
        n.title.toLowerCase().includes(kw) ||
        (n.content || '').toLowerCase().includes(kw)
    );
  }
}

const db = new NotesDB();
await db.open();
```

## 前端页面

<!-- index.html -->
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>离线笔记</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Noto Sans SC", sans-serif; background: #f5f5f5; min-height: 100vh; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    h1 { font-size: 1.5rem; color: #333; }
    #syncStatus { font-size: 0.8rem; padding: 4px 10px; border-radius: 12px; background: #4ade80; color: #fff; }
    #syncStatus.offline { background: #f43f5e; }
    .search-bar { margin-bottom: 16px; }
    .search-bar input { width: 100%; padding: 10px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
    .note-list { display: flex; flex-direction: column; gap: 12px; }
    .note-card { background: #fff; border-radius: 8px; padding: 16px; cursor: pointer; transition: box-shadow 0.2s; }
    .note-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .note-card h3 { font-size: 1rem; margin-bottom: 4px; color: #333; }
    .note-card p { font-size: 0.85rem; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .note-card .meta { font-size: 0.75rem; color: #999; margin-top: 8px; }
    .note-card .actions { display: flex; gap: 8px; margin-top: 8px; }
    .btn { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
    .btn-primary { background: #646cff; color: #fff; }
    .btn-danger { background: #f43f5e; color: #fff; }
    /* 编辑模态框 */
    #editor { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 100; }
    #editor.open { display: flex; }
    .editor-box { background: #fff; border-radius: 12px; padding: 24px; width: 90%; max-width: 600px; }
    .editor-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; margin-bottom: 12px; }
    .editor-box textarea { width: 100%; height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; resize: vertical; font-size: 0.9rem; }
    .editor-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
    .empty { text-align: center; color: #999; padding: 48px; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>离线笔记</h1>
    <span id="syncStatus">本地存储</span>
  </header>
  <div class="search-bar">
    <input id="searchInput" placeholder="搜索笔记..." />
  </div>
  <div id="noteList" class="note-list"></div>
</div>

<!-- 编辑模态框 -->
<div id="editor">
  <div class="editor-box">
    <input id="noteTitle" placeholder="标题" />
    <textarea id="noteContent" placeholder="正文..."></textarea>
    <div class="editor-actions">
      <button class="btn" onclick="closeEditor()">取消</button>
      <button class="btn btn-primary" onclick="saveNote()">保存</button>
    </div>
  </div>
</div>

<script type="module">
// === db.js ===
class NotesDB {
  constructor(name = 'NotesApp', version = 1) {
    this.dbName = name; this.dbVersion = version; this.db = null;
  }
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('updatedAt', 'updatedAt');
          store.createIndex('title', 'title', { unique: false });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  }
  _tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notes', mode);
      const store = tx.objectStore('notes');
      const req = fn(store);
      req ? req.onsuccess = () => resolve(req.result) : resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  add(note) { return this._tx('readwrite', s => s.add({ ...note, createdAt: Date.now(), updatedAt: Date.now() })); }
  update(note) { return this._tx('readwrite', s => s.put({ ...note, updatedAt: Date.now() })); }
  delete(id) { return this._tx('readwrite', s => s.delete(id)); }
  get(id) { return this._tx('readonly', s => s.get(id)); }
  getAll() { return this._tx('readonly', s => s.getAll()).then(all => all.sort((a,b) => b.updatedAt - a.updatedAt)); }
  search(kw) { return this.getAll().then(all => { const k = kw.toLowerCase(); return all.filter(n => n.title.toLowerCase().includes(k) || (n.content||'').toLowerCase().includes(k)); }); }
}

// === UI 逻辑 ===
const db = new NotesDB();
await db.open();

let notes = [];
let editingId = null;

const listEl = document.getElementById('noteList');
const searchEl = document.getElementById('searchInput');
const editorEl = document.getElementById('editor');
const titleEl = document.getElementById('noteTitle');
const contentEl = document.getElementById('noteContent');

// 渲染笔记列表
function render(list) {
  if (!list.length) { listEl.innerHTML = '<div class="empty">还没有笔记，创建一个吧</div>'; return; }
  listEl.innerHTML = list.map(n => `
    <div class="note-card" onclick="openEditor(${n.id})">
      <h3>${escapeHtml(n.title || '无标题')}</h3>
      <p>${escapeHtml(n.content || '')}</p>
      <div class="meta">${new Date(n.updatedAt).toLocaleString()}</div>
      <div class="actions" onclick="event.stopPropagation()">
        <button class="btn btn-danger" onclick="deleteNote(${n.id})">删除</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function loadNotes() {
  notes = await db.getAll();
  render(notes);
}

// 新建笔记
window.newNote = () => { editingId = null; titleEl.value = ''; contentEl.value = ''; editorEl.classList.add('open'); titleEl.focus(); };

// 打开已有笔记
window.openEditor = async (id) => {
  editingId = id;
  const note = await db.get(id);
  titleEl.value = note?.title || '';
  contentEl.value = note?.content || '';
  editorEl.classList.add('open');
  titleEl.focus();
};

// 保存笔记
window.saveNote = async () => {
  const title = titleEl.value.trim();
  const content = contentEl.value.trim();
  if (!title && !content) { closeEditor(); return; }
  const note = { title, content };
  if (editingId) { note.id = editingId; await db.update(note); }
  else { await db.add(note); }
  closeEditor();
  await loadNotes();
};

// 删除笔记
window.deleteNote = async (id) => { if (confirm('确认删除？')) { await db.delete(id); await loadNotes(); } };

// 关闭编辑器
window.closeEditor = () => { editorEl.classList.remove('open'); editingId = null; };

// 搜索
searchEl.oninput = async () => {
  const kw = searchEl.value.trim();
  notes = kw ? await db.search(kw) : await db.getAll();
  render(notes);
};

// 离线状态
window.addEventListener('offline', () => { document.getElementById('syncStatus').textContent = '离线模式'; document.getElementById('syncStatus').classList.add('offline'); });
window.addEventListener('online', () => { document.getElementById('syncStatus').textContent = '本地存储'; document.getElementById('syncStatus').classList.remove('offline'); });

// 初始加载
loadNotes();
</script>
</body>
</html>
```

## Service Worker（离线支持）

将以下文件保存为 `sw.js`，在页面中注册：

```js
// === sw.js ===
const CACHE_NAME = 'notes-v1';
const urlsToCache = ['/index.html', '/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
  ));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});
```

```html
<!-- 在 index.html 中注册 Service Worker -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('SW 已注册'));
  }
</script>
```

## 如何运行

```bash
# 起一个本地服务器（Service Worker 需要 HTTPS 或 localhost）
npx serve .

# 打开 http://localhost:3000
```

## 注意事项

- **Service Worker 路径**：必须在网站根目录（或通过 `scope` 配置）才能缓存全站资源
- **IndexedDB 在 SW 中可用**：Service Worker 中可以使用 IndexedDB，不需要额外配置
- **更新 SW**：修改 `sw.js` 后需要触发 `skipWaiting` + `clients.claim()` 才能立即生效，否则要等所有标签页关闭
- **IndexedDB 是异步的**：UI 更新要等 `await db.xxx()` 完成后再渲染
