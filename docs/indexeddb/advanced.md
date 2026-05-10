---
title: IndexedDB 进阶用法
description: 索引、游标、分页、版本迁移、性能优化 — 让 IndexedDB 在生产环境可靠运行
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 8+ · Edge 12+
:::

## 索引查询

索引是快速查询的核心。在 `onupgradeneeded` 中创建：

```js
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const store = db.createObjectStore('products', { keyPath: 'id' });

  // 创建多个索引
  store.createIndex('category', 'category');                  // 普通索引
  store.createIndex('price', 'price');                        // 数值索引（可范围查询）
  store.createIndex('name', 'name');                          // 字符串索引
  store.createIndex('inStock', 'inStock', { unique: false });  // 唯一约束
};
```

### 索引查询方法

| 方法 | 说明 |
|------|------|
| `index.get(value)` | 按索引值精确查询，返回第一条 |
| `index.getAll([query])` | 返回所有匹配的记录 |
| `index.getAllKeys([query])` | 只返回主键，不返回整条记录（更省内存） |
| `index.count([query])` | 返回匹配记录的数量 |

```js
const tx = db.transaction('products', 'readonly');
const store = tx.objectStore('products');

// 查询所有电子产品
const index = store.index('category');
const req = index.getAll('electronics');
req.onsuccess = () => console.log(req.result);

// 价格范围查询（100 ~ 500）
const range = IDBKeyRange.bound(100, 500);
const priceIndex = store.index('price');
const priceReq = priceIndex.getAll(range);
priceReq.onsuccess = () => console.log(priceReq.result);
```

## 游标（Cursor）

游标遍历比 `getAll()` 更省内存，适合大数据集：

```js
const tx = db.transaction('products', 'readonly');
const store = tx.objectStore('products');
const index = store.index('price');

// 打开游标，按价格升序遍历
const cursor = index.openCursor(IDBKeyRange.lowerBound(100));

cursor.onsuccess = (event) => {
  const cur = event.target.result;
  if (!cur) return; // 遍历结束

  console.log('产品:', cur.value.name, '价格:', cur.value.price);
  cur.continue(); // 继续下一条
};
```

### 游标方向

```js
index.openCursor(null, 'next');      // 默认：升序
index.openCursor(null, 'prev');      // 降序
index.openCursor(null, 'nextunique'); // 跳过重复值
index.openCursor(null, 'prevunique'); // 降序跳过重复
```

## 键范围（IDBKeyRange）

精确值、范围、开区间/闭区间自由组合：

```js
const { upperBound, lowerBound, bound, only } = IDBKeyRange;

// 只有 100
only(100);

// >= 100
lowerBound(100);

// < 500
upperBound(500);

// >= 100 && < 500（闭区间）
bound(100, 500);

// > 100 && <= 500（开区间）
bound(100, 500, false, false);
```

## 分页查询

结合游标和偏移量实现分页：

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

const page1 = await getPage('products', 1, 10); // 第 1 页
const page2 = await getPage('products', 2, 10); // 第 2 页
```

## 版本迁移

`onupgradeneeded` 是做 schema 迁移的唯一地方。以下是一个多版本迁移示例：

```js
const request = indexedDB.open('MyAppDB', 3); // 升级到版本 3

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion; // 升级前的版本号

  // v1 → v2：新增 notes 仓库
  if (oldVersion < 2) {
    db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
  }

  // v2 → v3：在 users 仓库新增 age 索引
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

:::warning onupgradeneeded 里不能 await
`onupgradeneeded` 是同步回调，不能在里面 `await`。所有 schema 变更必须同步完成。
:::

## 批量操作

用一条事务批量写入，减少事务开销：

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

tx.oncomplete = () => console.log('批量写入完成');
tx.onerror = () => console.error('批量写入失败:', tx.error);
```

## 错误处理与重试

IndexedDB 操作可能因并发升级失败、Quota 超限等原因报错：

```js
const request = indexedDB.open('MyAppDB', 1);

