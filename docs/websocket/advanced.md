---
title: WebSocket 进阶用法
description: 重连、心跳、二进制数据、子协议、调试 — 让 WebSocket 在生产环境可靠运行
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+
:::

## 自动重连

WebSocket 断开后不会自动重连，这是最常见的需求。以下是一个带指数退避的重连封装：

```js
class ReconnectingWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.maxRetries = options.maxRetries ?? 10;
    this.baseDelay = options.baseDelay ?? 1000;   // 毫秒
    this.maxDelay = options.maxDelay ?? 30000;
    this.retryCount = 0;
    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.retryCount = 0;
      if (this.onopen) this.onopen();
    };

    this.ws.onmessage = (e) => {
      if (this.onmessage) this.onmessage(e);
    };

    this.ws.onerror = (e) => {
      if (this.onerror) this.onerror(e);
    };

    this.ws.onclose = (e) => {
      if (this.onclose) this.onclose(e);
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      console.error('达到最大重连次数，放弃');
      return;
    }
    // 指数退避：1s → 2s → 4s → ... → 30s 上限
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    );
    this.retryCount++;
    console.log(`${delay}ms 后第 ${this.retryCount} 次重连...`);
    setTimeout(() => this._connect(), delay);
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close(code = 1000, reason = '') {
    this.maxRetries = 0;  // 阻止重连
    this.ws?.close(code, reason);
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// 使用
const ws = new ReconnectingWebSocket('wss://chat.example.com', {
  maxRetries: 5,
  baseDelay: 1000,
});

ws.onopen = () => console.log('连接成功');
ws.onmessage = (e) => console.log('收到:', e.data);
ws.onclose = (e) => console.log('关闭了');
```

## 心跳机制

心跳用于检测连接是否真正存活（TCP 断开不一定触发 `onclose`）。

### 方案一：应用层心跳（最通用）

```js
class HeartbeatWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.interval = options.interval ?? 30000;    // 30 秒发一次心跳
    this.timeout = options.timeout ?? 10000;        // 10 秒没回复认为断线
    this._hbTimer = null;
    this._timeoutTimer = null;
    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this._startHeartbeat();
      if (this.onopen) this.onopen();
    };

    this.ws.onmessage = (e) => {
      if (e.data === 'pong') {
        // 心跳回复，清除超时计时器
        clearTimeout(this._timeoutTimer);
        return;
      }
      if (this.onmessage) this.onmessage(e);
    };

    this.ws.onclose = () => {
      this._stopHeartbeat();
      if (this.onclose) this.onclose();
    };
  }

  _startHeartbeat() {
    this._hbTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
        // 启动超时计时器，如果超时没收到 pong 就关闭
        this._timeoutTimer = setTimeout(() => {
          console.warn('心跳超时，强制关闭连接');
          this.ws.close();
        }, this.timeout);
      }
    }, this.interval);
  }

  _stopHeartbeat() {
    clearInterval(this._hbTimer);
    clearTimeout(this._timeoutTimer);
  }

  send(data) {
    this.ws?.readyState === WebSocket.OPEN && this.ws.send(data);
  }

  close(code = 1000) {
    this._stopHeartbeat();
    this.ws?.close(code);
  }
}
```

### 方案二：使用 WebSocket ping/pong 帧（更底层）

浏览器收到 `0x9`（ping）帧会自动回复 `0xA`（pong）。服务端主动发 ping，客户端收到自动回复即可：

```js
// 客户端：什么都不用做，浏览器自动回复 pong
// 服务端：定时发 opcode=0x9 的帧
```

## 二进制数据

WebSocket 支持发送 `ArrayBuffer`、`TypedArray`、`Blob`：

```js
// 发送 ArrayBuffer
const buffer = new ArrayBuffer(4);
new Uint8Array(buffer).set([0x48, 0x65, 0x6c, 0x6c]); // "Hell"
ws.send(buffer);

// 发送 Blob
const blob = new Blob(['hello'], { type: 'text/plain' });
ws.send(blob);

// 接收端判断类型
ws.onmessage = (e) => {
  if (e.data instanceof ArrayBuffer) {
    const view = new DataView(e.data);
    console.log('ArrayBuffer:', view.getUint32(0));
  } else if (e.data instanceof Blob) {
    e.data.text().then(console.log);
  } else {
    console.log('字符串:', e.data);
  }
};
```

:::warning Blob vs ArrayBuffer
`Blob` 是不可变的原始二进制数据，适合文件类数据；`ArrayBuffer` 可直接在内存中读写，适合需要按字节处理的数据。
:::

## 子协议

子协议在握手阶段协商，常见的有：

