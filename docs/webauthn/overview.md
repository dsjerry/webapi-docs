---
title: WebAuthn 概述
description: WebAuthn 是什么，为什么 Passkeys 比密码强 100 倍
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 67+ · Firefox 60+ · Safari 13+ · Edge 79+
**必须 HTTPS**（localhost 例外）。Passkey 同步需 Chrome 108+ / Safari 16+。
:::

## 概述

密码这东西活了 60 年了，但它**根本不该存在**：用户记不住、容易被钓鱼、数据库泄露一锅端。**WebAuthn** 是浏览器原生的公钥认证 API，**Passkeys** 是它在消费产品里的品牌名——本质是同一套东西。

工作原理一句话：注册时浏览器在用户设备里生成一对密钥，公钥发给服务器，私钥**永远离不开设备**（藏在 Secure Enclave / TPM）。登录时设备用 Face ID / 指纹解锁私钥，给服务器的挑战值签个名。**钓鱼网站拿不到密码**，因为根本没有密码。

简单说：你想做登录？别再用密码了，用这个。

## 和密码的本质区别

| | 密码 | Passkeys (WebAuthn) |
|--|--|--|
| 存哪里 | 服务器（哈希） | 用户设备的安全硬件 |
| 用户负担 | 记 / 输 / 改 | 一次指纹 |
| 钓鱼网站 | 用户上当就被盗 | **协议层防钓鱼**（绑域名） |
| 数据库泄露 | 全网用户密码裸奔 | 只是一堆公钥，无价值 |
| 跨设备 | 凭记忆 | iCloud/Google 自动同步 |
| 二次因素 | 还要 OTP / 短信 | 生物识别本身就是因素 |

## 快速上手

注册（创建 Passkey）：

```js
// 服务端先生成挑战值
const challenge = await fetch('/api/webauthn/register-options').then(r => r.arrayBuffer());

const credential = await navigator.credentials.create({
  publicKey: {
    challenge,
    rp: { name: 'My App', id: 'myapp.com' },
    user: {
      id: new TextEncoder().encode('user-id-123'),
      name: 'alice@example.com',
      displayName: 'Alice',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      residentKey: 'preferred',           // 让设备记住，做"无用户名登录"
      userVerification: 'preferred',
    },
  },
});

// 把 credential.response 发给服务器存档
```

登录（用 Passkey 签名）：

```js
const challenge = await fetch('/api/webauthn/login-options').then(r => r.arrayBuffer());

const assertion = await navigator.credentials.get({
  publicKey: {
    challenge,
    rpId: 'myapp.com',
  },
});

// 服务器用之前存的公钥验签 assertion.response.signature
```

整个过程**不存在密码**，只有挑战和签名。

## 核心概念

### 三个角色

| 角色 | 是谁 |
|------|------|
| **User** | 你的用户 |
| **Relying Party (RP)** | 你的网站（客户端 + 服务端） |
| **Authenticator** | 用户的设备（手机指纹、Windows Hello、YubiKey 等） |

### 两个动作

| 动作 | API | 用途 |
|------|-----|------|
| **注册（Attestation）** | `navigator.credentials.create()` | 第一次绑定设备，生成密钥对 |
| **登录（Assertion）** | `navigator.credentials.get()` | 已注册过的设备做签名 |

### 防钓鱼是协议级的

每次签名时，Authenticator 会把当前页面的**域名**（`rpId`）作为签名内容的一部分。钓鱼站 `myapp.evil.com` 的 `rpId` 不是 `myapp.com`，签出来的内容服务端验签**直接挂掉**。这是密码做不到的。

### Resident Key（"无用户名登录"）

设 `residentKey: 'preferred'` 后，凭证存在用户设备本地。用户可以**不输用户名**就登录——浏览器弹个对话框让选择哪个 Passkey。这是 Apple 那种"一键登录"体验的关键。

### 多设备 Passkey

iCloud Keychain / Google Password Manager 会把 Passkey 端到端加密同步到用户其他设备。你在 Mac 上注册，在 iPhone 上能直接用。这是 2023 年后才普及的杀手级特性。

## 注意事项

- **必须 HTTPS**：除 `localhost` 外，所有 WebAuthn 调用都要 HTTPS
- **`rpId` 要和当前域名匹配**：`rpId` 必须是当前 origin 的注册可后缀（如 `myapp.com` 或 `app.myapp.com`），不能是任意域名
- **服务端验签是关键**：客户端拿到 `credential` 必须发给服务端，由服务端用 cose-js / `@simplewebauthn/server` 等库**严格验证签名 + challenge + origin + rpIdHash**——少一步都可能被攻击
- **不是所有设备都支持**：老 Android、企业内网 PC 可能没有可用的 Authenticator，要保留密码或邮箱链接做降级
- **挑战值（challenge）必须服务端生成**：客户端不能自己 `crypto.getRandomValues`，否则攻击者重放
