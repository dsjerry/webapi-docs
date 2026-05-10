---
title: IndexedDB Overview
description: What IndexedDB is and why it's the go-to browser storage solution
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
All modern browsers support it, including mobile.
:::

## Overview

Browser-side local storage has three paths: `localStorage`, `IndexedDB`, and `Cache API` (with Service Worker). `localStorage` only stores strings, has small capacity, and blocks synchronously; `IndexedDB` is a complete local database.

**IndexedDB** is a browser-native NoSQL database that can store large amounts of structured data locally, supports indexed queries, transactions, and cursor iteration. Data volume can reach hundreds of MB or even GB (depending on disk space).

In short: want to store large amounts of data in the browser, work offline, and query quickly? IndexedDB is the answer.

## Essential Difference from localStorage

| | localStorage | IndexedDB |
|--|-------------|-----------|
| Data type | String only | Any structured-cloneable value (including binary) |
| Capacity | ~5MB | Hundreds of MB to GB |
| API style | Synchronous (blocks main thread) | Asynchronous (Promise / event) |
| Query capability | None (key-only lookup) | Indexes, range queries, cursors |
| Transaction support | None | Atomic operations |
| Use case | Small configs, user preferences | Large business data, offline storage |

## Core Concepts

IndexedDB's data model has four layers:

### 1. Database

A database can contain multiple object stores, similar to MySQL's "database" concept:

```js
// Open database (created automatically if doesn't exist)
const request = indexedDB.open('MyAppDB', 1);
```

### 2. Object Store

Similar to a "table" concept, but each record is an object (JavaScript Object):

```js
// Create in versionchange transaction
db.createObjectStore('users', { keyPath: 'id' });
db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
```

### 3. Index

Creating indexes on object stores enables fast field-based queries, similar to database indexes:

```js
const store = db.createObjectStore('users', { keyPath: 'id' });
store.createIndex('email', 'email', { unique: true });  // query by email
store.createIndex('age', 'age');                        // query by age
```

### 4. Transaction

All read/write operations must occur within a transaction, ensuring atomicity:

```js
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');
store.add({ id: 1, name: 'Alice', email: 'alice@example.com' });
```

## Quick Start

```js
// Open database
const openDB = (name, version) =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });

(async () => {
  const db = await openDB('DemoDB', 1);

  // Write
  const tx = db.transaction('notes', 'readwrite');
  await tx.objectStore('notes').add({ title: 'Hello', content: 'World' });

  // Read (by key)
  const tx2 = db.transaction('notes', 'readonly');
  const req = tx2.objectStore('notes').get(1);
  req.onsuccess = () => console.log(req.result);
})();
```

## Notes

- **API style is old**: Native IndexedDB uses events and request objects with deep nesting; in real projects, use `idb` or `Dexie.js` wrapper libraries
- **Version upgrade is synchronous**: Schema changes in `onupgradeneeded` must be done synchronously, cannot await
- **Transactions cannot span databases**: A transaction can only operate on object stores in the same database
- **Key types**: Primary keys (`keyPath`) can only be strings, dates, numbers, or ArrayBuffer — not objects
