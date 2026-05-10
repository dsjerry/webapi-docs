---
title: WebRTC 概述
description: WebRTC 是什么，为什么它让浏览器通话成为可能
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## 概述

WebRTC（Web Real-Time Communication）让两个浏览器直接建立双向音视频和数据通道，无需服务器中转数据。它由三大 API 组成：`getUserMedia` 捕获本地媒体流、`RTCPeerConnection` 建立点对点连接、`RTCDataChannel` 传输任意二进制数据。

简单说：你想让两个用户直接在浏览器里通话、发文件、打游戏？WebRTC 就是为此而生。

## 快速上手

<!-- 快速上手：获取本地摄像头并显示 -->
```html
<video id="local" autoplay muted></video>

<script type="module">
  const video = document.getElementById('local');

  // 获取本地摄像头
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  // 把它塞进 video 元素
  video.srcObject = stream;
</script>
```

三行代码，调一个 API，摄像头画面就出现了。

## 核心概念

### 三块积木

| API | 职责 |
|-----|------|
| `getUserMedia` | 采集本地摄像头/麦克风，产生 MediaStream |
| `getDisplayMedia` | 采集屏幕/窗口/Tab 内容，用于屏幕共享 |
| `RTCPeerConnection` | 建立、管理、关闭 P2P 连接 |
| `RTCDataChannel` | 在连接上开一条任意数据通道 |

### 信令（Signaling）

WebRTC 自己不解决"怎么找到对方"的问题。这部分需要服务端配合——通常用 WebSocket 交换 SDP offer/answer 和 ICE 候选地址。信令服务器可以是任何东西：Node.js、Go、甚至 PHP。

### ICE / STUN / TURN

- **ICE**：统一框架，整合 STUN 和 TURN
- **STUN**：帮你获取自己的公网 IP（内网穿透辅助）
- **TURN**：当 P2P 直连失败时，中继服务器转发数据（最后保底）

## 注意事项

- HTTPS 强制要求：除 `localhost` 外，所有 `getUserMedia` 调用必须走 HTTPS
- 权限提示：每次调用都会弹出浏览器授权弹窗，无法绕过
- 性能：音视频编码很吃 CPU，建议在低端设备上做码率限制
