---
title: RTCPeerConnection
description: WebRTC 的核心 —— 建立、管理、关闭点对点连接
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## 概述

`RTCPeerConnection` 是 WebRTC 的心脏。它代表两个端点之间的一条逻辑连接，管理媒体协商、网络候选交换、加密传输。我们在这上面添加本地媒体轨道、监听远端轨道、追踪连接状态。

## 快速上手

<!-- 快速上手：建立空连接并监听状态 -->
```js
// 基础用法：创建连接
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
});

// 监听连接状态
pc.onconnectionstatechange = () => {
  console.log('连接状态:', pc.connectionState);
  // => connecting | connected | disconnected | failed | closed
};

// 监听 ICE 候选
pc.onicecandidate = (event) => {
  if (event.candidate) {
    // 把 candidate 发给对方（通过信令服务器）
    sendToPeer(event.candidate);
  }
};

// 监听远端轨道到来
pc.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};
```

## 核心概念

### 创建连接

`RTCPeerConnection` 接受一个配置对象，最关键的是 `iceServers`——它定义了 ICE 候选收集时使用的 STUN/TURN 服务器。

```js
const pc = new RTCPeerConnection({
  iceServers: [
    // STUN — 获取公网 IP
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN — P2P 失败时的中继
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass',
    },
  ],
  // 可选：绑定的 ICE 传输策略
  iceTransportPolicy: 'all', // 或 'relay'（强制走 TURN）
});
```

### 添加本地轨道

获取到 `MediaStream` 后，把它的视频轨道加到连接上：

```js
// 来自 getUserMedia
const localStream = await navigator.mediaDevices.getUserMedia({ video: true });

localStream.getTracks().forEach((track) => {
  pc.addTrack(track, localStream);
});
```

### 媒体协商

两个端点需要交换 SDP（Session Description Protocol）才能协商媒体能力。这个交换必须由一方主动发起：

```js
// === 发起方（Offer 端） ===
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
sendToPeer({ type: 'offer', sdp: offer.sdp });

// === 接收方（Answer 端） ===
// 收到 offer 后：
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
sendToPeer({ type: 'answer', sdp: answer.sdp });

// === 发起方收到 answer ===
await pc.setRemoteDescription(answer);
```

这个 offer/answer 交换完成后，双方都会收到 `ontrack` 事件。

## API 详解

### 关键属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `connectionState` | string | 当前连接总体状态 |
| `iceConnectionState` | string | ICE 连接层状态 |
| `localDescription` | RTCSessionDescription | 本地 SDP |
| `remoteDescription` | RTCSessionDescription | 远端 SDP |
| `getSenders()` | RTCRtpSender[] | 已添加的发送轨道 |
| `getReceivers()` | RTCRtpReceiver[] | 已接收的远端轨道 |

### 关键事件

| 事件 | 触发时机 |
|------|---------|
| `ontrack` | 收到远端媒体轨道 |
| `onicecandidate` | ICE 候选生成完毕，可发送 |
| `onconnectionstatechange` | 连接状态变化 |
| `oniceconnectionstatechange` | ICE 连接状态变化 |
| `ondatachannel` | 收到对方开的 DataChannel |

### 关闭连接

```js
// 关闭所有传输，释放资源
pc.close();

// 重置并用新实例替代
// pc = new RTCPeerConnection(config);
```

:::danger 关闭后不能复用
`close()` 后该实例就废弃了。如果要重连，创建一个新的 `RTCPeerConnection`。
:::

## 实战案例

完整的简易通话流程（不含信令服务器逻辑）：

```js
// === main.js ===
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

// 获取本地媒体
const localStream = await navigator.mediaDevices.getUserMedia({ video: true });
localVideo.srcObject = localStream;
localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

// 收到远端轨道
pc.ontrack = (e) => {
  remoteVideo.srcObject = e.streams[0];
};

// ICE 候选发送给信令服务器
pc.onicecandidate = (e) => {
  if (e.candidate) signaling.send(e.candidate);
};

// 收到对方 ICE 候选后加入
signaling.onCandidate = (candidate) => pc.addIceCandidate(candidate);
```

## 注意事项

- **必须配 `iceServers`**：不配的话 ICE 候选永远为空，连接无法建立
- **offer/answer 是串行的**：一方 `setLocalDescription` 完成后才能发出去，对端收到才能 `setRemoteDescription`
- **同一 track 可被多个 `addTrack` 复用**：`RTCRtpSender` 可以复用同一个轨道到多个连接
