---
title: 实战：完整登录流程
description: 端到端的注册 + 登录 + 自动登录最小可用系统
outline: [2, 3]
---

:::tip 场景
做一个完整的"无密码"登录站点：第一次访问输入邮箱 + 创建 Passkey，再次访问条件 UI 一键登录。技术栈：Node.js + Express + SimpleWebAuthn + LowDB（JSON 文件当数据库）。
:::

## 项目结构

```
.
├── server.js          # Express + WebAuthn 服务端
├── public/
│   ├── index.html     # 登录页
│   └── app.js         # 客户端逻辑
└── db.json            # 用户和凭证存储
```

## 服务端

### 依赖

```bash
npm i express @simplewebauthn/server lowdb express-session
```

### 完整代码

```js
// === server.js ===
import express from 'express';
import session from 'express-session';
import { JSONFilePreset } from 'lowdb/node';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:3000';

const db = await JSONFilePreset('db.json', { users: [], credentials: [] });

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'demo-secret',
  resave: false,
  saveUninitialized: true,
}));

// ========= 注册 =========

app.post('/api/register/options', async (req, res) => {
  const { username } = req.body;
  let user = db.data.users.find(u => u.username === username);
  if (!user) {
    user = { id: crypto.randomUUID(), username };
    db.data.users.push(user);
    await db.write();
  }

  const existingCreds = db.data.credentials.filter(c => c.userId === user.id);

  const options = await generateRegistrationOptions({
    rpName: 'Demo App',
    rpID: RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.username,
    attestationType: 'none',
    excludeCredentials: existingCreds.map(c => ({
      id: c.credentialID,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  req.session.challenge = options.challenge;
  req.session.userId = user.id;
  res.json(options);
});

app.post('/api/register/verify', async (req, res) => {
  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response: req.body,
    expectedChallenge: req.session.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (verified && registrationInfo) {
    db.data.credentials.push({
      userId: req.session.userId,
      credentialID: registrationInfo.credentialID,
      credentialPublicKey: Array.from(registrationInfo.credentialPublicKey),
      counter: registrationInfo.counter,
    });
    await db.write();
  }

  res.json({ verified });
});

// ========= 登录 =========

app.post('/api/login/options', async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    // 不传 allowCredentials，让浏览器列出所有可用 Passkey
  });

  req.session.challenge = options.challenge;
  res.json(options);
});

app.post('/api/login/verify', async (req, res) => {
  const credential = db.data.credentials.find(
    c => c.credentialID === req.body.id
  );
  if (!credential) return res.status(400).json({ verified: false });

  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response: req.body,
    expectedChallenge: req.session.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    authenticator: {
      credentialID: credential.credentialID,
      credentialPublicKey: new Uint8Array(credential.credentialPublicKey),
      counter: credential.counter,
    },
  });

  if (verified) {
    credential.counter = authenticationInfo.newCounter;
    await db.write();
    req.session.userId = credential.userId;
  }

  const user = db.data.users.find(u => u.id === credential.userId);
  res.json({ verified, username: user?.username });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ user: null });
  const user = db.data.users.find(u => u.id === req.session.userId);
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.listen(3000, () => console.log('http://localhost:3000'));
```

## 客户端

### HTML

```html
<!-- public/index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Passkey 登录演示</title>
  <style>
    body { max-width: 480px; margin: 4rem auto; font-family: sans-serif; padding: 0 1rem; }
    input { width: 100%; padding: 0.6rem; margin: 0.5rem 0; font-size: 1rem; }
    button { width: 100%; padding: 0.8rem; font-size: 1rem; cursor: pointer; }
    .ok { color: #2e7d32; }
    .err { color: #d32f2f; }
  </style>
</head>
<body>
  <h1>Passkey 登录</h1>

  <div id="loggedIn" hidden>
    <p>欢迎，<b id="userLabel"></b>！</p>
    <button id="logout">注销</button>
  </div>

  <div id="loggedOut">
    <input id="username" type="email" placeholder="邮箱" autocomplete="username webauthn">
    <button id="register">注册新 Passkey</button>
    <button id="login">用 Passkey 登录</button>
    <p id="msg"></p>
  </div>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

### 客户端逻辑

```js
// === public/app.js ===
import {
  startRegistration,
  startAuthentication,
} from 'https://esm.sh/@simplewebauthn/browser@10';

const $ = (id) => document.getElementById(id);