| 子协议 | 用途 |
|--------|------|
| `graphql-ws` | GraphQL subscriptions |
| `mqtt` | MQTT over WebSocket |
| `soap` | SOAP 消息 |
| 自定义字符串 | 业务自行约定消息格式 |

```js
const ws = new WebSocket('wss://api.example.com', ['graphql-ws']);

ws.onopen = () => {
  // 握手后，服务端在 Sec-WebSocket-Protocol 头中选了一个协议
  console.log('使用协议:', ws.protocol);  // => "graphql-ws"
};
```

## 二进制协议设计

游戏、IoT、高频交易这类场景，JSON 的解析开销和体积都不可接受。设计一个紧凑的二进制协议能省下数倍带宽。

### 帧格式

最常见的"TLV（Type-Length-Value）"结构：

```
| 1 字节  | 4 字节       | 4 字节   | N 字节   |
| 消息类型 | 消息 ID（可选） | 数据长度 | payload  |
```

8 字节定长头 + 变长 payload，总共比 JSON 小 30-70%。

### 编解码

先确保接收端用 `ArrayBuffer` 而不是 `Blob`：

```js
const ws = new WebSocket('wss://example.com');
ws.binaryType = 'arraybuffer';   // 默认是 'blob'，二进制场景必须改
```

完整的发送/接收：

```js
// 高级用法：定长头 + payload
const HEADER = 9;  // 1 + 4 + 4

function encode(type, msgId, payload) {
  const data = typeof payload === 'string'
    ? new TextEncoder().encode(payload)
    : new Uint8Array(payload);

  const buf = new ArrayBuffer(HEADER + data.byteLength);
  const view = new DataView(buf);
  view.setUint8(0, type);
  view.setUint32(1, msgId, false);              // 大端
  view.setUint32(5, data.byteLength, false);
  new Uint8Array(buf, HEADER).set(data);
  return buf;
}

function decode(buf) {
  const view = new DataView(buf);
  const type = view.getUint8(0);
  const msgId = view.getUint32(1, false);
  const len = view.getUint32(5, false);
  const payload = new Uint8Array(buf, HEADER, len);
  return { type, msgId, payload };
}

// 用法
ws.send(encode(0x01, 42, JSON.stringify({ x: 100, y: 200 })));

ws.onmessage = (e) => {
  const { type, msgId, payload } = decode(e.data);
  console.log('类型:', type, '消息ID:', msgId);
  // payload 是 Uint8Array，按需 TextDecoder 解码或直接读字节
};
```

### 请求-响应配对

带 `msgId` 后可以做"发出去 → 等回来"的 RPC 风格调用：

```js
const pending = new Map();
let nextId = 1;

function request(type, payload) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(encode(type, id, payload));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout'));
      }
    }, 5000);
  });
}

ws.onmessage = (e) => {
  const { type, msgId, payload } = decode(e.data);
  const handler = pending.get(msgId);
  if (handler) {
    pending.delete(msgId);
    handler.resolve(payload);
  }
};

// 像调函数一样用
const reply = await request(0x10, JSON.stringify({ q: 'hello' }));
```

### 体积对比

同样一条 `{ "x": 100, "y": 200 }`：

| 编码方式 | 体积 | 解析耗时（10 万次） |
|---------|------|------|
| JSON | 17 字节 | ~120ms |
| MessagePack | 7 字节 | ~30ms |
| 自定义二进制（2× int16） | 4 字节 | ~5ms |

实际项目中，业务复杂时**优先考虑 [MessagePack](https://msgpack.org/) 或 [Protobuf](https://protobuf.dev/)**——既有二进制紧凑性，又不用自己造编解码。

## 调试技巧

### 用浏览器开发者工具

Chrome DevTools → **Network** → 筛选 `WS`，点击连接可查看帧的发送/接收：

```
▶ wss://chat.example.com
  Frame #1  →  发送   text  {"type":"ping"}
  Frame #2  ←  接收   text  {"type":"pong"}
```

### 用公共测试服务器

```
wss://echo.websocket.org       # 发什么收什么（只支持文本）
wss://ws.postman-echo.com/raw  # 同样发什么收什么
```

### 检查连接状态

```js
function logState(ws) {
  const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
  console.log('当前状态:', states[ws.readyState]);
}
```

## 注意事项

- **重连时不要重复 `new WebSocket()`**：等上一个连接彻底关闭（`onclose`）后再建新连接，否则可能导致多路复用混乱
- **心跳不要用 `send()` 发送字符串**："ping"/"pong" 容易和业务消息混淆，最好用专用的消息类型字段区分
- **不要在 `onclose` 里直接重连**：如果关闭码是 `1000`（正常关闭），不应该重连；只有异常断开才重连
- **安全**：永远用 `wss://`，绝对不要在生产环境用 `ws://`
