---
title: WebSocket Overview
description: What WebSocket is and why it makes real-time communication possible
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+
All modern browsers support it, including mobile.
:::

## Overview

HTTP is a "request-response" model: client sends request, server responds, then connection closes. Want the server to proactively push messages to the browser? Can't do it.

**WebSocket** solves this. After HTTP handshake it upgrades to a persistent bidirectional channel — client and server can send messages anytime without re-establishing the connection.

In short: want the server to proactively send messages to the browser? WebSocket is the answer.

## Essential Difference from HTTP

| | HTTP | WebSocket |
|--|------|-----------|
| Connection direction | Client initiates | Both can initiate |
| Who speaks first | Client | Either side |
| Connection lifecycle | One request, one open | Stays open after handshake |
| Communication format | Request/response text | Message frames (text or binary) |
| Header overhead | Full header on every request | Almost no header after handshake |
| Use case | REST API, file fetch | Real-time push, collaboration, gaming |

## Quick Start

```js
// Establish connection
const ws = new WebSocket('wss://echo.websocket.org');

ws.onopen = () => {
  console.log('Connection established');
  ws.send('Hello, server');  // send message
};

ws.onmessage = (e) => {
  console.log('Received:', e.data);
};

ws.onerror = (e) => {
  console.error('WebSocket error:', e);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

`wss://` is the encrypted version (equivalent to HTTPS) — must use it in production.

## Core Concepts

### URL Format

```
ws://  localhost:8080/chat      # plaintext, not recommended
wss:// example.com/chat         # encrypted, recommended
```

The path (`/chat`) is decided by the server, same semantics as HTTP routes.

### Connection Establishment Process

```
Client                              Server
  |                                   |
  |--- HTTP GET + Upgrade header ------->|
  |<-- 101 Switching Protocols --------|
  |                                   |
  |========= WebSocket Connection =====|
  |<========= bidirectional =======---|
  |========= bidirectional =========-->|
  |                                   |
  |--- Close frame ------------------>|
  |<-- Close frame -------------------|
```

Server returning `101 Switching Protocols` means the handshake succeeded, after which WebSocket protocol takes over.

### Subprotocols

If you need multiple logic streams over the same TCP connection (e.g., chat + gaming), negotiate subprotocols during the handshake:

```js
const ws = new WebSocket('wss://example.com', ['graphql-ws', 'mqtt']);
```

Server picks one and returns it in the `Sec-WebSocket-Protocol` header. Both sides parse messages according to the agreed subprotocol.

### Heartbeat Mechanism

TCP itself doesn't sense whether the other end is alive (e.g., unplugging the network cable doesn't immediately error TCP). For this reason, a heartbeat mechanism is needed:

- Client periodically sends a `ping` message, server replies `pong`
- If no message is received for a period, the connection is considered dead
- WebSocket protocol has no built-in ping/pong; implement it in the application layer, or use frame types `0x9` / `0xA`

:::tip Browser Auto-handling
Browser automatically replies `0xA` (pong) when it receives `0x9` (ping) — you don't need to handle it manually.
:::

## Notes

- **Must be HTTPS/WSS**: Modern browsers have strict restrictions on WebSocket in non-secure contexts (except `localhost`)
- **Server must also support it**: WebSocket is a protocol; server-side support (Node.js, Go, Python, etc.) is required
- **Not needed for all scenarios**: If you only need "client polls server", Server-Sent Events (SSE) is simpler
- **No auto-healing on disconnect**: Browser won't auto-reconnect when connection drops; you must implement reconnection logic yourself
