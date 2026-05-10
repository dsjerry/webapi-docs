---
title: Web Crypto 概述
description: Web Crypto API 是什么，为什么不要再用 crypto-js
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 37+ · Firefox 34+ · Safari 11+ · Edge 79+
**必须运行在安全上下文（HTTPS 或 localhost）**，否则 `crypto.subtle` 是 `undefined`。
:::

## 概述

加密这种事，过去要么自己用 JS 实现一套（慢且容易出错），要么引入 `crypto-js` 这类库（包大、未必安全）。**Web Crypto API** 让浏览器原生支持加密：哈希、AES、RSA、ECDSA、HMAC、PBKDF2 全都能直接调用，性能接近原生代码，且默认拒绝弱算法。

简单说：你想加密、解密、签名、生成随机密钥？不用装包，浏览器自带。

## 和第三方库的本质区别

| | crypto-js / js-md5 | Web Crypto API |
|--|--|--|
| 实现 | 纯 JS | 浏览器原生 C++ |
| 性能 | 慢（10x-100x） | 快 |
| 包体积 | 几十 KB | 0 KB |
| 安全审计 | 看作者良心 | 浏览器厂商负责 |
| 弱算法 | MD5 / SHA1 任你用 | SHA-1 限制使用，MD5 不支持 |
| API 风格 | 同步 | 异步（Promise） |
| 密钥管理 | 字符串 | `CryptoKey` 对象（可设为不可导出） |

## 快速上手

<!-- 快速上手：算 SHA-256 哈希 -->
```js
// 把字符串编码成字节，算 SHA-256
const data = new TextEncoder().encode('hello world');
const hashBuffer = await crypto.subtle.digest('SHA-256', data);

// 转十六进制字符串
const hex = [...new Uint8Array(hashBuffer)]
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

// => b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
```

整个 API 都是 Promise，记得 `await`。

## 核心概念

### crypto 与 crypto.subtle

`window.crypto` 是入口对象，分两层：

```js
crypto.getRandomValues(buf);   // 同步，安全随机数
crypto.randomUUID();           // 同步，生成 UUID v4
crypto.subtle.digest(...);     // 异步，所有真正的加密操作
```

简单的随机数和 UUID 是同步的；只要涉及密钥或算法，就走 `crypto.subtle`，全部返回 Promise。

### SubtleCrypto

`crypto.subtle` 提供 8 类核心方法：

| 方法 | 用途 |
|------|------|
| `digest()` | 哈希（SHA-256 / SHA-384 / SHA-512） |
| `generateKey()` | 生成对称或非对称密钥 |
| `importKey()` / `exportKey()` | 密钥导入导出 |
| `encrypt()` / `decrypt()` | 加解密 |
| `sign()` / `verify()` | 数字签名与验签 |
| `deriveKey()` / `deriveBits()` | 从密码派生密钥（PBKDF2、HKDF） |
| `wrapKey()` / `unwrapKey()` | 用密钥加密另一个密钥 |

### CryptoKey

密钥不是字符串，而是一个不透明的 `CryptoKey` 对象：

```js
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,        // extractable：是否可导出
  ['encrypt', 'decrypt']  // usages：可以做哪些操作
);

key.type;        // => 'secret'
key.algorithm;   // => { name: 'AES-GCM', length: 256 }
key.extractable; // => true
key.usages;      // => ['encrypt', 'decrypt']
```

设 `extractable: false` 后，密钥永远不能被读出来——连开发者工具都拿不到。

### 算法标识

每个方法的第一个参数都是**算法标识**，可以是字符串或对象：

```js
// 简单算法：字符串就够
crypto.subtle.digest('SHA-256', data);

// 复杂算法：对象，带参数
crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: ivBytes },
  key,
  data
);
```

常用算法名称：

| 类别 | 算法 |
|------|------|
| 哈希 | `SHA-256`、`SHA-384`、`SHA-512` |
| 对称加密 | `AES-GCM`、`AES-CBC`、`AES-CTR` |
| 非对称加密 | `RSA-OAEP` |
| 签名 | `RSASSA-PKCS1-v1_5`、`RSA-PSS`、`ECDSA` |
| MAC | `HMAC` |
| 密钥派生 | `PBKDF2`、`HKDF` |

### 二进制数据

Web Crypto **只接受 `ArrayBuffer` 或 `TypedArray`**，不接受字符串。所以套路总是：

```js
// 字符串 → 字节
const bytes = new TextEncoder().encode('hello');

// 字节 → 字符串
const text = new TextDecoder().decode(bytes);
```

## 注意事项

- **必须 HTTPS**：`crypto.subtle` 在非安全上下文（http://）下为 `undefined`，`localhost` 例外
- **全部异步**：除了 `getRandomValues` 和 `randomUUID`，每个方法都返回 Promise
- **没有 MD5**：W3C 故意不支持。MD5 已不安全，需要请用 SHA-256
- **SHA-1 受限**：仍能算 `digest('SHA-1', ...)`，但不能用于签名等安全相关操作
- **不要自己造算法组合**：直接用 `AES-GCM`，别尝试 AES-CBC + HMAC 这种"自己拼接"的方案
