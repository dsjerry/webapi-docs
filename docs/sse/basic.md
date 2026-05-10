---
title: SSE 基础用法
description: 监听消息、命名事件、断线重连
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 6+ · Firefox 6+ · Safari 5+ · Edge 79+
:::

## 创建连接

```js
// 最简
const es = new EventSource('/api/stream');

// 带 cookie（跨源时）
const es2 = new EventSource('https://other.com/stream', {
  withCredentials: true,
});
```

跨源时服务端必须返回：

```
Access-Control-Allow-Origin: https://your-app.com
Access-Control-Allow-Credentials: true
```

## 接收默认消息

服务端不带 `event:` 字段的消息，全部走 `onmessage`：

```js
es.onmessage = (e) => {
  // e.data 永远是字符串
  const obj = JSON.parse(e.data);
};
```

| 事件属性 | 说明 |
|---------|------|
| `e.data` | 服务端 `data:` 字段拼接后的字符串 |
| `e.lastEventId` | 服务端 `id:` 字段（用于续传） |
| `e.origin` | 消息来源 origin |

## 接收命名事件

服务端：

```
event: chat
id: 1
data: {"user":"Alice","msg":"hi"}

event: typing
data: Bob is typing...

```

客户端：

```js
es.addEventListener('chat', (e) => {
  const { user, msg } = JSON.parse(e.data);
});

es.addEventListener('typing', (e) => {
  console.log(e.data);
});
```

注意：**命名事件不会触发 `onmessage`**，必须用 `addEventListener`。

## 错误与重连

```js
es.onerror = (e) => {
  switch (es.readyState) {
    case EventSource.CONNECTING:
      // 浏览器正在自动重连
      console.log('断线，重连中...');
      break;
    case EventSource.CLOSED:
      // 彻底关闭（404/CORS 错误等）
      console.error('连接已关闭');
      break;
  }
};
```

:::tip 不要在 onerror 里 close()
浏览器自己会重连，手动 `close()` 反而把"自动恢复"的能力关掉了。除非你确认是 401/404 这种永久错误。
:::

## 关闭连接

```js
es.close();   // 关闭后 readyState 变成 CLOSED，且不会再重连
```

## 服务端最小实现（Node.js）

```js
// === server.js ===
import http from 'node:http';

http.createServer((req, res) => {
  if (req.url !== '/api/stream') {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // 关 Nginx 缓冲
  });

  let id = 0;
  const timer = setInterval(() => {
    res.write(`id: ${++id}\n`);
    res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`);
  }, 1000);

  // 客户端断开时清理
  req.on('close', () => clearInterval(timer));
}).listen(3000);
```

```js
// === client.html ===
const es = new EventSource('http://localhost:3000/api/stream');
es.onmessage = (e) => {
  console.log(JSON.parse(e.data));
  // => { time: 1715342592314 }
};
```

## 鉴权技巧

`EventSource` 不能自定义请求头，但有三条路：

### 1. Cookie（最简单）

```js
new EventSource('/stream', { withCredentials: true });
```

服务端读 `req.headers.cookie` 验签即可。

### 2. URL Query 带 token

```js
const token = await fetch('/api/sse-token').then(r => r.text());
new EventSource(`/stream?token=${token}`);
```

token 走 URL，**不要直接暴露长效 JWT**——发一个短期一次性的 SSE 专用 token。

### 3. 用 `fetch` + ReadableStream 替代

需要自定义头时，干脆不用 `EventSource`：

```js
const res = await fetch('/stream', {
  headers: { Authorization: `Bearer ${token}` },
});
const reader = res.body
  .pipeThrough(new TextDecoderStream())
  .getReader();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log(value);
}
```

代价：**自动重连和 Last-Event-ID 都要自己实现**。

## 注意事项

- **`onmessage` 收不到命名事件**：用 `addEventListener('eventName')`
- **HTTP/1.1 6 连接限制**：每个 origin 最多 6 条 SSE，超过的请求会被排队
- **跨源必须 CORS**：服务端要返回 `Access-Control-Allow-Origin`，客户端开 `withCredentials`
- **`close()` 后不能复用**：必须 `new EventSource()` 重建
