---
title: WebSocket 实战：实时多人聊天
description: 从零实现一个带重连、心跳、房间划分的多人实时聊天应用
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+

**注意**：需要 HTTPS 或 localhost 环境。
:::

## 概述

这一节把前面的知识串联起来：连接管理 → 心跳保活 → 房间消息广播 → 重连恢复。整个应用分为服务端（Node.js + `ws`）和客户端两部分，拢共约 200 行代码。

## 架构

```
浏览器 A ──┐
浏览器 B ──┼── WebSocket ──► Node.js 服务器 ──► 广播给所有同房间客户端
浏览器 C ──┘
```

核心逻辑：
- 每个连接对应一个 `client`，持有 `userId` 和 `room`
- 消息格式统一为 JSON：`{ type, from, room, content, timestamp }`
- 服务端根据 `type` 分发消息（广播、加入房间、私信）

## 服务端（Node.js）

### 安装依赖

```bash
npm init -y
npm install ws
```

### 服务端代码

<!-- server.js -->
```js
// === server.js ===
import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// 客户端 Map：clientId -> { ws, userId, room }
const clients = new Map();

// 消息类型
const MSG = {
  JOIN: 'join',
  LEAVE: 'leave',
  CHAT: 'chat',
  PING: 'ping',
  PONG: 'pong',
};

// 广播给同房间的所有人（排除发送者）
function broadcast(room, message, excludeId = null) {
  const payload = JSON.stringify(message);
  for (const [id, client] of clients) {
    if (id === excludeId) continue;
    if (client.room === room && client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(payload);
    }
  }
}

// 生成简短随机 ID
function genId() {
  return Math.random().toString(36).slice(2, 8);
}

wss.on('connection', (ws) => {
  const clientId = genId();
  clients.set(clientId, { ws, userId: null, room: null });

  console.log(`客户端 ${clientId} 连接`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // 忽略无效消息
    }

    const client = clients.get(clientId);

    switch (msg.type) {
      case MSG.JOIN: {
        client.userId = msg.userId;
        client.room = msg.room;
        console.log(`${clientId} 加入房间 ${msg.room}，用户名 ${msg.userId}`);
        // 通知加入者连接成功
        ws.send(JSON.stringify({
          type: 'system',
          content: `已加入房间「${msg.room}」，当前 ${clients.size} 人在线`,
        }));
        // 通知同房间其他人
        broadcast(msg.room, {
          type: 'system',
          content: `用户「${msg.userId}」加入了房间`,
        }, clientId);
        break;
      }

      case MSG.CHAT: {
        if (!client.userId) return;
        const chatMsg = {
          type: 'chat',
          from: client.userId,
          content: msg.content,
          timestamp: Date.now(),
        };
        // 广播给同房间的所有人
        broadcast(client.room, chatMsg, clientId);
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
        content: `用户「${client.userId}」离开了房间`,
      });
      console.log(`${clientId}（${client.userId}）离开房间 ${client.room}`);
    }
    clients.delete(clientId);
  });

  ws.on('error', (err) => {
    console.error(`客户端 ${clientId} 错误:`, err.message);
  });
});

console.log(`WebSocket 服务器运行在 ws://localhost:${PORT}`);
```

## 客户端

<!-- index.html -->
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>实时聊天</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Noto Sans SC", sans-serif; display: flex; height: 100vh; }
    #sidebar {
      width: 240px; background: #1a1a2e; color: #fff; padding: 20px; display: flex;
      flex-direction: column; gap: 12px; border-right: 1px solid #333;
    }
    #sidebar h2 { font-size: 1.2rem; margin-bottom: 8px; }
    .info-group { display: flex; flex-direction: column; gap: 4px; }
    .info-group label { font-size: 0.75rem; color: #888; }
    .info-group input { padding: 8px; border-radius: 6px; border: 1px solid #333; background: #16213e; color: #fff; }
    #joinBtn { padding: 10px; background: #646cff; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
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
  <h2>聊天室</h2>
  <div class="info-group">
    <label>用户名</label>
    <input id="userId" placeholder="你的昵称" maxlength="20" />
  </div>
  <div class="info-group">
    <label>房间号</label>
    <input id="room" placeholder="room-1" value="room-1" maxlength="20" />
  </div>
  <button id="joinBtn">加入房间</button>
  <div id="status">未连接</div>
</div>

<div id="chat-area">
  <div id="messages"></div>
  <div id="input-area">
    <input id="msgInput" placeholder="输入消息..." disabled />
    <button id="sendBtn" disabled>发送</button>
  </div>
</div>

<script type="module">
// === 封装一个带心跳和重连的 WebSocket 客户端 ===
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
      if (msg.type === 'pong') return; // 心跳回复不触发业务回调
      if (this.onmessage) this.onmessage(msg);
    };

    this.ws.onerror = (e) => {
      if (this.onerror) this.onerror(e);
    };

    this.ws.onclose = (e) => {
      this._stopHeartbeat();
      if (this.onclose) this.onclose(e);
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
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('重连次数用尽');
      return;
    }
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      console.log(`第 ${this.reconnectAttempts} 次重连...`);
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

// === UI 逻辑 ===
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
  setStatus('已连接，正在加入房间...', 'online');
  client.send({ type: 'join', userId: myUserId, room: myRoom });
  msgInput.disabled = false;
  sendBtn.disabled = false;
  joinBtn.textContent = '已加入';
  joinBtn.disabled = true;
};

client.onmessage = (msg) => {
  addMessage(msg);
};

client.onclose = () => {
  setStatus('连接断开，正在重连...', 'offline');
  msgInput.disabled = true;
  sendBtn.disabled = true;
  joinBtn.textContent = '重连中...';
  joinBtn.disabled = true;
};

client.onerror = () => {
  setStatus('连接失败，请检查服务器', 'offline');
};

// 加入房间
joinBtn.onclick = () => {
  const uid = document.getElementById('userId').value.trim();
  const room = document.getElementById('room').value.trim();
  if (!uid) { alert('请输入用户名'); return; }
  if (!room) { alert('请输入房间号'); return; }
  myUserId = uid;
  myRoom = room;
  client.connect();
};

// 发送消息
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

## 如何运行

**1. 启动服务端：**

```bash
node server.js
# WebSocket 服务器运行在 ws://localhost:8080
```

**2. 打开客户端：**

直接用浏览器打开 `index.html`（或用 `npx serve .` 起一个本地服务器），填入用户名和房间号，点击"加入房间"。

**3. 多端测试：**

在另一个浏览器标签页（或另一台同局域网设备）打开 `index.html`，填入**相同的房间号**，即可开始实时聊天。

## 注意事项

- **跨设备访问**：如果其他设备访问不到，把服务端的 IP 换成局域网 IP（如 `ws://192.168.1.x:8080`），客户端 URL 也相应改一下
- **外网部署**：生产环境服务端务必用 `wss://`（加 TLS 代理，如 Nginx），客户端用 `wss://`
- **关闭码**：示例中客户端没有发关闭码，如果需要优雅关闭，可以在 `close()` 前先发一条 `{ type: 'leave' }` 消息
- **消息频率**：聊天场景消息量不大，但如果是高频数据流（如游戏），建议用二进制协议并控制帧率
