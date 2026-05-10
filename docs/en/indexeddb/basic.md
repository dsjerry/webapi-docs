---
title: IndexedDB Basic Usage
description: Opening a database, CRUD operations — core IndexedDB operations
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
:::

## Opening a Database

`indexedDB.open()` returns a request object; get the database instance via `onsuccess`:

```js
const request = indexedDB.open('MyAppDB', 1);

// Triggered on database version upgrade (also on first creation)
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  console.log('Database version:', db.version);
};

// Successfully opened
request.onsuccess = (event) => {
  const db = event.target.result;
  console.log('Database opened');
};

// Error
request.onerror = (event) => {
  console.error('Failed to open database:', event.target.error);
};
```

:::warning Version numbers can only increase
The version number passed each time you open the database must be >= current version. `onupgradeneeded` is called during upgrade. Version numbers can only go up, not down.
:::

## Creating Object Stores

Create object stores in the `onupgradeneeded` callback:

```js
request.onupgradeneeded = (event) => {
  const db = event.target.result;

  // Create users store, primary key is id
  if (!db.objectStoreNames.contains('users')) {
    const store = db.createObjectStore('users', { keyPath: 'id' });
    // Create indexes on the id field
    store.createIndex('email', 'email', { unique: true });
    store.createIndex('name', 'name');
  }
};
```

### keyPath vs autoIncrement

| Option | Description |
|--------|-------------|
| `keyPath: 'id'` | Primary key from a field of the record object, must be unique |
| `autoIncrement: true` | Primary key auto-generated integer (starting from 1), not needed in record |

Choose one; they cannot be used together.

## Add (Add / Put)

```js
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');

// add: errors on duplicate primary key
store.add({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 });

// put: overwrites on duplicate primary key (upsert behavior)
store.put({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30 });

// Promise wrapper
const add = (store, data) =>
  new Promise((resolve, reject) => {
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
```

## Get (Read)

```js
const tx = db.transaction('users', 'readonly');
const store = tx.objectStore('users');

// Get one by primary key
const req1 = store.get(1);
req1.onsuccess = () => console.log(req1.result);

// Get all
const req2 = store.getAll();
req2.onsuccess = () => console.log(req2.result);

// For fuzzy query, use index first
const index = store.index('email');
const req3 = index.get('alice@example.com');
req3.onsuccess = () => console.log(req3.result);
```

## Update (Put)

```js
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');

// Overwrite entire record (primary key field must be included)
store.put({ id: 1, name: 'Alice Updated', email: 'alice@example.com', age: 26 });
```

## Delete

```js
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');

// Delete one by primary key
store.delete(1);

// Clear entire store
store.clear();
```

## Transaction Helper

Native IndexedDB API is cumbersome. Here's a Promise wrapper:

```js
function dbOperation(db, storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = operation(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {};
    tx.onerror = () => reject(tx.error);
  });
}

// Usage
const db = await openDB('MyAppDB', 1);
await dbOperation(db, 'users', 'readwrite', (s) => s.add({ id: 1, name: 'Alice' }));
const user = await dbOperation(db, 'users', 'readonly', (s) => s.get(1));
```

:::tip Use wrapper libraries
The above wrapper is already simplified, but real projects still recommend `Dexie.js` or `idb` — they fully Promise-wrap IndexedDB with very friendly APIs.
:::

## Notes

- **Every operation needs `db.transaction()`**: Transactions auto-commit after all operations complete; no manual commit needed
- **Transactions must stay alive**: If you `await` async operations inside a transaction callback, the transaction may close (browser transaction timeout)
- **keyPath cannot be modified**: To "update" a primary key, delete the old record and add a new one