request.onerror = (event) => {
  const error = event.target.error;
  if (error.name === 'VersionChangeBlockedError') {
    console.error('数据库被其他标签页锁定，关闭其他标签页重试');
  } else if (error.name === 'QuotaExceededError') {
    console.error('存储空间不足，清理浏览器数据');
  }
};
```

## 性能建议

| 建议 | 原因 |
|------|------|
| 批量写入用单条事务 | 每条事务有固定开销 |
| 大字段存为 `Blob` | Blob 存储在 IndexedDB 的独立区域，不会阻塞主数据库 |
| 查询用索引不用全表扫描 | `store.getAll()` 会遍历全表，索引查询 O(log n) |
| 及时关闭事务 | 长时间开启的事务会阻塞 schema 升级 |

## 存储配额管理

浏览器给每个源（origin）分配一块共享存储池（IndexedDB / Cache / FileSystem 共用），超额会触发 `QuotaExceededError`。**默认存储是"尽力而为"——浏览器空间不足时可能直接清掉你的数据**。

### 查看当前用量

```js
const { usage, quota } = await navigator.storage.estimate();
// => { usage: 12_345_678, quota: 10_737_418_240 }

const percent = (usage / quota * 100).toFixed(2);
console.log(`已用 ${(usage / 1e6).toFixed(1)}MB / ${(quota / 1e9).toFixed(1)}GB (${percent}%)`);
```

| 字段 | 说明 |
|------|------|
| `usage` | 当前已用字节（所有 storage 加总） |
| `quota` | 浏览器分配的总配额（通常是磁盘剩余空间的 60%） |

### 申请持久化存储

默认数据可能被浏览器悄悄清掉。把它升级为 **persistent**，用户主动清理之前永远保留：

```js
// 必须在用户交互后调用
const granted = await navigator.storage.persist();
// => true / false（部分浏览器需要"被收藏"或"PWA 安装"才会授予）

// 检查当前是否已持久化
const isPersisted = await navigator.storage.persisted();
```

| 浏览器 | 持久化策略 |
|--------|-----------|
| Chrome | 自动判断（被频繁访问 / 安装为 PWA / 已通知权限） |
| Firefox | 弹窗询问用户 |
| Safari | iOS 7 天不访问会清空，配额很小 |

:::warning Safari 限制
iOS Safari 的 IndexedDB 配额只有约 1GB（设备总空间的 1/4），且 7 天未访问的站点数据可能被清理。重要数据建议引导用户"添加到主屏幕"。
:::

## 三库对比：原生 / idb / Dexie

原生 API 写起来啰嗦，社区有两个主流封装：

| | 原生 IndexedDB | [`idb`](https://github.com/jakearchibald/idb) | [`Dexie.js`](https://dexie.org/) |
|--|------|------|------|
| 体积 | 0KB | ~3KB gzip | ~25KB gzip |
| API 风格 | 事件 + Request | 全 Promise（薄封装） | 全 Promise + 链式 |
| 学习成本 | 高 | 低（API 几乎一致） | 中（自有 DSL） |
| 查询能力 | 手写游标 | 手写游标 | 链式 `.where().above().toArray()` |
| TypeScript | 内置 | 内置 | 内置 |
| 适用场景 | 极简项目 / 想完全控制 | 想要 Promise 的薄封装 | 大型应用 / 复杂查询 |

```js
// === 原生 ===
const tx = db.transaction('users', 'readonly');
const req = tx.objectStore('users').get(1);
req.onsuccess = () => console.log(req.result);

// === idb ===
import { openDB } from 'idb';
const db = await openDB('MyAppDB', 1);
const user = await db.get('users', 1);

// === Dexie ===
import Dexie from 'dexie';
const db = new Dexie('MyAppDB');
db.version(1).stores({ users: '&id, email, age' });
const adults = await db.users.where('age').above(18).toArray();
```

**怎么选**：

- **试验型代码 / 教学**：用原生，理解机制
- **业务项目，少量查询**：用 `idb`，几乎零迁移成本
- **大型应用，复杂条件查询**：用 `Dexie`，省下大量手写游标的时间

## 注意事项

- **`IDBKeyRange.only()` 只能匹配唯一值**：如果索引不唯一，`get()` 只返回第一条
- **索引更新不是实时的**：如果修改了记录中已建索引的字段，索引会自动更新，不需要手动重建
- **游标遍历期间不要修改仓库结构**：会导致游标意外结束
