---
title: WebAuthn 基础用法
description: 注册凭证 / 登录验证 — 两个动作完成无密码登录
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 67+ · Firefox 60+ · Safari 13+ · Edge 79+
HTTPS 强制要求（localhost 例外）。
:::

## 注册：创建 Passkey

### 客户端

```js
// 1. 找服务端拿注册挑战
const optionsRes = await fetch('/api/register/options', {
  method: 'POST',
  body: JSON.stringify({ username: 'alice@example.com' }),
});
const options = await optionsRes.json();

// 2. 把 base64 字段转回 ArrayBuffer
options.challenge = base64UrlToBuffer(options.challenge);
options.user.id = base64UrlToBuffer(options.user.id);

// 3. 调浏览器创建凭证
const credential = await navigator.credentials.create({ publicKey: options });

// 4. 把结果发回服务端验证 + 存档
await fetch('/api/register/verify', {
  method: 'POST',
  body: JSON.stringify({
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      attestationObject: bufferToBase64Url(credential.response.attestationObject),
    },
  }),
});
```

### 服务端要做什么

| 步骤 | 说明 |
|------|------|
| 1. 生成 32 字节随机 challenge | 存入 session，下一步要核对 |
| 2. 给客户端 `PublicKeyCredentialCreationOptions` | 含 challenge / rp / user / 算法 |
| 3. 收到 `attestationObject` | 解 CBOR，提取公钥和签名 |
| 4. 验证 origin / rpIdHash / challenge / 签名 | 全部通过才算注册成功 |
| 5. 把 `credentialId` + 公钥 + counter 入库 | 下次登录用这条记录 |

强烈推荐用现成库，比如 [`@simplewebauthn/server`](https://simplewebauthn.dev/)：

```js
// === server.js ===
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';

app.post('/api/register/options', async (req, res) => {
  const options = await generateRegistrationOptions({
    rpName: 'My App',
    rpID: 'myapp.com',
    userName: req.body.username,
    attestationType: 'none',
  });
  // 把 options.challenge 存到用户的 session
  req.session.challenge = options.challenge;
  res.json(options);
});

app.post('/api/register/verify', async (req, res) => {
  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response: req.body,
    expectedChallenge: req.session.challenge,
    expectedOrigin: 'https://myapp.com',
    expectedRPID: 'myapp.com',
  });

  if (verified) {
    // 存 registrationInfo.credentialID, credentialPublicKey, counter
    db.saveCredential(req.session.userId, registrationInfo);
  }
  res.json({ verified });
});
```

## 登录：用 Passkey 验证

### 客户端

```js
// 1. 拿登录挑战
const optionsRes = await fetch('/api/login/options', {
  method: 'POST',
  body: JSON.stringify({ username }),
});
const options = await optionsRes.json();
options.challenge = base64UrlToBuffer(options.challenge);
options.allowCredentials = options.allowCredentials.map(c => ({
  ...c,
  id: base64UrlToBuffer(c.id),
}));

// 2. 让浏览器签名
const assertion = await navigator.credentials.get({ publicKey: options });

// 3. 发回服务端验签
await fetch('/api/login/verify', {
  method: 'POST',
  body: JSON.stringify({
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64Url(assertion.response.clientDataJSON),
      authenticatorData: bufferToBase64Url(assertion.response.authenticatorData),
      signature: bufferToBase64Url(assertion.response.signature),
      userHandle: assertion.response.userHandle && bufferToBase64Url(assertion.response.userHandle),
    },
  }),
});
```

### 服务端

```js
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';

app.post('/api/login/options', async (req, res) => {
  const user = await db.findUser(req.body.username);
  const credentials = await db.findCredentials(user.id);

  const options = await generateAuthenticationOptions({
    rpID: 'myapp.com',
    allowCredentials: credentials.map(c => ({
      id: c.credentialID,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });
  req.session.challenge = options.challenge;
  res.json(options);
});

app.post('/api/login/verify', async (req, res) => {
  const credential = await db.findCredentialById(req.body.rawId);

  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response: req.body,
    expectedChallenge: req.session.challenge,
    expectedOrigin: 'https://myapp.com',
    expectedRPID: 'myapp.com',
    authenticator: credential,
  });

  if (verified) {
    // 更新 counter 防重放
    await db.updateCounter(credential.id, authenticationInfo.newCounter);
    req.session.userId = credential.userId;
  }
  res.json({ verified });
});
```

## 工具函数

WebAuthn 大量用 `ArrayBuffer`，传输前要转 base64url：

```js
// 高级用法：base64url 编解码
function bufferToBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
```

## 检测能力

```js
// 浏览器是否支持 WebAuthn
const supported = !!window.PublicKeyCredential;

// 当前设备有内置 Authenticator（指纹/Face ID/Windows Hello）
const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

// 是否支持条件 UI（自动登录）
const conditional = await PublicKeyCredential.isConditionalMediationAvailable?.();
```

## 注意事项

- **永远不要把 challenge 存客户端**：必须由服务端生成、存 session、验完即弃
- **`rpID` 必须和当前域名匹配**：本地开发用 `localhost`，生产用真实域名
- **counter 必须递增**：每次登录后服务端要更新，发现 counter 变小说明设备被克隆，立即拒绝
- **`attestationType: 'none'`** 是 99% 项目的正确选择：要做企业级强证明再考虑 `direct`
