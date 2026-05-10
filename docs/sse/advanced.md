---
title: SSE 进阶用法
description: 自定义重连、Last-Event-ID 续传、心跳保活、Nginx 代理配置
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 6+ · Firefox 6+ · Safari 5+ · Edge 79+
:::

## Last-Event-ID 续传

浏览器自动重连时，会带上**最后一条收到的 `id:`** 作为请求头：

```
GET /api/stream HTTP/1.1
Last-Event-ID: 42
```

服务端读这个头，从断点继续推：

```js
// === server.js（Node.js）===
http.createServer((req, res) => {
  const lastId = parseInt(req.headers['last-event-id'] || '0', 10);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  // 从 lastId+1 开始补发遗漏的消息
  for (const event of getEventsAfter(lastId)) {
    res.write(`id: ${event.id}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  }

  // 然后开始正常推
  // ...
}).listen(3000);
```

:::tip 服务端要保留消息历史
没有持久化的话续传无意义。常见做法：Redis Stream / Kafka / 内存环形缓冲。
:::

## 自定义重连间隔

服务端用 `retry:` 字段告诉浏览器多久后重连：

```
retry: 10000
data: hello

```

```js
// === server.js ===
res.write('retry: 10000\n\n');  // 第一条就告诉客户端：断线 10 秒后重试
```

不发 `retry:` 时浏览器默认 ~3 秒。

## 心跳保活

代理层（Nginx、CDN）通常会在 60 秒无数据后断开连接。每 30 秒发一个**注释行**保活：

```js
// === server.js ===
const keepalive = setInterval(() => {
  res.write(': keep-alive\n\n');  // 冒号开头是注释，浏览器会忽略
}, 30000);

req.on('close', () => clearInterval(keepalive));
```

注释行不会触发 `onmessage`，只是把 TCP 连接续命。

## fetch + ReadableStream 替代方案

需要自定义请求头（比如 `Authorization: Bearer xxx`）时，原生 `EventSource` 不支持。用 `fetch` 自己实现：

```js
async function* sseStream(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;

    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop();   // 最后一段可能不完整，留到下次

    for (const raw of events) {
      const event = parseEvent(raw);
      if (event) yield event;
    }
  }
}

function parseEvent(raw) {
  const event = { event: 'message', data: '', id: '' };
  for (const line of raw.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === 0) continue;          // 注释
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).trimStart();
    if (field === 'data') event.data += (event.data ? '\n' : '') + value;
    else event[field] = value;
  }
  return event.data ? event : null;
}

// 用法
for await (const event of sseStream('/stream', {
  headers: { Authorization: `Bearer ${token}` },
})) {
  console.log(event.event, event.data);
}
```

优势：可以传任意 header、可以 `AbortController` 取消、可以加自定义重试逻辑。
代价：自动重连、`Last-Event-ID` 都要自己写。

## 自定义重连封装

把 `fetch` 方案 + 指数退避重连组合：

```js
// 高级用法：带自动重连的 SSE 客户端
class SSEClient {
  constructor(url, { headers = {}, onMessage, onError } = {}) {
    this.url = url;
    this.headers = headers;
    this.onMessage = onMessage;
    this.onError = onError;
    this.lastId = '';
    this.aborter = null;
    this.retryDelay = 3000;
    this.connect();
  }

  async connect() {
    this.aborter = new AbortController();
    try {
      const res = await fetch(this.url, {
        headers: {
          ...this.headers,
          ...(this.lastId && { 'Last-Event-ID': this.lastId }),
        },
        signal: this.aborter.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const raw of events) {
          const event = parseEvent(raw);
          if (event) {
            if (event.id) this.lastId = event.id;
            if (event.retry) this.retryDelay = parseInt(event.retry, 10);
            this.onMessage?.(event);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.onError?.(err);
      // 指数退避重连
      setTimeout(() => this.connect(), this.retryDelay);
    }
  }

  close() {
    this.aborter?.abort();
  }
}

// 使用
const client = new SSEClient('/stream', {
  headers: { Authorization: `Bearer ${token}` },
  onMessage: (e) => console.log(e.data),
  onError: (e) => console.error(e),
});
```

## Nginx 代理配置

SSE 走 Nginx 时必须关掉缓冲，否则消息被攒到一起再下发：

```nginx
location /stream {
    proxy_pass http://backend;

    # 关键三条
    proxy_buffering off;          # 关闭响应缓冲
    proxy_cache off;              # 关闭缓存
    proxy_read_timeout 24h;       # 读超时拉长

    # HTTP/1.1 才支持 chunked
    proxy_http_version 1.1;
    proxy_set_header Connection '';

    # 透传客户端 IP（可选）
    proxy_set_header X-Real-IP $remote_addr;
}
```

服务端响应也加一个特殊头，让 Nginx 即使配错了也别缓冲：

```js
res.setHeader('X-Accel-Buffering', 'no');
```

## 注意事项

- **`Last-Event-ID` 只在浏览器自动重连时才发送**：手动 `new EventSource()` 不会带
- **`retry:` 字段是粘性的**：服务端发了一次后，后续所有重连都用这个值
- **HTTP/2 没有 6 连接限制**：生产环境强烈建议升 HTTP/2
- **大消息要拆 chunk**：单条 `data` 太大（>1MB）会让 `onmessage` 卡顿
- **AbortController 比 close() 更灵活**：用 `fetch` 方案时配合 signal 可以做超时控制
