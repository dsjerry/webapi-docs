---
title: 实战：端到端加密笔记
description: 从零实现一个本地加密笔记应用，主密码派生密钥，AES-GCM 加密内容
outline: [2, 3]
---

:::tip 场景
做一个"主密码 + 本地加密"的笔记应用：用户输入主密码，所有笔记用 AES-GCM 加密后存进 IndexedDB。即便有人偷走数据库文件，没主密码也看不到任何内容。
:::

## 需求拆解

- **主密码** → PBKDF2 派生 AES-GCM 主密钥
- **每条笔记**用主密钥加密，单独的随机 IV
- **salt 和密文**存在 IndexedDB，主密钥**只在内存中**
- 用户关闭页面 → 主密钥消失 → 数据自动锁定

## 完整代码

整个应用一个文件搞定，不到 150 行。

### HTML 框架

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>加密笔记</title>
  <style>
    body { max-width: 600px; margin: 2rem auto; font-family: sans-serif; }
    textarea { width: 100%; height: 100px; }
    .note { border: 1px solid #ccc; padding: 0.5rem; margin: 0.5rem 0; }
  </style>
</head>
<body>
  <h1>加密笔记</h1>

  <div id="lock">
    <input id="pwd" type="password" placeholder="主密码">
    <button id="unlock">解锁</button>
  </div>

  <div id="app" hidden>
    <textarea id="content" placeholder="写点什么..."></textarea>
    <button id="save">保存</button>
    <button id="lockBtn">锁定</button>
    <div id="list"></div>
  </div>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

### 加密工具（crypto.js）

```js
// === crypto.js ===
// 高级用法：主密码 → AES-GCM 主密钥
const PBKDF2_ITERATIONS = 600_000;

export async function deriveMasterKey(password, salt) {
  const pwdKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    pwdKey,
    { name: 'AES-GCM', length: 256 },
    false,                        // 不可导出，更安全
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

export async function decrypt(key, iv, ciphertext) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

### 数据库工具（db.js）

```js
// === db.js ===
// 用 IndexedDB 存 salt 和密文笔记
const DB_NAME = 'cryptoNotes';
const VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSalt(db) {
  return new Promise((resolve) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get('salt');
    req.onsuccess = () => resolve(req.result?.value);
  });
}

export async function setSalt(db, salt) {
  return new Promise((resolve) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key: 'salt', value: salt });
    tx.oncomplete = () => resolve();
  });
}

