---
title: WebAuthn 进阶用法
description: 条件 UI 自动登录、跨设备同步、降级方案、错误处理
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 67+ · Firefox 60+ · Safari 13+ · Edge 79+
条件 UI（Conditional UI）需要 Chrome 108+ / Safari 16+。
:::

## 条件 UI（自动登录）

最丝滑的 Passkey 体验：用户只要点一下用户名输入框，浏览器就在**输入框下方**弹出 Passkey 选择器——不用点任何"登录"按钮：

```html
<input id="username" autocomplete="username webauthn">
```

注意 `autocomplete` 必须包含 `webauthn`。

```js
// 页面加载时就开始等
async function startConditionalLogin() {
  if (!await PublicKeyCredential.isConditionalMediationAvailable?.()) {
    return;  // 浏览器不支持，回退到普通登录
  }

  const options = await fetch('/api/login/options').then(r => r.json());
  options.challenge = base64UrlToBuffer(options.challenge);

  try {
    const assertion = await navigator.credentials.get({
      publicKey: options,
      mediation: 'conditional',  // 关键：条件式 UI
    });

    // 用户选了某个 Passkey，发服务端验证
    await verifyAndLogin(assertion);
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  }
}

startConditionalLogin();
```

调用后**不会立即弹窗**，浏览器在后台等待用户和输入框交互。一旦用户聚焦输入框，自动出选项。

## Passkey 跨设备同步

### iCloud / Google 自动同步

用户在 macOS 注册的 Passkey，登 iCloud 的 iPhone 自动可用，**完全不用代码处理**。前提：

- iOS 16+ / macOS 13+ / Android 9+ / Windows 11
- 同一个云账号
- `residentKey: 'preferred'`（让设备记住）

### 用 QR 码跨平台

iPhone 用户访问 Windows 浏览器登录时，浏览器会**显示一个二维码**，用 iPhone 扫码 → 指纹解锁 → Windows 浏览器自动收到签名。这是 FIDO Alliance 标准的 caBLE / hybrid 流程，**也是浏览器内置**——你写一行代码不用变。

### 多设备凭证迁移

如果用户换手机，新手机不在同步圈内（比如 iPhone → Pixel），让用户**追加注册**新设备的 Passkey 即可：

```js
// 已登录状态下：注册第二个 Passkey
await registerNewCredential(currentUser);
// 数据库里现在该用户有 2 条 credential 记录，登录时任一都能用
```

## 降级与错误处理

### 检测能力，按需降级

```js
async function pickAuthMethod() {
  if (!window.PublicKeyCredential) {
    return 'password';   // 老浏览器
  }

  const platform = await PublicKeyCredential
    .isUserVerifyingPlatformAuthenticatorAvailable();

  if (platform) return 'passkey';        // 有指纹/Face ID
  return 'password+otp';                 // 推回密码 + 二次因素
}
```

### 常见错误

```js
try {
  const cred = await navigator.credentials.create({ publicKey: options });
} catch (err) {
  switch (err.name) {
    case 'NotAllowedError':
      // 用户取消、超时、Touch ID 失败
      break;
    case 'InvalidStateError':
      // 这台设备已经注册过了（同一 user.id）
      break;
    case 'NotSupportedError':
      // 算法 / 配置不支持
      break;
    case 'SecurityError':
      // rpId 和 origin 不匹配 / 不是 HTTPS
      break;
  }
}
```

:::warning NotAllowedError 是个大杂烩
浏览器为了防侧信道攻击，不告诉你具体原因。日志里看到一堆 `NotAllowedError` 不要慌——可能是用户取消、超时、设备没解锁、或者根本不支持 platform authenticator。
:::

## 反钓鱼自动锁定

WebAuthn 不会被钓鱼，但用户可能被骗去某个网站**手动注册** Passkey。可以加一层防御：

```js
// 注册时检查 origin 是否为公司主域
const expected = ['app.mycompany.com', 'mycompany.com'];
if (!expected.includes(location.host)) {
  alert('警告：该域名不是官方域名，不要注册凭证');
  return;
}
```

加上 [Trusted Types](https://developer.mozilla.org/docs/Web/API/Trusted_Types_API) 和 CSP 防 XSS，钓鱼攻击面降到最小。

## 服务端验签必做项

| 检查 | 为什么 |
|------|--------|
| `clientDataJSON.challenge === session.challenge` | 防重放 |
| `clientDataJSON.origin === 'https://myapp.com'` | 防钓鱼 |
| `clientDataJSON.type === 'webauthn.get'` 或 `'webauthn.create'` | 防误用 |
| `authenticatorData.rpIdHash === sha256('myapp.com')` | 防域名劫持 |
| `authenticatorData.flags.UP === 1` | User Present，确实有人按了 |
| `authenticatorData.flags.UV === 1`（如要求） | User Verified，做了生物识别 |
| `signature` 用存档的公钥可验证 | 真私钥签的 |
| `authenticatorData.signCount > saved.counter` | 防克隆设备 |

漏一项都是漏洞。**强烈推荐用 `@simplewebauthn/server` / `webauthn4j`**，别自己实现。

## 配合 OIDC / 现有用户系统

如果你已经有用户系统（密码登录），加 Passkey 当**第二种登录方式**：

```js
// 用户登录后，主动询问"启用 Passkey"
async function offerPasskey(user) {
  if (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
    if (confirm('启用 Passkey 下次免密登录？')) {
      await registerNewCredential(user);
    }
  }
}
```

这样老用户无感升级，新用户直接 Passkey。

## 注意事项

- **登录提示不能精确**：浏览器为了隐私，错误提示故意模糊；不要试图根据错误码做"下次试试别的"
- **timeout 默认 60 秒**：超时浏览器自动关闭弹窗，主动设短点（30s）体验更好
- **不要混用 platform + cross-platform**：`authenticatorAttachment` 选 `platform`（设备内置）或 `cross-platform`（USB Key），混着写在 Safari 上会报错
- **生产环境关闭 attestation**：`attestationType: 'none'` 既能用又最快；要做合规审计才考虑 `direct`
- **counter 不递增的 Authenticator**：YubiKey 等部分硬件 counter 永远是 0，存数据库时要标记跳过 counter 检查
