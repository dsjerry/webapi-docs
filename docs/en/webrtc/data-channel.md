---
title: RTCDataChannel
description: Arbitrary data channel over WebRTC — send text, binary, JSON with lower latency than TCP
outline: [2, 3]
---

:::tip Browser Support
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## Overview

`RTCDataChannel` is an arbitrary data channel established on an `RTCPeerConnection`. Unlike WebSocket, DataChannel uses P2P direct connection, bypassing the server, resulting in lower latency. Better yet, it's **full-duplex** — both sides can send and receive simultaneously.

Game controller sync, file transfer, collaborative editing, real-time whiteboards — DataChannel is perfect for these scenarios.

## Quick Start

```js
// === Offer side ===
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

// Create channel before negotiation; the underlying layer handles ordering automatically
const channel = pc.createDataChannel('chat', { ordered: true });

channel.onopen = () => {
  channel.send('Hello, peer!');
};

channel.onmessage = (e) => {
  console.log('Received:', e.data);
};

// === Answer side ===
pc.ondatachannel = (e) => {
  const recvChannel = e.channel;
  recvChannel.onopen = () => recvChannel.send('Reply: You too!');
  recvChannel.onmessage = (e) => console.log('Received:', e.data);
};
```

No additional signaling design needed — `createDataChannel` and `ondatachannel` are automatically triggered during ICE negotiation.

## Core Concepts

### Two Reliability Modes

The most important parameter when creating a DataChannel:

```js
pc.createDataChannel('label', {
  ordered: true,    // guarantee order (like TCP)
  // ordered: false, //追求低延迟，不保证顺序（像 UDP）
});
```

| Mode | Best For |
|------|----------|
| `ordered: true` | File transfer, JSON messages, collaborative editing (order matters) |
| `ordered: false` | Game controllers, real-time positions, voice commands (packet loss acceptable) |

### Maximum Message Size

Default maximum single message size is 256 KB. You can adjust it:

```js
pc.createDataChannel('big', {
  maxRetransmits: 0,       // UDP mode
  maxPacketLifeTime: 1000, // retransmit timeout (ms)
});
```

### DataChannel vs WebSocket

| Feature | RTCDataChannel | WebSocket |
|---------|----------------|-----------|
| Transport path | P2P direct | Via server |
| Latency | Extremely low | Higher |
| Reconnection | Needs to rebuild | Auto reconnect |
| Server cost | No relay server needed | Needed |
| Complexity | Complex signaling | Simple |

## API Reference

### DataChannel Events

```js
channel.onopen    = () => { /* peer channel opened */ };
channel.onclose   = () => { /* channel closed */ };
channel.onmessage = (e) => {
  if (typeof e.data === 'string') {
    const json = JSON.parse(e.data);
  }
};
channel.onerror   = (e) => { console.error('DataChannel error', e); };
```

### Sending Data

```js
// Send text
channel.send('Hello!');

// Send JSON
channel.send(JSON.stringify({ type: 'move', x: 100, y: 200 }));

// Send binary (ArrayBuffer)
const buf = new ArrayBuffer(1024);
channel.send(buf);

// Send Blob
const blob = new Blob(['hello'], { type: 'text/plain' });
channel.send(blob);
```

### Closing a Channel

```js
channel.close(); // single-side close
pc.close();       // close entire connection, all channels close together
```

## Notes

- **ICE negotiation must complete first**: `createDataChannel` can be called anytime, but `readyState` becoming `'open'` requires the connection to be established
- **Peer must be online**: P2P means both sides must keep the page open; there's no "offline message" concept
- **Large data must be fragmented**: A single `send` cannot exceed 16 MB; larger data needs manual chunking
- **NAT traversal failure = unusable**: Like media streams, P2P data also depends on ICE; if ICE fails, DataChannel disconnects too
