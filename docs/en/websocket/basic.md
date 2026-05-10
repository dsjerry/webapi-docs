---
title: WebSocket Basic Usage
description: Connect, send, receive, close — the four core operations of WebSocket
outline: [2, 3]
---

:::tip Browser Support
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+
:::

## Creating a Connection

`WebSocket` constructor takes two parameters:

```js
const ws = new WebSocket(url, [protocols]);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | WebSocket server address, must be `ws://` or `wss://` |
| `protocols` | string \| string[] | Optional, subprotocol name |

```js
// simplest usage
const ws = new WebSocket('wss://chat.example.com');

// specify subprotocol
const ws = new WebSocket('wss://chat.example.com', 'chat.v1');
```

Connection created won't open immediately — waits for handshake completion before `onopen` fires.

## Lifecycle Events

WebSocket has four core events, corresponding to different connection states:

```js
const ws = new WebSocket('wss://echo.websocket.org');

ws.onopen = () => {
  // handshake successful, connection established, can send messages
};

ws.onmessage = (event) => {
  // received message
  const data = event.data;
  console.log('Received:', data);
};

ws.onerror = (event) => {
  // error occurred (usually followed by onclose)
  console.error('WebSocket error');
};

ws.onclose = (event) => {
  // connection closed
  console.log('Close code:', event.code);
  console.log('Reason:', event.reason);
  console.log('Clean:', event.wasClean);
};
```

### readyState

Besides events, you can read `readyState` directly to check current state:

| Value | Constant | Meaning |
|-------|----------|---------|
| 0 | `CONNECTING` | Connecting |
| 1 | `OPEN` | Connected, can send messages |
| 2 | `CLOSING` | Closing |
| 3 | `CLOSED` | Closed |

```js
if (ws.readyState === WebSocket.OPEN) {
  ws.send('this message can go out');
}
```

## Sending Messages

Call `send()` — supports three data types:

```js
// string (most common)
ws.send('Hello');

// JSON (common approach)
ws.send(JSON.stringify({ type: 'message', content: 'Hi' }));

// binary (ArrayBuffer or Blob)
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
view.setFloat32(0, 3.14);
ws.send(buffer);
```

When sending binary, the receiver's `event.data` is also the corresponding `ArrayBuffer` or `Blob`.

:::warning Timing
`send()` only works when `readyState === OPEN`. Sending before `onopen` fires fails silently.
:::

## Closing a Connection

### Client-initiated close

```js
// normal close (code 1000 = normal close)
ws.close(1000, 'Work complete');

// non-normal close codes
ws.close(1001, 'Server migrating');  // 1001 = server closing
ws.close(4000, 'Invalid operation'); // custom code (recommend 4000-4999)
```

### Server-initiated close

Server can also send a Close frame; browser receives it and fires `onclose`, with `event.code` and `event.reason` decided by the server.

## Minimal Complete Example

```js
function connect(url) {
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('Connected');
    ws.send('ping');
  };

  ws.onmessage = (e) => {
    console.log('Received:', e.data);
    if (e.data === 'pong') {
      ws.close(1000, 'done');
    }
  };

  ws.onerror = (e) => console.error('Error:', e);

  ws.onclose = (e) => console.log(`Closed: ${e.code} ${e.reason}`);

  return ws;
}

const ws = connect('wss://echo.websocket.org');
```

## Notes

- **Large messages**: WebSocket has no hard limit on single message size, but messages over 1MB should be sent in chunks or use HTTP upload instead
- **UTF-8 encoding**: Strings are encoded as UTF-8 by default; don't send binary data as strings (triggers encoding conversion)
- **Browser won't auto-reconnect**: If you need to restore a closed connection, you must `new WebSocket()` again
