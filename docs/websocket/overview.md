---
title: WebSocket 概述
description: WebSocket 是什么，为什么它让实时通信成为可能
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+
所有现代浏览器均已支持，包括移动端。
:::

## 概述

HTTP 是"一问一答"模式：客户端发请求，服务器回响应，然后连接关闭。想收到服务器主动推送？做不到。

**WebSocket** 解决了这个问题。它在 HTTP 握手之后升级为一条持久化的双向通道，客户端和服务器随时可以互发消息，无需重新建立连接。

简单说：你想让服务器主动往浏览器发消息？WebSocket 就是答案。

## 和 HTTP 的本质区别

| | HTTP | WebSocket |
|--|------|-----------|
| 连接方向 | 客户端发起 | 双方都可以发起 |
| 谁先说话 | 客户端 | 任意一方 |
| 连接生命周期 | 一次请求一开 | 握手后保持 |
| 通信格式 | 请求/响应文本 | 消息帧（文本或二进制） |
| 头部开销 | 每次请求带完整 header | 握手后几乎没有 header |
| 适用场景 | REST API、文件获取 | 实时推送、协作、游戏 |

## 快速上手

<!-- 快速上手：建立连接 → 发消息 → 收消息 -->
```js
// 建立连接
const ws = new WebSocket('wss://echo.websocket.org');

ws.onopen = () => {
  console.log('连接已建立');
  ws.send('你好，服务器');  // 发消息
};

ws.onmessage = (e) => {
  console.log('收到消息:', e.data);  // 收到消息: 你好，服务器
};

ws.onerror = (e) => {
  console.error('WebSocket 错误:', e);
};

ws.onclose = () => {
  console.log('连接已关闭');
};
```

`wss://` 是加密版本（等价于 HTTPS），生产环境必须用它。

## 核心概念

### URL 格式

```
ws://  localhost:8080/chat      # 明文，不推荐
wss:// example.com/chat         # 加密，推荐
```

路径（`/chat`）由服务端决定，和 HTTP 的路由语义相同。

### 连接建立过程

```
客户端                              服务器
  |                                   |
  |--- HTTP GET + Upgrade 头 --------->|
  |<-- 101 Switching Protocols -------|
  |                                   |
  |========= WebSocket 连接 ==========|
  |<========= 双向消息 ============----|
  |========= 双向消息 =============--->|
  |                                   |
  |--- Close 帧 --------------------->|
  |<-- Close 帧 ----------------------|
```

服务器返回 `101 Switching Protocols` 即表示握手成功，之后就进入 WebSocket 协议。

### 子协议（Subprotocol）

如果同一条 TCP 连接上需要跑多种逻辑（比如聊天 + 游戏），可以在握手时协商子协议：

```js
const ws = new WebSocket('wss://example.com', ['graphql-ws', 'mqtt']);
```

服务端从中选一个返回在 `Sec-WebSocket-Protocol` 头里。双方按约定的子协议解析消息格式。

### 心跳机制

TCP 连接本身不感知对端是否存活（比如拔网线时 TCP 不会立即报错）。为此需要心跳机制：

- 客户端定时发一个 `ping` 消息，服务器回 `pong`
- 如果一段时间没收到任何消息，说明连接已断开
- WebSocket 协议本身没有内置 ping/pong，需要自己在应用层实现，或者用帧类型 `0x9` / `0xA`

:::tip 浏览器自动处理
浏览器收到 `0x9`（ping）帧会自动回复 `0xA`（pong），你不需要手动处理。
:::

## 注意事项

- **必须是 HTTPS/WSS**：现代浏览器对非安全上下文的 WebSocket 有严格限制（除 `localhost` 外）
- **服务端也需要支持**：WebSocket 是协议，需要服务端（Node.js、Go、Python 等）配合
- **不是所有场景都需要它**：如果只需要"客户端轮询服务端"，用 Server-Sent Events（SSE）更简单
- **断线不自愈**：连接断开后浏览器不会自动重连，需要自己写重连逻辑
