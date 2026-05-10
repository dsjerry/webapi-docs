---
title: IndexedDB 概述
description: IndexedDB 是什么，为什么它是浏览器存储的首选方案
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
所有现代浏览器均已支持，包括移动端。
:::

## 概述

浏览器端本地存储方案有三条路：`localStorage`、`IndexedDB`、以及 `Cache API`（配合 Service Worker）。其中 `localStorage` 只存字符串、容量小、同步阻塞；`IndexedDB` 则是一个完整的本地数据库。

**IndexedDB** 是浏览器内置的 NoSQL 数据库，可以在本地存储大量结构化数据，支持索引查询、事务、游标遍历，数据量可达数百 MB 甚至 GB 级别（取决于磁盘空间）。

简单说：你想在浏览器里存大量数据、离线可用、快速查询？IndexedDB 就是答案。

## 和 localStorage 的核心区别

| | localStorage | IndexedDB |
|--|-------------|-----------|
| 数据类型 | 仅字符串 | 任何可结构化克隆的值（含二进制） |
| 容量 | ~5MB | 数百 MB 至 GB 级 |
| API 风格 | 同步（阻塞主线程） | 异步（Promise / 事件） |
| 查询能力 | 无（只能按 key） | 支持索引、范围查询、游标 |
| 事务支持 | 无 | 支持原子操作 |
| 适用场景 | 小配置、用户偏好 | 大量业务数据、离线存储 |

## 快速上手

<!-- 快速上手：增删改查全流程 -->
```js
// 打开数据库
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

const db = await openDB('DemoDB', 1);

// 写
const tx = db.transaction('notes', 'readwrite');
tx.objectStore('notes').add({ title: 'Hello', content: 'World' });

// 读（按 key）
const tx2 = db.transaction('notes', 'readonly');
const req = tx2.objectStore('notes').get(1);
req.onsuccess = () => req.result;
// => { id: 1, title: 'Hello', content: 'World' }
```

## 核心概念

IndexedDB 的数据模型分为四层：

### 1. 数据库（Database）

一个数据库可以包含多个对象仓库，类似 MySQL 的"数据库"概念：

```js
// 打开数据库（如果不存在则自动创建）
const request = indexedDB.open('MyAppDB', 1);
```

### 2. 对象仓库（Object Store）

类似"表"的概念，但每条记录是一个对象（JavaScript Object）：

```js
// 在 versionchange 事务中创建
db.createObjectStore('users', { keyPath: 'id' });
db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
```

### 3. 索引（Index）

在对象仓库上建索引，可以按字段快速查询，类似数据库的索引：

```js
const store = db.createObjectStore('users', { keyPath: 'id' });
store.createIndex('email', 'email', { unique: true });  // 按邮箱查
store.createIndex('age', 'age');                        // 按年龄查
```

### 4. 事务（Transaction）

所有读写操作必须在事务内进行，保证原子性：

```js
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');
store.add({ id: 1, name: 'Alice', email: 'alice@example.com' });
```

## 注意事项

- **API 风格旧**：IndexedDB 原生 API 用事件和请求对象，代码嵌套深；生产项目建议选 `idb` 或 `Dexie.js`，详见[进阶用法的三库对比](./advanced#三库对比-原生-idb-dexie)
- **版本升级是同步的**：`onupgradeneeded` 回调里做 schema 变更，必须同步完成，不能异步等待
- **事务不能跨数据库**：一个事务只能操作同一个数据库里的对象仓库
- **键类型**：主键（keyPath）只能是字符串、日期、数字或 ArrayBuffer，不能是对象
