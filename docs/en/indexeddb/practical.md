---
title: "IndexedDB Practical: Offline Notes App"
description: Build an offline-capable notes app with full CRUD and local persistence
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
:::

## Overview

This section ties together everything: open database → define schema → CRUD workflow. Combined with Service Worker for offline capability — notes won't be lost even when offline.

## Database Wrapper

First, wrap a reusable IndexedDB operation class:

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
          store.createIndex('updatedAt', 'updatedAt');
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
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
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

## Frontend Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Offline Notes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui; background: #f5f5f5; min-height: 100vh; }
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
    <h1>Offline Notes</h1>
    <span id="syncStatus">Local Storage</span>
  </header>
  <div class="search-bar">
    <input id="searchInput" placeholder="Search notes..." />
  </div>
  <div id="noteList" class="note-list"></div>
</div>

<div id="editor">
  <div class="editor-box">
    <input id="noteTitle" placeholder="Title" />
    <textarea id="noteContent" placeholder="Content..."></textarea>
    <div class="editor-actions">
      <button class="btn" onclick="closeEditor()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNote()">Save</button>
    </div>
  </div>
</div>

<script type="module">
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

const db = new NotesDB();
await db.open();

let notes = [];
let editingId = null;

const listEl = document.getElementById('noteList');
const searchEl = document.getElementById('searchInput');
const editorEl = document.getElementById('editor');
const titleEl = document.getElementById('noteTitle');
const contentEl = document.getElementById('noteContent');

function render(list) {
  if (!list.length) { listEl.innerHTML = '<div class="empty">No notes yet. Create one!</div>'; return; }
  listEl.innerHTML = list.map(n => `
    <div class="note-card" onclick="openEditor(${n.id})">
      <h3>${escapeHtml(n.title || 'Untitled')}</h3>
      <p>${escapeHtml(n.content || '')}</p>
      <div class="meta">${new Date(n.updatedAt).toLocaleString()}</div>
      <div class="actions" onclick="event.stopPropagation()">
        <button class="btn btn-danger" onclick="deleteNote(${n.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function loadNotes() {
  notes = await db.getAll();
  render(notes);
}

window.openEditor = async (id) => {
  editingId = id;
  const note = await db.get(id);
  titleEl.value = note?.title || '';
  contentEl.value = note?.content || '';
  editorEl.classList.add('open');
  titleEl.focus();
};

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

window.deleteNote = async (id) => { if (confirm('Confirm delete?')) { await db.delete(id); await loadNotes(); } };
window.closeEditor = () => { editorEl.classList.remove('open'); editingId = null; };

searchEl.oninput = async () => {
  const kw = searchEl.value.trim();
  notes = kw ? await db.search(kw) : await db.getAll();
  render(notes);
};

window.addEventListener('offline', () => { document.getElementById('syncStatus').textContent = 'Offline'; document.getElementById('syncStatus').classList.add('offline'); });
window.addEventListener('online', () => { document.getElementById('syncStatus').textContent = 'Local Storage'; document.getElementById('syncStatus').classList.remove('offline'); });

loadNotes();
</script>
</body>
</html>
```

## Service Worker (Offline Support)

Save as `sw.js` and register in the page:

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
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('SW registered'));
  }
</script>
```

## How to Run

```bash
# Serve locally (Service Worker needs HTTPS or localhost)
npx serve .

# Open http://localhost:3000
```

## Notes

- **Service Worker path**: Must be at site root (or configured via `scope`) to cache all-site resources
- **IndexedDB works in SW**: Service Workers can use IndexedDB without extra configuration
- **Updating SW**: After modifying `sw.js`, need to trigger `skipWaiting` + `clients.claim()` to take effect immediately, otherwise wait until all tabs close
- **IndexedDB is asynchronous**: UI updates must wait for `await db.xxx()` to complete before rendering
