---
title: WebRTC Overview
description: What is WebRTC and why it makes browser calling possible
outline: [2, 3]
---

:::tip Browser Support
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## Overview

WebRTC (Web Real-Time Communication) enables two browsers to establish direct two-way audio/video and data channels without a server in between. It's made up of three APIs: `getUserMedia` captures local media streams, `RTCPeerConnection` establishes point-to-point connections, and `RTCDataChannel` transfers arbitrary binary data.

In short: want two users to talk, send files, or play games directly in the browser? That's what WebRTC was built for.

## Quick Start

```html
<video id="local" autoplay muted></video>

<script type="module">
  const video = document.getElementById('local');

  // Get local camera
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  // Feed it into the video element
  video.srcObject = stream;
</script>
```

Three lines of code, one API call — the camera feed appears.

## Core Concepts

### The Three Building Blocks

| API | Responsibility |
|-----|----------------|
| `getUserMedia` | Captures local camera/mic, produces a MediaStream |
| `RTCPeerConnection` | Creates, manages, and closes P2P connections |
| `RTCDataChannel` | Opens an arbitrary data channel on the connection |

### Signaling

WebRTC doesn't solve "how to find the other peer" itself. This requires server cooperation — typically using WebSocket to exchange SDP offer/answer and ICE candidates. The signaling server can be anything: Node.js, Go, even PHP.

### ICE / STUN / TURN

- **ICE**: Unified framework combining STUN and TURN
- **STUN**: Helps you get your public IP (NAT traversal helper)
- **TURN**: Relay server for when P2P direct connection fails (final fallback)

## Notes

- **HTTPS required**: Except for `localhost`, all `getUserMedia` calls must use HTTPS
- **Permission prompt**: Each call triggers a browser permission dialog — unavoidable
- **Performance**: Audio/video encoding is CPU-intensive; consider bitrate limits on low-end devices
