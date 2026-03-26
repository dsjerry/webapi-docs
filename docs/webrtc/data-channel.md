---
title: RTCDataChannel
description: WebRTC 上的任意数据通道 — 发送文本、二进制、JSON，延迟比 TCP 低
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## 概述

`RTCDataChannel` 是在 `RTCPeerConnection` 上建立的一条任意数据通道。它和 WebSocket 的区别是：DataChannel 走 P2P 直连，不经过服务器，延迟更低。更妙的是，它是**双向全双工**的，可以同时收发消息。

游戏手柄同步、文件传输、协同编辑、实时白板……这些场景用 DataChannel 再合适不过。

## 快速上手

<!-- 快速上手：建立 DataChannel 并收发文本 -->
```js
// === 发起端 ===
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

// 在协商前就创建 channel，底层会自动处理顺序
const channel = pc.createDataChannel('chat', { ordered: true });

channel.onopen = () => {
  channel.send('你好，对端！');
  // => 发送成功
};

channel.onmessage = (e) => {
  console.log('收到:', e.data);
  // => 收到: 你好，对端！
};

// === 接收端 ===
pc.ondatachannel = (e) => {
  const recvChannel = e.channel;
  recvChannel.onopen = () => recvChannel.send('回复：你也在！');
  recvChannel.onmessage = (e) => console.log('收到:', e.data);
};
```

无需额外的信令设计——`createDataChannel` 和 `ondatachannel` 会在 ICE 协商时自动触发。

## 核心概念

### 两种可靠性模式

创建 DataChannel 时最重要的参数：

```js
pc.createDataChannel('label', {
  ordered: true,    // 保证顺序（像 TCP）
  // ordered: false, // 追求低延迟，不保证顺序（像 UDP）
});
```

| 模式 | 适用场景 |
|------|---------|
| `ordered: true` | 文件传输、JSON 消息、协同编辑（需要顺序） |
| `ordered: false` | 游戏手柄、实时位置、语音指令（允许丢包） |

### 最大消息大小

默认单条消息最大 256 KB（256 × 1024 字节）。可以调整：

```js
pc.createDataChannel('big', {
  maxRetransmits: 0,       // UDP 模式
  maxPacketLifeTime: 1000, // 重传超时（毫秒）
  // 如果需要更大的消息，设置 protocol 层处理分片
});
```

### 和 WebSocket 的对比

| 特性 | RTCDataChannel | WebSocket |
|------|---------------|-----------|
| 传输路径 | P2P 直连 | 经服务器中转 |
| 延迟 | 极低 | 较高 |
| 断线重连 | 需要重建连接 | 自动重连 |
| 服务器成本 | 无需转发服务器 | 需要 |
| 复杂度 | 信令复杂 | 简单 |

## API 详解

### DataChannel 事件

```js
channel.onopen    = () => { /* 对端 channel 打开 */ };
channel.onclose   = () => { /* channel 关闭 */ };
channel.onmessage = (e) => {
  // e.data 是字符串或 Blob/ArrayBuffer
  if (typeof e.data === 'string') {
    const json = JSON.parse(e.data);
  }
};
channel.onerror   = (e) => { console.error('DataChannel 错误', e); };
```

### 发送数据

```js
// 发送文本
channel.send('Hello!');

// 发送 JSON
channel.send(JSON.stringify({ type: 'move', x: 100, y: 200 }));

// 发送二进制（ArrayBuffer）
const buf = new ArrayBuffer(1024);
channel.send(buf);

// 发送 Blob
const blob = new Blob(['hello'], { type: 'text/plain' });
channel.send(blob);
```

### 手动创建通道（从接收端）

也可以在远端手动创建一个 DataChannel 发回：

```js
// === 远端 ===
const ch = pc.createDataChannel('response', { ordered: true });
ch.onopen = () => ch.send('这是我的回复');
```

### 关闭通道

```js
channel.close(); // 单边关闭
pc.close();       // 关闭整个连接，所有 channel 一起关闭
```

## 实战案例

用 DataChannel 实现一个实时共享光标位置的小工具：

```js
// === cursor-sync.js ===

function setupCursorSync(pc) {
  let channel;

  pc.createDataChannel('cursor', { ordered: false });

  pc.ondatachannel = (e) => {
    channel = e.channel;
    channel.onmessage = ({ data }) => {
      const { x, y, color } = JSON.parse(data);
      drawRemoteCursor(x, y, color);
    };
  };

  // 监听本端鼠标移动，发送坐标
  document.addEventListener('mousemove', (e) => {
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({
        x: e.clientX,
        y: e.clientY,
        color: localColor,
      }));
    }
  });
}

function drawRemoteCursor(x, y, color) {
  const el = document.getElementById('remote-cursor');
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.style.color = color;
}
```

## 注意事项

- **必须先完成 ICE 协商**：`createDataChannel` 可以随时调用，但 `readyState` 变成 `'open'` 必须等连接建立后
- **对端必须在线**：P2P 意味着两端都要保持页面打开；没有"离线消息"概念
- **大数据块要分片**：单次 `send` 不能超过 16 MB，超过需要手动切分
- **NAT 穿透失败 = 无法使用**：和媒体流一样，P2P 数据也依赖 ICE；如果 ICE failed，DataChannel 也断