async function refresh() {
  const { user } = await fetch('/api/me').then(r => r.json());
  if (user) {
    $('loggedIn').hidden = false;
    $('loggedOut').hidden = true;
    $('userLabel').textContent = user.username;
  } else {
    $('loggedIn').hidden = true;
    $('loggedOut').hidden = false;
    startConditionalLogin();   // 自动开启条件 UI
  }
}

$('register').onclick = async () => {
  const username = $('username').value;
  if (!username) return setMsg('请填邮箱', true);

  try {
    const options = await fetch('/api/register/options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username }),
    }).then(r => r.json());

    const cred = await startRegistration(options);

    const { verified } = await fetch('/api/register/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cred),
    }).then(r => r.json());

    setMsg(verified ? '注册成功，可以登录了' : '注册失败', !verified);
  } catch (err) {
    setMsg('注册失败：' + err.message, true);
  }
};

$('login').onclick = doLogin;

async function doLogin() {
  try {
    const options = await fetch('/api/login/options', { method: 'POST' })
      .then(r => r.json());

    const assertion = await startAuthentication(options);

    const { verified, username } = await fetch('/api/login/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(assertion),
    }).then(r => r.json());

    if (verified) {
      setMsg(`欢迎 ${username}`);
      refresh();
    } else {
      setMsg('验证失败', true);
    }
  } catch (err) {
    if (err.name !== 'AbortError') setMsg(err.message, true);
  }
}

async function startConditionalLogin() {
  if (!await PublicKeyCredential.isConditionalMediationAvailable?.()) return;

  try {
    const options = await fetch('/api/login/options', { method: 'POST' })
      .then(r => r.json());

    const assertion = await startAuthentication(options, true);  // 第二参数 true = conditional

    const { verified, username } = await fetch('/api/login/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(assertion),
    }).then(r => r.json());

    if (verified) {
      setMsg(`欢迎 ${username}`);
      refresh();
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  }
}

$('logout').onclick = async () => {
  await fetch('/api/logout', { method: 'POST' });
  refresh();
};

function setMsg(text, isErr) {
  $('msg').textContent = text;
  $('msg').className = isErr ? 'err' : 'ok';
}

refresh();
```

## 测试

```bash
npm i express @simplewebauthn/server lowdb express-session
node server.js
# => http://localhost:3000
```

1. 打开 `http://localhost:3000`
2. 填邮箱 `alice@example.com` → 点"注册新 Passkey"
3. 浏览器弹出 Touch ID / Windows Hello → 解锁
4. 看到"注册成功"
5. 关掉标签页 → 重新打开 → **聚焦输入框** → Passkey 弹窗自动出现 → 一键登录

## 部署到生产

| 改动 | 说明 |
|------|------|
| `RP_ID` 改为真实域名（如 `myapp.com`） | 必须和当前 origin 域名匹配 |
| `ORIGIN` 改为 `https://myapp.com` | 必须 HTTPS |
| `session.cookie.secure: true` | 仅 HTTPS 传 cookie |
| 数据库换成 PostgreSQL / MySQL | LowDB 仅适合 demo |
| Add CSRF 保护 | 即使 WebAuthn 也别忘了 CSRF token |
| 限速 | `/api/login/options` 加速率限制防爆破 |

## 常见排错

| 现象 | 原因 |
|------|------|
| `SecurityError: rpId is not a registrable suffix` | `rpID` 和当前域名不匹配，本地用 `localhost`，生产用真实域名 |
| Safari 永远 `NotAllowedError` | 没有 user gesture（必须在用户点击事件里调用），或不是 HTTPS |
| 注册成功但登录失败 | counter 没更新；或 `expectedRPID` 写错 |
| 条件 UI 不弹 | `autocomplete` 属性少了 `webauthn`；或浏览器版本太低 |
| `InvalidStateError` 注册时 | 用户已经为同一 `user.id` 注册过了——用 `excludeCredentials` 阻止 |
| 移动 Safari 16 上 Passkey 弹窗能弹但用不了 | iOS 设置里关闭了"密码自动填充"——引导用户开启 |

## 注意事项

- **永远先在 localhost 测通再上线**：生产环境域名错了排查很痛苦
- **保留备用登录**：即使 Passkey 是主登录，也提供"邮箱魔法链接"作为找回手段
- **不要直接用 attestation 做合规**：`attestationType: 'direct'` 拿到的设备证书法律上不算电子签名

## 延伸阅读

- [Web Crypto：进阶用法](/webcrypto/advanced) — Passkey 内部用的就是 ECDSA / RSA
- [SSE：实战 AI 流式对话](/sse/practical) — 登录后的流式接口怎么做
- [SimpleWebAuthn 官方文档](https://simplewebauthn.dev/) — 库 API 完整参考
