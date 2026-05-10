---
title: Web Crypto 进阶用法
description: 对称加密、非对称加密、签名验签、密钥派生与导入导出
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 37+ · Firefox 34+ · Safari 11+ · Edge 79+
:::

## 对称加密：AES-GCM

对称加密用同一个密钥加密和解密。日常加密**优先选 AES-GCM**——它在加密的同时附带消息认证（防篡改），比 AES-CBC 更安全。

### 生成密钥

```js
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },  // 256 位最强
  true,                               // 可导出
  ['encrypt', 'decrypt']
);
// key 是一个 CryptoKey 对象
```

| `length` | 安全级别 | 备注 |
|----------|---------|------|
| 128 | 推荐 | 速度最快 |
| 192 | 中等 | 很少用 |
| 256 | 最强 | 推荐 |

### 加密

AES-GCM 必须配一个 **IV（初始化向量）**——12 字节随机数，**每次加密都要新生成**，绝不能复用：

```js
const iv = crypto.getRandomValues(new Uint8Array(12));
const plaintext = new TextEncoder().encode('秘密消息');

const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  plaintext
);
// ciphertext 是 ArrayBuffer，比 plaintext 多 16 字节（认证标签）
```

:::danger IV 不能复用
同一个密钥用同一个 IV 加密两条不同的消息，AES-GCM 的安全性就**完全崩溃**。每次都用 `crypto.getRandomValues` 重新生成。
:::

### 解密

解密时需要**同一个 key + 同一个 iv**：

```js
const decrypted = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv },
  key,
  ciphertext
);

new TextDecoder().decode(decrypted);
// => '秘密消息'
```

如果密文被篡改了一个字节，`decrypt` 会直接抛错——这就是 GCM 的"认证"特性。

### 完整加解密函数

实战中通常把 IV 拼在密文前面，方便存储/传输：

```js
// 高级用法：加密 + 解密的最小封装
async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );

  // 拼接 [iv | ciphertext]
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result;
}

async function decrypt(key, payload) {
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

## 非对称加密：RSA-OAEP

非对称加密有两把钥匙：**公钥加密、私钥解密**。适合"我把消息加密发给你，只有你能看"的场景。

```js
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  {
    name: 'RSA-OAEP',
    modulusLength: 2048,                  // 2048 或 4096
    publicExponent: new Uint8Array([1, 0, 1]),  // 固定值 65537
    hash: 'SHA-256',
  },
  true,
  ['encrypt', 'decrypt']
);

// 用公钥加密
const ciphertext = await crypto.subtle.encrypt(
  { name: 'RSA-OAEP' },
  publicKey,
  new TextEncoder().encode('hello')
);

// 用私钥解密
const plaintext = await crypto.subtle.decrypt(
  { name: 'RSA-OAEP' },
  privateKey,
  ciphertext
);
```

:::warning RSA 只能加密短消息
2048 位 RSA-OAEP 单次最多加密 ~190 字节。**实际工程中**永远不直接用 RSA 加密数据，而是：
1. 生成一个随机 AES 密钥
2. 用 AES 加密真正的数据
3. 用 RSA 加密那个 AES 密钥

这种组合叫"信封加密（envelope encryption）"。
:::

## 数字签名：ECDSA

签名解决"这条消息真的是 X 发的吗"的问题：**私钥签名、公钥验签**。比 RSA 签名更小更快，**优先选 ECDSA**。

```js
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);

const message = new TextEncoder().encode('我同意此协议');

// 私钥签名
const signature = await crypto.subtle.sign(
  { name: 'ECDSA', hash: 'SHA-256' },
  privateKey,
  message
);