export async function listNotes(db) {
  return new Promise((resolve) => {
    const tx = db.transaction('notes', 'readonly');
    const req = tx.objectStore('notes').getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

export async function addNote(db, note) {
  return new Promise((resolve) => {
    const tx = db.transaction('notes', 'readwrite');
    tx.objectStore('notes').add(note);
    tx.oncomplete = () => resolve();
  });
}
```

### 主应用（app.js）

```js
// === app.js ===
// 主流程：解锁 → 解密历史 → 加密保存 → 锁定
import { deriveMasterKey, encrypt, decrypt } from './crypto.js';
import { openDB, getSalt, setSalt, listNotes, addNote } from './db.js';

const db = await openDB();
let masterKey = null;     // 内存中的主密钥

document.getElementById('unlock').onclick = async () => {
  const password = document.getElementById('pwd').value;
  if (!password) return;

  // 第一次使用，生成 salt
  let salt = await getSalt(db);
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    await setSalt(db, salt);
  }

  // 派生主密钥
  masterKey = await deriveMasterKey(password, salt);

  // 尝试解密第一条笔记验证密码
  const notes = await listNotes(db);
  if (notes.length > 0) {
    try {
      await decrypt(masterKey, notes[0].iv, notes[0].ciphertext);
    } catch {
      masterKey = null;
      alert('密码错误');
      return;
    }
  }

  document.getElementById('lock').hidden = true;
  document.getElementById('app').hidden = false;
  await render();
};

document.getElementById('save').onclick = async () => {
  const text = document.getElementById('content').value;
  if (!text) return;

  const { iv, ciphertext } = await encrypt(masterKey, text);
  await addNote(db, { iv, ciphertext, createdAt: Date.now() });

  document.getElementById('content').value = '';
  await render();
};

document.getElementById('lockBtn').onclick = () => {
  masterKey = null;
  document.getElementById('list').innerHTML = '';
  document.getElementById('app').hidden = true;
  document.getElementById('lock').hidden = false;
  document.getElementById('pwd').value = '';
};

async function render() {
  const notes = await listNotes(db);
  const list = document.getElementById('list');
  list.innerHTML = '';

  for (const note of notes) {
    const text = await decrypt(masterKey, note.iv, note.ciphertext);
    const div = document.createElement('div');
    div.className = 'note';
    div.textContent = text;
    list.appendChild(div);
  }
}
```

## 测试

1. 把三个文件放到一个目录，起一个本地服务（`npx serve` 或 VS Code Live Server）
2. 用 HTTPS 或 `http://localhost` 打开（**必须**——`http://` + IP 拿不到 `crypto.subtle`）
3. 输入主密码 `123456` → 解锁
4. 写几条笔记 → 保存
5. 刷新页面 → 重新输入密码 → 笔记还在
6. 故意输错密码 → 弹"密码错误"
7. 打开 DevTools → Application → IndexedDB → 看到的全是乱码（密文）

## 安全分析

这套方案能挡住什么、挡不住什么：

| 威胁 | 是否能防 |
|------|---------|
| 别人拿到电脑读 IndexedDB | ✅ 能防（没密码看不到内容） |
| 暴力破解主密码 | ✅ 能防（PBKDF2 60 万次迭代，每次试错都很慢） |
| 嗅探网络流量 | ✅ 不涉及网络（纯本地） |
| 用户用 `123` 当主密码 | ❌ 防不住（弱密码无解） |
| 浏览器被木马完全控制 | ❌ 防不住（内存中的 masterKey 会泄露） |
| 钓鱼网站冒充本应用 | ❌ 防不住（要靠 HTTPS + 域名识别） |

## 可以怎么扩展

- **修改密码**：用旧密码解密所有笔记 → 用新密码重新加密 → 更新 salt
- **多设备同步**：把每条 `{ iv, ciphertext }` 上传服务器，服务器只见密文
- **分享单条笔记**：再加一对 ECDH 密钥，和接收方协商共享密钥
- **不可导出主密钥**：例子里设了 `false`，已经做到这一点
- **闲置自动锁定**：监听 `visibilitychange` 或加个定时器，超时清空 `masterKey`

## 常见排错

| 现象 | 原因 |
|------|------|
| `crypto.subtle is undefined` | 不在安全上下文（`http://` 非 localhost）；或在 Web Worker 里要用 `self.crypto.subtle` |
| `importKey` 抛 `InvalidAccessError` | `usages` 数组和算法不匹配，比如 AES-GCM 写了 `['sign']` |
| `decrypt` 抛 `OperationError` | 密钥错了、IV 错了、密文被改过任意一个字节都会抛同一种错（GCM 防篡改特性） |
| `deriveKey` 卡 1-2 秒 | PBKDF2 60 万次迭代本身就慢，UI 上要给 loading 提示 |
| 不同浏览器导出的 JWK 格式略有差异 | `key_ops` 顺序、`alg` 字段是否带都可能不同；不要做字符串比对，只比较关键字段 |
| RSA-OAEP 加密大数据报错 | RSA 不能加密超过密钥长度的数据，用信封加密（RSA 加密 AES key + AES 加密数据） |

## 注意事项

- **页面必须 HTTPS 或 localhost**：否则 `crypto.subtle` 是 undefined
- **`masterKey` 不要存任何持久层**：localStorage、IndexedDB、cookie 都不行——只在内存
- **PBKDF2 派生很慢**：60 万次迭代在低端手机上要 1-2 秒，UI 上要给 loading 提示
- **数据库也要兜底加密**：如果用户用了浏览器同步，IndexedDB 内容不一定真的"只在本地"
- **没有"忘记密码"流程**：加密笔记的本质就是密钥唯一，丢了就是丢了——产品上要明确告知用户

## 延伸阅读

- [IndexedDB：基础用法](/indexeddb/basic) — 持久化存储密文笔记的 store/事务用法
- [Web Crypto：进阶用法](/webcrypto/advanced#不要用-web-crypto-做用户认证) — 做登录认证请用 WebAuthn 而不是自己造轮子
- [Web Worker：基础用法](/webworker/basic) — PBKDF2 等慢操作扔进 Worker 避免卡 UI
