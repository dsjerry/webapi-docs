---
title: SSE 概述
description: Server-Sent Events 是什么，为什么 ChatGPT 用它做流式回复
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 6+ · Firefox 6+ · Safari 5+ · Edge 79+
所有现代浏览器原生支持，包括移动端。
:::

## 概述

需要服务器主动推消息给浏览器？大多数人第一反应是 WebSocket。但 80% 的"推送"场景是**单向**的——通知、价格更新、AI 流式回复——这种情况下 **Server-Sent Events** 是更好的选择：纯 HTTP，浏览器自动重连，写起来比 WebSocket 简单一半。

简单说：你只想"服务端往浏览器吐数据"，不需要双向交互？SSE 就够了。

## 和 WebSocket 的本质区别

| | SSE | WebSocket |
|--|--|--|
| 协议 | HTTP（chunked transfer） | TCP（HTTP 升级而来） |
| 通信方向 | **单向**（服务器 → 浏览器） | 双向 |
| 数据格式 | 仅 UTF-8 文本 | 文本 + 二进制 |
| 自动重连 | **浏览器内置** | 自己写 |
| 续传 | **`Last-Event-ID` 头自动带** | 自己实现 |
| 代理 / CDN | 完美兼容（就是 HTTP） | 部分中间层不支持 |
| 服务端实现 | 普通 HTTP 接口 + `chunked` | 需要 WS 库 |
| 浏览器连接数限制 | 同源 6 条（HTTP/1.1） | 几乎无限 |

## 快速上手

<!-- 快速上手：连接 → 收消息 -->
```js
const es = new EventSource('/api/events');

es.onmessage = (e) => {
  console.log('收到:', e.data);
  // => 收到: {"price": 99.5}
};

es.onerror = (e) => {
  // 浏览器会自动重连，不需要手动处理
  if (es.readyState === EventSource.CLOSED) {
    console.log('连接彻底关闭');
  }
};
```

服务端只要返回 `Content-Type: text/event-stream`，按格式吐数据：

```
data: {"price": 99.5}

data: {"price": 100.2}

```

注意每条消息后面**两个换行**。

## 核心概念

### `text/event-stream` 协议

一个最小的事件流：

```
event: update
id: 42
data: hello
data: world
retry: 5000

```

| 字段 | 作用 |
|------|------|
| `data:` | 消息内容，多行会被自动用 `\n` 拼起来 |
| `event:` | 事件名，对应 `addEventListener('event名')` |
| `id:` | 消息 ID，会自动写入下次请求的 `Last-Event-ID` 头 |
| `retry:` | 断线重连间隔（毫秒） |
| `:` 开头 | 注释行，浏览器忽略（也用作 keep-alive） |

每条消息以**空行**结束，连续两个换行 `\n\n` 是分隔符。

### EventSource 对象

```js
const es = new EventSource(url, { withCredentials: true });

es.readyState;   // 0=CONNECTING, 1=OPEN, 2=CLOSED
es.url;          // 连接的 URL
es.withCredentials;

es.onopen      = () => {};
es.onmessage   = (e) => {};   // 默认事件
es.onerror     = (e) => {};
es.close();    // 客户端主动关闭，关闭后浏览器不会再重连
```

### 命名事件

服务端可以发不同 `event:` 名，客户端用 `addEventListener` 区分：

```
event: stock-update
data: {"AAPL": 195.32}

event: news
data: 苹果发布新产品

```

```js
es.addEventListener('stock-update', (e) => {
  const data = JSON.parse(e.data);
});

es.addEventListener('news', (e) => {
  console.log(e.data);
});
```

`onmessage` 只接收**没有 `event:` 字段**的消息。

### 自动重连

连接断开后，浏览器会自动重新发起请求，**无需任何代码**。重连时会带上：

```
Last-Event-ID: 42
```

服务端读取这个头，从断点续传即可。重连间隔默认 ~3 秒，服务端可以用 `retry:` 字段调整。

## 注意事项

- **只能发文本**：要传二进制，自己 base64 编码
- **HTTP/1.1 同源 6 连接限制**：每个域同时最多 6 条 SSE，**会用光所有 HTTP 槽位**。HTTP/2 没这个问题
- **不能自定义请求头**：`EventSource` 不支持 `headers` 参数，鉴权要靠 cookie 或 URL query
- **代理超时**：Nginx 默认 60 秒断流，要配 `proxy_read_timeout 24h` 和关闭 `proxy_buffering`
- **连接数泄漏**：单页内反复 `new EventSource` 不调 `close()` 会很快达上限