// 公钥验签
const valid = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  publicKey,
  signature,
  message
);
// => true
```

`namedCurve` 选 `P-256`（最常用）、`P-384`、`P-521`。

## 密钥派生：PBKDF2

需要把"用户密码"变成"加密密钥"？不能直接当密钥用——密码熵太低。**PBKDF2** 通过几十万次迭代把弱密码变成强密钥，且攻击者每猜一次也要付出同样的代价。

```js
async function deriveKeyFromPassword(password, salt) {
  // 1. 把密码包装成 CryptoKey
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 2. 派生出 AES-GCM 密钥
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600_000,    // 2024 OWASP 推荐
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await deriveKeyFromPassword('用户的密码', salt);
// key 现在可以直接用于 encrypt / decrypt
```

| 参数 | 推荐值 |
|------|--------|
| `iterations` | ≥ 600,000（SHA-256 + PBKDF2，OWASP 2024） |
| `salt` | 16 字节随机数 |
| `hash` | `SHA-256` |

:::tip 保存 salt
salt 不需要保密，但**必须保存**——下次用同一个密码 + 同一个 salt 才能派生出同一个密钥。
:::

## 密钥导入导出

需要把密钥存到 IndexedDB 或发给服务器？用 `exportKey` / `importKey`。

### 导出为 JWK（JSON 格式，最方便）

```js
const jwk = await crypto.subtle.exportKey('jwk', key);
// => { kty: 'oct', k: '8d2e...', alg: 'A256GCM', ext: true, ... }

// 直接 JSON.stringify 存起来
localStorage.setItem('myKey', JSON.stringify(jwk));
```

### 导入 JWK

```js
const jwk = JSON.parse(localStorage.getItem('myKey'));
const key = await crypto.subtle.importKey(
  'jwk',
  jwk,
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);
```

### 其他格式

| 格式 | 适用 | 说明 |
|------|------|------|
| `raw` | 对称密钥 / ECDH | 纯字节，最紧凑 |
| `jwk` | 所有 | JSON Web Key，跨语言通用 |
| `spki` | 公钥 | X.509 SubjectPublicKeyInfo |
| `pkcs8` | 私钥 | PKCS#8 私钥格式 |

### 不可导出密钥

设 `extractable: false`，密钥就**永远**无法被读出来，甚至开发者工具都拿不到。配合 IndexedDB 存储，可以做出非常安全的密钥管理：

```js
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  false,    // 不可导出！
  ['encrypt', 'decrypt']
);

await crypto.subtle.exportKey('raw', key);
// => InvalidAccessError: key is not extractable

// 但仍然可以存到 IndexedDB（CryptoKey 是可结构化克隆的）
db.put({ id: 'master', key });
```

## 不要用 Web Crypto 做用户认证

Web Crypto 适合**加密数据**，但**不适合做"登录"**。如果你想做"无密码登录 / 二因素 / Passkeys"，请用 **WebAuthn**：

- 私钥存在用户设备的安全硬件里（TPM / Secure Enclave / U2F Key），永远离不开设备
- 浏览器统一处理生物识别（Touch ID / Face ID / Windows Hello）
- 抗钓鱼：签名时绑定域名，钓鱼站点拿不到有效签名
- 用户体验：一次点击 + 指纹，比"用户名密码"更快更安全

```js
// 极简示例：注册一个 Passkey
const cred = await navigator.credentials.create({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'My App' },
    user: { id: new TextEncoder().encode('user-123'), name: 'alice', displayName: 'Alice' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],  // ES256
  },
});
```

WebAuthn 内部用的就是 Web Crypto 同款的 ECDSA / RSA，**但密钥管理由浏览器和操作系统接管**。自己拿 Web Crypto 造一套登录流程几乎一定会出安全漏洞——直接用 WebAuthn。

详细规范：[w3.org/TR/webauthn-3](https://www.w3.org/TR/webauthn-3/)

## 注意事项

- **AES-GCM 的 IV 永远不要复用**：每次加密都用 `getRandomValues` 生成新 IV
- **RSA 不要直接加密大数据**：用信封加密——RSA 加密 AES 密钥，AES 加密数据
- **PBKDF2 迭代次数要够**：< 100,000 次基本等于裸奔，2024 推荐 600,000
- **优先 ECDSA / ECDH**：比 RSA 更小更快，安全级别相同
- **JWK 是首选导出格式**：跨平台、可序列化、自带算法元数据
- **CryptoKey 可以存 IndexedDB**：即便 `extractable: false` 也能存，下次取出来直接用
