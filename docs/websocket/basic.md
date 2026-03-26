---
title: WebSocket 基础用法
description: 连接、发送、接收、关闭 — WebSocket 的四个核心操作
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 4+ · Firefox 4+ · Safari 4+ · Edge 12+
:::

## 创建连接

`WebSocket` 构造函数接收两个参数：

```js
const ws = new WebSocket(url, [protocols]);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | string | WebSocket 服务器地址，必须是 `ws://` 或 `wss://` |
| `protocols` | string \| string[] | 可选，子协议名称 |

```js
// 最简用法
const ws = new WebSocket('wss://chat.example.com');

// 指定子协议
const ws = new WebSocket('wss://chat.example.com', 'chat.v1');
```

连接创建后不会立即 open，需要等握手完成才触发 `onopen`。

## 生命周期事件

WebSocket 有四个核心事件，对应连接的不同状态：

```js
const ws = new WebSocket('wss://echo.websocket.org');

ws.onopen = () => {
  // 握手成功，连接已建立，可以发消息了
};

ws.onmessage = (event) => {
  // 收到消息
  const data = event.data;         // 消息内容（字符串或 Blob/ArrayBuffer）
  const isString = typeof data === 'string';
  console.log('收到:', data);
};

ws.onerror = (event) => {
  // 发生错误（通常紧接着 onclose）
  console.error('WebSocket 出错了');
};

ws.onclose = (event) => {
  // 连接关闭
  console.log('关闭码:', event.code);      // 1000 表示正常关闭
  console.log('原因:', event.reason);     // 服务器返回的关闭原因
  console.log('是否clean:', event.wasClean);
};
```

### readyState

除了事件，也可以直接读取 `readyState` 判断当前状态：

| 值 | 常量 | 含义 |
|----|------|------|
| 0 | `CONNECTING` | 正在连接 |
| 1 | `OPEN` | 已连接，可以发消息 |
| 2 | `CLOSING` | 正在关闭 |
| 3 | `CLOSED` | 已关闭 |

```js
if (ws.readyState === WebSocket.OPEN) {
  ws.send('这条消息可以发出去');
}
```

## 发送消息

调用 `send()` 即可发送，支持三种数据类型：

```js
// 字符串（最常用）
ws.send('Hello');

// JSON（通常做法）
ws.send(JSON.stringify({ type: 'message', content: '你好' }));

// 二进制（ArrayBuffer 或 Blob）
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
view.setFloat32(0, 3.14);
ws.send(buffer);
```

发送二进制时，接收端 `event.data` 也是对应的 `ArrayBuffer` 或 `Blob`（取决于浏览器的内部优化）。

:::warning 发送时机
`send()` 只在 `readyState === OPEN` 时有效。在 `onopen` 触发之前发消息会静默失败。
:::

## 关闭连接

有两种方式关闭连接：

### 客户端主动关闭

```js
// 正常关闭（码 1000 表示正常关闭）
ws.close(1000, '工作完成');

// 非正常关闭码示例
ws.close(1001, '服务器迁移');  // 1001 = 服务器关闭
ws.close(4000, '非法操作');    // 自定义码（建议 4000-4999）
```

### 服务器主动关闭

服务器也可以发 Close 帧，浏览器收到后同样触发 `onclose`，`event.code` 和 `event.reason` 由服务器决定。

## 最小完整示例

<!-- 完整的连接 → 发 → 收 → 关闭流程 -->
```js
function connect(url) {
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('连接成功');
    ws.send('ping');
  };

  ws.onmessage = (e) => {
    console.log('收到:', e.data);
    // 收到回复后关闭
    if (e.data === 'pong') {
      ws.close(1000, 'done');
    }
  };

  ws.onerror = (e) => console.error('错误:', e);

  ws.onclose = (e) => console.log(`关闭: ${e.code} ${e.reason}`);

  return ws;
}

const ws = connect('wss://echo.websocket.org');
```

## 注意事项

- **发送大消息**：WebSocket 对单条消息大小没有硬性限制，但过大消息（>1MB）建议分段发送或改用 HTTP 上传
- **UTF-8 编码**：字符串默认按 UTF-8 编码，二进制数据不要用字符串发送（会触发编码转换）
- **浏览器不会自动重连**：关闭后如果需要恢复连接，必须自己重新 `new WebSocket()`
