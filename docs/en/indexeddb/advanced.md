---
title: IndexedDB Advanced Usage
description: Indexes, cursors, pagination, version migration, performance — making IndexedDB production-ready
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
:::

## Indexed Queries

Indexes are the key to fast querying. Create them in `onupgradeneeded`:

```js
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const store = db.createObjectStore('products', { keyPath: 'id' });

  // Create multiple indexes
  store.createIndex('category', 'category');
  store.createIndex('price', 'price');
  store.createIndex('name', 'name');
  store.createIndex('inStock', 'inStock', { unique: false });
};
```

### Index Query Methods

| Method | Description |
|--------|-------------|
| `index.get(value)` | Exact match, returns first matching record |
| `index.getAll([query])` | Returns all matching records |
| `index.getAllKeys([query])` | Returns only primary keys (more memory-efficient) |
| `index.count([query])` | Returns count of matching records |

```js
const tx = db.transaction('products', 'readonly');
const store = tx.objectStore('products');

// Query all electronics
const index = store.index('category');
const req = index.getAll('electronics');
req.onsuccess = () => console.log(req.result);

// Price range query (100 ~ 500)
const range = IDBKeyRange.bound(100, 500);
const priceIndex = store.index('price');
const priceReq = priceIndex.getAll(range);
priceReq.onsuccess = () => console.log(priceReq.result);
```

## Cursor

Cursors iterate through data more memory-efficiently than `getAll()`:

```js
const tx = db.transaction('products', 'readonly');
const store = tx.objectStore('products');
const index = store.index('price');

// Open cursor, iterate by price ascending
const cursor = index.openCursor(IDBKeyRange.lowerBound(100));

cursor.onsuccess = (event) => {
  const cur = event.target.result;
  if (!cur) return; // iteration complete

  console.log('Product:', cur.value.name, 'Price:', cur.value.price);
  cur.continue();
};
```

### Cursor Direction

```js
index.openCursor(null, 'next');      // default: ascending
index.openCursor(null, 'prev');      // descending
index.openCursor(null, 'nextunique'); // skip duplicates
index.openCursor(null, 'prevunique'); // descending skip duplicates
```

## Key Range (IDBKeyRange)

Exact values, ranges, open/closed intervals freely combined:

```js
const { upperBound, lowerBound, bound, only } = IDBKeyRange;

// only 100
only(100);

// >= 100
lowerBound(100);

// < 500
upperBound(500);

// >= 100 && < 500 (closed interval)
bound(100, 500);

// > 100 && <= 500 (open interval)
bound(100, 500, false, false);
```

## Pagination

Combine cursor with offset for pagination:

```js
async function getPage(storeName, page, pageSize = 10) {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const results = [];
    let skipped = 0;
    const skipCount = (page - 1) * pageSize;

    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) {
        resolve(results);
        return;
      }
      if (skipped < skipCount) {
        skipped++;
        cur.continue();
        return;
      }
      results.push(cur.value);
      if (results.length >= pageSize) {
        resolve(results);
        return;
      }
      cur.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

const page1 = await getPage('products', 1, 10);
const page2 = await getPage('products', 2, 10);
```

## Version Migration

`onupgradeneeded` is the only place for schema migration. Here's a multi-version migration example:

```js
const request = indexedDB.open('MyAppDB', 3); // upgrade to version 3

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  // v1 → v2: add notes store
  if (oldVersion < 2) {
    db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
  }

  // v2 → v3: add age index to users store
  if (oldVersion < 3) {
    if (!db.objectStoreNames.contains('users')) {
      const store = db.createObjectStore('users', { keyPath: 'id' });
      store.createIndex('email', 'email', { unique: true });
    }
    const store = db.objectStore('users');
    if (!store.indexNames.contains('age')) {
      store.createIndex('age', 'age');
    }
  }
};
```

:::warning Cannot await in onupgradeneeded
`onupgradeneeded` is a synchronous callback; you cannot `await` inside it. All schema changes must complete synchronously.
:::

## Batch Operations

Use a single transaction for batch writes to reduce transaction overhead:

```js
const tx = db.transaction('products', 'readwrite');
const store = tx.objectStore('products');

const products = [
  { id: 1, name: 'iPhone', price: 699 },
  { id: 2, name: 'MacBook', price: 1299 },
  { id: 3, name: 'AirPods', price: 199 },
  { id: 4, name: 'iPad', price: 499 },
];

products.forEach((p) => store.put(p));

tx.oncomplete = () => console.log('Batch write complete');
tx.onerror = () => console.error('Batch write failed:', tx.error);
```

## Error Handling

IndexedDB operations may fail due to concurrent upgrade failures, QuotaExceededError, etc.:

```js
request.onerror = (event) => {
  const error = event.target.error;
  if (error.name === 'VersionChangeBlockedError') {
    console.error('Database locked by another tab, close other tabs and retry');
  } else if (error.name === 'QuotaExceededError') {
    console.error('Storage full, clear browser data');
  }
};
```

## Performance Tips

| Recommendation | Reason |
|--------------|--------|
| Batch writes in single transaction | Each transaction has fixed overhead |
| Store large fields as `Blob` | Blob storage is in IndexedDB's separate area, won't block main database |
| Use indexes, not full-table scan | `store.getAll()` scans the entire table; indexed query is O(log n) |
| Close transactions promptly | Long-running transactions block schema upgrades |

## Notes

- **`IDBKeyRange.only()` only matches unique values**: If the index is non-unique, `get()` returns only the first match
- **Index updates are not real-time**: If you modify an indexed field, the index updates automatically; no manual rebuild needed
- **Don't modify store structure during cursor iteration**: Will cause cursor to end unexpectedly
