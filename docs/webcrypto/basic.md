---
title: Web Crypto 基础用法
description: 随机数、UUID、哈希、字节与字符串互转
outline: [2, 3]
---

:::tip 浏览器支持
所有现代浏览器，但必须运行在 HTTPS 或 localhost 下。
:::

## 安全随机数

`Math.random()` 不是密码学安全的，做密钥、token、salt 时**不要**用它。用 `crypto.getRandomValues`：

```js
// 生成 16 字节随机数（128 位）
const bytes = new Uint8Array(16);
crypto.getRandomValues(bytes);
// => Uint8Array(16) [203, 17, 88, ...]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `typedArray` | `TypedArray` | 整数类型的数组（`Uint8Array`、`Uint32Array` 等），原地填充 |

返回值就是同一个数组，方便链式：

```js
const buf = crypto.getRandomValues(new Uint8Array(32));
```

:::warning 单次最多 65536 字节
传入更大的数组会抛 `QuotaExceededError`。需要更多就分批生成。
:::

## UUID

需要一个唯一 ID？一行搞定：

```js
crypto.randomUUID();
// => '36b8f84d-df4e-4d49-b662-bcde71a8764f'
```

返回标准 UUID v4 字符串，36 个字符（含连字符）。

:::tip
比 `Date.now() + Math.random()` 这种自制方案更可靠，不会重复。
:::

## 哈希

`crypto.subtle.digest(algorithm, data)` 算单向哈希，永远返回 `ArrayBuffer`：

```js
const data = new TextEncoder().encode('hello world');
const hash = await crypto.subtle.digest('SHA-256', data);
// hash 是 ArrayBuffer，长度 32 字节
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `algorithm` | string | `SHA-1` / `SHA-256` / `SHA-384` / `SHA-512` |
| `data` | `BufferSource` | `ArrayBuffer` 或 `TypedArray` |

### 字节转十六进制

`ArrayBuffer` 没法直接 `console.log` 看，要转字符串：

```js
function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello'));
bufferToHex(hash);
// => '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
```

### 字节转 Base64

需要把哈希塞进 URL 或 JSON？用 Base64 更短：

```js
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

bufferToBase64(hash);
// => 'LPJNulrn8KSt5/i12HOYL/k6BNzgrEXEjBp0w...='
```

### 文件哈希

文件直接读成 `ArrayBuffer` 就能算：

```js
async function fileHash(file) {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hash);
}

// 配合 <input type="file">
input.onchange = async () => {
  const hash = await fileHash(input.files[0]);
  console.log('文件指纹:', hash);
};
```

大文件（>100MB）建议分块读 + 用 [`Blob.stream()`](https://developer.mozilla.org/docs/Web/API/Blob/stream)，但 `digest` 本身不支持流式，得自己实现。

## 字节与字符串互转

加密相关 API 全都吃字节，不吃字符串。这两个工具用得最多：

```js
// 字符串 → Uint8Array（UTF-8）
const bytes = new TextEncoder().encode('你好');
// => Uint8Array(6) [228, 189, 160, 229, 165, 189]

// Uint8Array → 字符串
const text = new TextDecoder().decode(bytes);
// => '你好'
```

`TextEncoder` 只支持 UTF-8，`TextDecoder` 默认 UTF-8（也支持 GBK 等，传第二个参数）。

### 十六进制转字节

哈希值通常是十六进制字符串，需要转回字节：

```js
function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
```

### Base64 转字节

```js
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

## 完整示例：密码哈希

把这套基础组合起来，做一个**带 salt 的密码指纹**：

```js
async function hashPassword(password) {
  // 16 字节随机 salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // password + salt 拼接
  const passwordBytes = new TextEncoder().encode(password);
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes);
  combined.set(salt, passwordBytes.length);

  // 算哈希
  const hash = await crypto.subtle.digest('SHA-256', combined);

  return {
    salt: bufferToHex(salt),
    hash: bufferToHex(hash),
  };
}

await hashPassword('123456');
// => { salt: 'a3f2...', hash: '8d2e...' }
```

:::warning 真实场景请用 PBKDF2
SHA-256 单次哈希对密码来说太快了，攻击者用 GPU 一秒能试上亿次。生产环境必须用 PBKDF2 / Argon2 类**慢哈希**，详见 [进阶用法](./advanced)。
:::

## 注意事项

- **`crypto.subtle` 在 http:// 下是 undefined**：开发时用 localhost 或 https
- **不支持 MD5**：W3C 故意不支持，请用 SHA-256
- **`digest` 不支持流式**：大文件需要全部读到内存，超大文件需要自己分块
- **`Math.random()` 不是密码学安全的**：生成 token、密钥、salt 一律用 `getRandomValues`
- **TextEncoder 只支持 UTF-8**：要 GBK 用 `TextDecoder('gbk')` 解码即可，编码这一侧只能 UTF-8
