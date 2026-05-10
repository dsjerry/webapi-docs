---
title: "WebSocket Practical: Real-time Multi-user Chat"
description: Build a multi-user real-time chat app with reconnect, heartbeat, and room division from scratch
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+

**Note**: Requires HTTPS or localhost environment.
:::

## Overview

This section ties together everything covered: connection management → heartbeat keep-alive → room message broadcast → reconnect recovery. The app has two parts: server (Node.js + `ws`) and client, ~200 lines total.

## Architecture

```
Browser A ──┐
Browser B ──┼── WebSocket ──► Node.js Server ──► broadcast to all same-room clients
Browser C ──┘
```

## Server (Node.js)

### Install dependencies

```bash
npm init -y
npm install ws
```

### Server code

```js
// === server.js ===
import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const clients = new Map();

const MSG = {
  JOIN: 'join',
  LEAVE: 'leave',
  CHAT: 'chat',
  PING: 'ping',
  PONG: 'pong',
};

function broadcast(room, message, excludeId = null) {
  const payload = JSON.stringify(message);
  for (const [id, client] of clients) {
    if (id === excludeId) continue;
    if (client.room === room && client.ws.readyState === 1) {
      client.ws.send(payload);
    }
  }
}

function genId() {
  return Math.random().toString(36).slice(2, 8);
}

wss.on('connection', (ws) => {
  const clientId = genId();
  clients.set(clientId, { ws, userId: null, room: null });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const client = clients.get(clientId);

    switch (msg.type) {
      case MSG.JOIN: {
        client.userId = msg.userId;
        client.room = msg.room;
        ws.send(JSON.stringify({
          type: 'system',
          content: `Joined room "${msg.room}", ${clients.size} online`,
        }));
        broadcast(msg.room, {
          type: 'system',
          content: `User "${msg.userId}" joined the room`,
        }, clientId);
        break;
      }

      case MSG.CHAT: {
        if (!client.userId) return;
        broadcast(client.room, {
          type: 'chat',
          from: client.userId,
          content: msg.content,
          timestamp: Date.now(),
        }, clientId);
        break;
      }

      case MSG.PING: {
        ws.send(JSON.stringify({ type: MSG.PONG }));
        break;
      }
    }
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client?.userId && client?.room) {
      broadcast(client.room, {
        type: 'system',
        content: `User "${client.userId}" left the room`,
      });
    }
    clients.delete(clientId);
  });
});

console.log(`WebSocket server running at ws://localhost:${PORT}`);
```

## Client

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Real-time Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui; display: flex; height: 100vh; }
    #sidebar { width: 240px; background: #1a1a2e; color: #fff; padding: 20px; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid #333; }
    #sidebar h2 { font-size: 1.2rem; margin-bottom: 8px; }
    .info-group { display: flex; flex-direction: column; gap: 4px; }
    .info-group label { font-size: 0.75rem; color: #888; }
    .info-group input { padding: 8px; border-radius: 6px; border: 1px solid #333; background: #16213e; color: #fff; }
    #joinBtn { padding: 10px; background: #646cff; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    #joinBtn:disabled { background: #444; cursor: not-allowed; }
    #chat-area { flex: 1; display: flex; flex-direction: column; }
    #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
    .msg { padding: 8px 12px; border-radius: 8px; max-width: 70%; word-break: break-word; }
    .msg.system { align-self: center; background: transparent; color: #888; font-size: 0.8rem; }
    .msg.self { align-self: flex-end; background: #646cff; color: #fff; }
    .msg.other { align-self: flex-start; background: #2d2d44; color: #fff; }
    .msg .meta { font-size: 0.7rem; opacity: 0.7; margin-top: 2px; }
    #input-area { display: flex; gap: 8px; padding: 16px; border-top: 1px solid #eee; }
    #input-area input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
    #sendBtn { padding: 10px 20px; background: #646cff; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    #sendBtn:disabled { background: #ccc; }
    #status { font-size: 0.8rem; text-align: center; padding: 8px; color: #888; }
    #status.online { color: #4ade80; }
    #status.offline { color: #f43f5e; }
  </style>
</head>
<body>

<div id="sidebar">
  <h2>Chat Room</h2>
  <div class="info-group">
    <label>Username</label>
    <input id="userId" placeholder="Your nickname" maxlength="20" />
  </div>
  <div class="info-group">
    <label>Room</label>
    <input id="room" placeholder="room-1" value="room-1" maxlength="20" />
  </div>
  <button id="joinBtn">Join Room</button>
  <div id="status">Disconnected</div>
</div>

<div id="chat-area">
  <div id="messages"></div>
  <div id="input-area">
    <input id="msgInput" placeholder="Type a message..." disabled />
    <button id="sendBtn" disabled>Send</button>
  </div>
</div>

<script type="module">
class ChatClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseDelay = 1000;
    this.isManualClose = false;
  }

  connect() {
    this.isManualClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._startHeartbeat();
      if (this.onopen) this.onopen();
    };

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pong') return;
      if (this.onmessage) this.onmessage(msg);
    };

    this.ws.onclose = () => {
      this._stopHeartbeat();
      if (this.onclose) this.onclose();
      if (!this.isManualClose) this._scheduleReconnect();
    };
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  _stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.isManualClose = true;
    this._stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

const SERVER_URL = 'ws://localhost:8080';
const client = new ChatClient(SERVER_URL);
let myUserId = '';
let myRoom = '';

const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const joinBtn = document.getElementById('joinBtn');

function addMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg ' + (msg.type === 'system' ? 'system' : msg.from === myUserId ? 'self' : 'other');
  if (msg.type === 'system') {
    div.textContent = msg.content;
  } else {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    div.innerHTML = `<div>${escapeHtml(msg.content)}</div><div class="meta">${msg.from} · ${time}</div>`;
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = type;
}

client.onopen = () => {
  setStatus('Connected, joining room...', 'online');
  client.send({ type: 'join', userId: myUserId, room: myRoom });
  msgInput.disabled = false;
  sendBtn.disabled = false;
  joinBtn.textContent = 'Joined';
  joinBtn.disabled = true;
};

client.onmessage = (msg) => addMessage(msg);

client.onclose = () => {
  setStatus('Disconnected, reconnecting...', 'offline');
  msgInput.disabled = true;
  sendBtn.disabled = true;
  joinBtn.textContent = 'Reconnecting...';
  joinBtn.disabled = true;
};

joinBtn.onclick = () => {
  const uid = document.getElementById('userId').value.trim();
  const room = document.getElementById('room').value.trim();
  if (!uid) { alert('Please enter username'); return; }
  myUserId = uid;
  myRoom = room;
  client.connect();
};

function doSend() {
  const content = msgInput.value.trim();
  if (!content) return;
  client.send({ type: 'chat', content });
  msgInput.value = '';
  msgInput.focus();
}
sendBtn.onclick = doSend;
msgInput.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };
</script>
</body>
</html>
```

## How to Run

**1. Start the server:**

```bash
node server.js
# WebSocket server running at ws://localhost:8080
```

**2. Open the client:**

Open `index.html` directly in a browser (or serve with `npx serve .`), fill in username and room, click "Join Room".

**3. Multi-device testing:**

Open `index.html` in another browser tab (or another device on the same network), fill in the **same room number**, and start chatting in real time.

## Notes

- **Cross-device access**: If other devices can't reach it, change the server's IP to the LAN IP (e.g., `ws://192.168.1.x:8080`), and update the client URL accordingly
- **Production deployment**: Server must use `wss://` (TLS proxy via Nginx), client uses `wss://`
- **Close codes**: This example doesn't send close codes; if you need graceful shutdown, send a `{ type: 'leave' }` message before `close()`
- **Message frequency**: Chat has low message volume, but for high-frequency data streams (like gaming), use binary protocol and control frame rate
