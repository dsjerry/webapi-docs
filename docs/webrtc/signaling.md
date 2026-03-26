---
title: 信令机制
description: WebRTC 如何在不知道对方地址的情况下找到对方
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## 概述

WebRTC 本身只管传输，不负责"谁先开口说话"。在两个端点开始交换媒体数据之前，它们必须先就媒体能力（SDP offer/answer）和网络路径（ICE candidate）达成一致。这部分协商工作叫**信令（Signaling）**——WebRTC 标准里根本没有规定怎么实现，因为它可以是你想要的任何东西。

## 快速上手

最简方案：用同一个页面模拟两个端点（仅供理解，真实场景用 WebSocket）：

<!-- 快速上手：同页面双端信令交换 -->
```js
// 同页面内模拟两端的 offer/answer 交换
const pc1 = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
const pc2 = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

// 模拟 ontrack
pc2.ontrack = (e) => { /* remote stream */ };

// pc1 创建 offer
const offer = await pc1.createOffer();
await pc1.setLocalDescription(offer);

// pc2 收到 offer，设置远端描述
await pc2.setRemoteDescription(offer);

// pc2 创建 answer
const answer = await pc2.createAnswer();
await pc2.setLocalDescription(answer);

// pc1 收到 answer
await pc1.setRemoteDescription(answer);
```

`setRemoteDescription` 之后，ICE 候选开始生成，`onicecandidate` 会被触发。

## 核心概念

### 为什么需要信令？

浏览器 A 不知道浏览器 B 的 IP；浏览器 B 不知道浏览器 A 的 IP。这两个盲人要想握手，必须通过一个双方都能访问的"中间人"——信令服务器。信令服务器本质上就是个消息投递员，它转发两种消息：

1. **SDP（Session Description Protocol）**：我的媒体能力是什么（编解码器、分辨率、要不要音频……）
2. **ICE Candidate**：我找到了哪些可用的网络路径（IP + 端口 + 协议组合）

### SDP offer / answer

协商媒体参数的标准流程：

```
A（发起方）                        B（接收方）
   |--- createOffer() --->           |
   |--- setLocalDescription(offer)  |
   |--- 发送 offer SDP --------->   | 收到 SDP
                                     |--- setRemoteDescription(offer)
                                     |--- createAnswer()
                                     |--- setLocalDescription(answer)
   |<---- 发送 answer SDP ----------| 收到 answer
   |--- setRemoteDescription(answer)|
```

### ICE Candidate 收集

一旦 `setRemoteDescription` 完成，两个端点开始并行收集 ICE 候选。每个候选都是一种"可能的路径"：

```
// ICE 候选示例
{
  candidate: "candidate:1 1 UDP 2122252543 192.168.1.5 54321 typ host"
  //        ↑ 类型：host（局域网内直连）
  //                    typ srflx（公网反射）
  //                    typ relay（TURN 中继）
  sdpMid: "0",
  sdpMLineIndex: 0
}
```

ICE 代理会对这些候选做连通性测试（STUN binding request），直到找到最好的那条路径。

### STUN / TURN 角色

| 技术 | 作用 | 什么时候用 |
|------|------|-----------|
| STUN | 获取公网映射 IP | 大多数 NAT 场景，P2P 直连 |
| TURN | 数据中继转发 | 对称型 NAT、严格防火墙后面 |

### 真实信令方案

| 方案 | 适合场景 |
|------|---------|
| WebSocket | 最常用，双向实时推送 |
| Server-Sent Events | 只需要服务端推送 |
| 轮询 HTTP | 最简单，调试方便 |
| WebSocket + TURN 服务 | 生产环境标配 |

## API 详解

### ICE 候选交换

```js
// 发送候选给对方
pc.onicecandidate = ({ candidate }) => {
  if (candidate) {
    ws.send(JSON.stringify(candidate));
  }
};

// 收到对方候选后加入
ws.onmessage = ({ data }) => {
  const candidate = JSON.parse(data);
  pc.addIceCandidate(candidate);
};
```

### ICE 传输策略

```js
const pc = new RTCPeerConnection({
  iceTransportPolicy: 'relay', // 强制走 TURN（用于调试）
  // 'all' = 优先 host → srflx → relay
});
```

### ICE 连接状态

```js
pc.oniceconnectionstatechange = () => {
  switch (pc.iceConnectionState) {
    case 'checking':    console.log('正在检测路径');  break;
    case 'connected':   console.log('找到路径');     break;
    case 'completed':   console.log('连接完成');     break;
    case 'failed':      console.log('所有路径都挂了'); break;
    case 'disconnected': console.log('临时断开');    break;
    case 'closed':      console.log('已关闭');      break;
  }
};
```

## 实战案例

用 WebSocket 实现一个最小信令客户端：

```js
// === signaling.js ===
class Signaling {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.onOffer = null;
    this.onAnswer = null;
    this.onCandidate = null;

    this.ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.type === 'offer')    this.onOffer?.(msg);
      if (msg.type === 'answer')   this.onAnswer?.(msg);
      if (msg.candidate)          this.onCandidate?.(msg.candidate);
    };
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  sendOffer(offer)   { this.send({ type: 'offer',   sdp: offer.sdp }); }
  sendAnswer(answer) { this.send({ type: 'answer',  sdp: answer.sdp }); }
  sendCandidate(c)   { this.send({ candidate: c }); }
}
```

## 注意事项

- **信令服务器不是 WebRTC 的一部分**：你可以用任何协议、任何后端，甚至手动复制粘贴 SDP（调试用）
- **offer/answer 必须配对**：发了 offer 必须等 answer，不能连发两个 offer
- **ICE 候选收集有延迟**：`setRemoteDescription` 后要等几秒才能收到足够多的候选，耐心
- **生产环境必须用 HTTPS**：STUN/TURN 服务器也要求 TLS
