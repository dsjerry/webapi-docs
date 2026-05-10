---
title: 实战：AI 流式对话
description: 仿 ChatGPT 的逐字打印效果，用 SSE 实现端到端流式回复
outline: [2, 3]
---

:::tip 场景
做一个对话窗口，用户输入问题后，回复像 ChatGPT 一样**一个字一个字蹦出来**。这就是 SSE 最经典的用法——OpenAI、Anthropic、Google 的 API 全用它。
:::

## 需求拆解

- 用户输入 → 发请求到后端
- 后端调用 LLM（这里用一个简单模拟）
- 后端用 SSE 流式返回 token
- 前端边收边渲染，**不等全部完成**

## 完整代码

### 服务端（Node.js）

```js
// === server.js ===
import http from 'node:http';

const FAKE_REPLY = '你好！我是一个简单的 SSE 演示模型，正在一字一句地生成回复，效果类似 ChatGPT。';

function tokenize(text) {
  // 按字符切，模拟 LLM 的 token 流
  return [...text];
}

http.createServer(async (req, res) => {
  // 跨域支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.end();

  if (req.url.startsWith('/chat')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const tokens = tokenize(FAKE_REPLY);
    let id = 0;

    for (const token of tokens) {
      res.write(`id: ${++id}\n`);
      res.write(`event: token\n`);
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
      await new Promise(r => setTimeout(r, 30));
    }

    // 发送结束事件
    res.write(`event: done\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
    return;
  }

  res.writeHead(404).end();
}).listen(3000, () => console.log('SSE server: http://localhost:3000'));
```

### 客户端 HTML

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>SSE Chat</title>
  <style>
    body { max-width: 720px; margin: 2rem auto; font-family: sans-serif; }
    .msg { padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    .user { background: #e3f2fd; }
    .bot { background: #f5f5f5; white-space: pre-wrap; }
    .cursor::after { content: '▍'; animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    input { width: 70%; padding: 0.5rem; }
    button { padding: 0.5rem 1rem; }
  </style>
</head>
<body>
  <h1>流式对话演示</h1>
  <div id="chat"></div>
  <form id="form">
    <input id="input" placeholder="说点什么..." autocomplete="off">
    <button>发送</button>
  </form>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

### 客户端逻辑（app.js）

```js
// === app.js ===
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');

form.onsubmit = async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendMessage('user', text);

  const botEl = appendMessage('bot', '');
  botEl.classList.add('cursor');

  await streamReply(text, (chunk) => {
    botEl.textContent += chunk;
  });

  botEl.classList.remove('cursor');
};

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

async function streamReply(question, onToken) {
  const url = `http://localhost:3000/chat?q=${encodeURIComponent(question)}`;
  const es = new EventSource(url);

  return new Promise((resolve, reject) => {
    es.addEventListener('token', (e) => {
      const { token } = JSON.parse(e.data);
      onToken(token);
    });

    es.addEventListener('done', () => {
      es.close();
      resolve();
    });

    es.onerror = () => {
      es.close();
      reject(new Error('SSE 连接失败'));
    };
  });
}
```

## 测试

```bash
# 1. 启动服务端
node server.js
# => SSE server: http://localhost:3000

# 2. 用本地服务起前端（避免 file:// 限制）
npx serve .
# 打开 http://localhost:5000
```

输入任意问题 → 回复**逐字蹦出来** → 末尾光标闪烁 → 完成后光标消失。

## 改成接真实 LLM

把 `tokenize` 那段换成调用 OpenAI / Anthropic 的流式接口即可。OpenAI 流式响应本身就是 SSE 格式：

```js
// 服务端代理（隐藏 API Key）
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// 在 SSE 路由内
const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: question }],
  stream: true,
});

for await (const part of stream) {
  const token = part.choices[0]?.delta?.content || '';
  if (token) {
    res.write(`event: token\n`);
    res.write(`data: ${JSON.stringify({ token })}\n\n`);
  }
}
```

前端代码**完全不用改**——SSE 协议是统一的。

## 鉴权与取消

### 鉴权

`EventSource` 不支持自定义 Header，把 token 放 cookie 或 URL：

```js
// 推荐：服务端先发个一次性 token
const res = await fetch('/api/sse-token', { credentials: 'include' });
const { token } = await res.json();
new EventSource(`/chat?token=${token}&q=${q}`);
```

### 用户中断

ChatGPT 那个"停止生成"按钮就是关闭 SSE：

```js
let currentEs = null;

stopBtn.onclick = () => {
  currentEs?.close();
  currentEs = null;
};
```

服务端的 `req.on('close')` 会触发，记得停止 LLM 调用并退还 token 配额。

## 常见排错

| 现象 | 原因 |
|------|------|
| 收不到任何消息 | 响应没设 `Content-Type: text/event-stream` |
| 全部消息一起到来 | Nginx / CDN 在缓冲，加 `X-Accel-Buffering: no` 和 `proxy_buffering off` |
| 自动重连风暴（每秒重连） | 服务端 `res.end()` 太快，浏览器以为连接断开 |
| 跨域失败 | 没设 `Access-Control-Allow-Origin`；带 cookie 时还要 `Allow-Credentials: true` |
| 移动浏览器后台 5 秒后断开 | 浏览器为省电会暂停后台标签的网络，无解；切回前台会自动重连 |
| `EventSource is not defined` | Node.js 端模拟时缺少 polyfill，用 `eventsource` npm 包 |

## 注意事项

- **HTTP/1.1 同源 6 连接限制**：每个 origin 只能同时 6 条 SSE，会和其他 fetch 抢资源——升 HTTP/2 解决
- **服务端要主动结束**：用 `res.end()` 关闭流，否则前端会以为还有数据
- **OpenAI 风格用 `data: [DONE]`**：约定俗成的"流结束"标记，自己设计协议时也建议用类似标记

## 延伸阅读

- [WebSocket：何时选 WebSocket](/websocket/overview#何时选-websocket-vs-sse-vs-轮询) — 双向通信场景请用 WebSocket
- [Web Worker：基础用法](/webworker/basic) — 把 SSE 解析放到 Worker 里减轻主线程
- [Web Crypto：基础用法](/webcrypto/basic) — 给推送内容加签名防伪造
