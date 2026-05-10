---
title: WebSocket Advanced Usage
description: Reconnect, heartbeat, binary data, subprotocols, debugging — making WebSocket production-ready
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+
:::

## Auto Reconnect

WebSocket doesn't auto-reconnect when disconnected — this is the most common need. Here's a reconnecting wrapper with exponential backoff:

```js
class ReconnectingWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.maxRetries = options.maxRetries ?? 10;
    this.baseDelay = options.baseDelay ?? 1000;
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
      console.error('Max retries reached, giving up');
      return;
    }
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    );
    this.retryCount++;
    console.log(`Retry #${this.retryCount} in ${delay}ms...`);
    setTimeout(() => this._connect(), delay);
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close(code = 1000, reason = '') {
    this.maxRetries = 0;
    this.ws?.close(code, reason);
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

const ws = new ReconnectingWebSocket('wss://chat.example.com', {
  maxRetries: 5,
  baseDelay: 1000,
});
```

## Heartbeat Mechanism

Heartbeats detect whether the connection is truly alive (TCP disconnect doesn't immediately trigger `onclose`).

### Method 1: Application-layer heartbeat (most common)

```js
class HeartbeatWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.interval = options.interval ?? 30000;
    this.timeout = options.timeout ?? 10000;
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
        this._timeoutTimer = setTimeout(() => {
          console.warn('Heartbeat timeout, force closing');
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

### Method 2: Use WebSocket ping/pong frames (lower level)

Browser automatically replies `0xA` (pong) when it receives `0x9` (ping). Server sends ping, client auto-replies.

```js
// Client: do nothing, browser handles it automatically
// Server: send opcode=0x9 frame periodically
```

## Binary Data

WebSocket supports sending `ArrayBuffer`, `TypedArray`, `Blob`:

```js
// Send ArrayBuffer
const buffer = new ArrayBuffer(4);
new Uint8Array(buffer).set([0x48, 0x65, 0x6c, 0x6c]);
ws.send(buffer);

// Send Blob
const blob = new Blob(['hello'], { type: 'text/plain' });
ws.send(blob);

// Receive: check type
ws.onmessage = (e) => {
  if (e.data instanceof ArrayBuffer) {
    const view = new DataView(e.data);
    console.log('ArrayBuffer:', view.getUint32(0));
  } else if (e.data instanceof Blob) {
    e.data.text().then(console.log);
  } else {
    console.log('String:', e.data);
  }
};
```

## Subprotocols

Subprotocols are negotiated during the handshake:

| Subprotocol | Use Case |
|------------|----------|
| `graphql-ws` | GraphQL subscriptions |
| `mqtt` | MQTT over WebSocket |
| `soap` | SOAP messages |
| Custom string | Business-defined message format |

```js
const ws = new WebSocket('wss://api.example.com', ['graphql-ws']);

ws.onopen = () => {
  console.log('Using protocol:', ws.protocol);
};
```

## Debugging Tips

### Use browser DevTools

Chrome DevTools → **Network** → filter `WS`, click the connection to see frame send/receive:

```
▶ wss://chat.example.com
  Frame #1  →  sent   text  {"type":"ping"}
  Frame #2  ←  recv   text  {"type":"pong"}
```

### Public test servers

```
wss://echo.websocket.org       # echo (text only)
wss://ws.postman-echo.com/raw  # echo
```

## Notes

- **Don't `new WebSocket()` again during reconnect**: Wait for the previous connection to fully close (`onclose`) before creating a new one; otherwise you may get multiplexing confusion
- **Don't send heartbeat as string**: "ping"/"pong" strings can easily conflict with business messages; use a dedicated message type field to distinguish
- **Don't reconnect in `onclose`**: If the close code is `1000` (normal close), don't reconnect; only reconnect on abnormal disconnects
- **Security**: Always use `wss://`; never use `ws://` in production
