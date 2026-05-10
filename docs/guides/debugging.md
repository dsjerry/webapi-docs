---
title: DevTools 调试技巧
description: 各 Web API 在 Chrome / Firefox DevTools 中的高效调试方法
outline: [2, 3]
---

DevTools 是开发者最熟悉但用得最浅的工具。这一篇把每个 API 的调试套路整理到一处，下次卡住能快速翻到对应章节。

## 通用面板速查

| 面板 | 适合调试 |
|------|---------|
| **Console** | 所有 API 的运行时输出、`copy()` / `monitor()` 等魔法函数 |
| **Network** → `WS` | WebSocket 帧、SSE 流 |
| **Network** → `EventStream` | SSE 单独标签页（Chrome 121+） |
| **Application** → Storage | IndexedDB、Cache、Cookies、OPFS |
| **Application** → Service Workers | SW 注册、生命周期、强制 update |
| **Sources** | Worker 单独 scope、blackbox 第三方 |
| **Performance** | 主线程卡顿、Web Audio 时序 |
| **Memory** | 闭包泄漏、Worker 内存 |

## WebRTC

### 内置仪表盘 `chrome://webrtc-internals`

地址栏访问，能看到所有 `RTCPeerConnection` 的：

- ICE candidate 收集 / 选中过程
- 实时码率、丢包、抖动
- 编解码器协商结果
- SDP 完整内容

排查"连不上 / 黑屏 / 卡顿"必看，比 `getStats()` 直观 10 倍。

### 生产环境 `getStats()`

```js
setInterval(async () => {
  const stats = await pc.getStats();
  for (const report of stats.values()) {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      console.log({
        bitrate: report.bytesReceived * 8 / 1000,
        fps: report.framesPerSecond,
        loss: report.packetsLost,
      });
    }
  }
}, 1000);
```

## WebSocket

Chrome DevTools → **Network** → 选连接 → **Messages** Tab：

- 实时刷帧，绿色 ↑ 是发送，红色 ↓ 是接收
- 二进制帧显示十六进制
- 右键单帧能 "Copy as JSON"

筛选时的过滤语法：

```
type:websocket
-domain:thirdparty.com
```

### 服务端联调

抓包用 `wscat`：

```bash
npm i -g wscat
wscat -c ws://localhost:8080
> {"type":"ping"}
< {"type":"pong"}
```

## SSE

Chrome 121+ 起，**Network** 里 SSE 请求有专门的 **EventStream** 标签页，按字段展示。

旧版本浏览器只能在 **Response** 里看原始 chunk。最稳的办法是在客户端打日志：

```js
es.addEventListener('message', (e) => {
  console.log('[SSE]', new Date().toISOString(), e.data);
});
```

服务端调试用 `curl -N`：

```bash
curl -N http://localhost:3000/api/stream
# -N 关闭缓冲，能看到流式输出
```

## Web Worker

### 找到 Worker 的 console

DevTools → **Sources** → 左上角下拉菜单 → 选 worker 名称 → 右下角 console 切换 scope。

或者在 worker 里 `debugger;` 自动停下。

### 检查消息往返

```js
// 主线程
const orig = worker.postMessage.bind(worker);
worker.postMessage = (...args) => {
  console.log('→ Worker:', args);
  return orig(...args);
};
worker.addEventListener('message', (e) => console.log('← Worker:', e.data));
```

### Service Worker 强刷

DevTools → **Application** → **Service Workers**：

- 勾选 `Update on reload`：每次 F5 自动激活新 SW（开发期必开）
- `bypass for network`：暂时绕过 SW
- `unregister`：彻底清掉重测

## IndexedDB

DevTools → **Application** → **IndexedDB** → 展开你的库：

- 双击 store 看所有记录（带分页）
- 右键单条 → 删除
- 顶部 ↻ 按钮刷新（IndexedDB 不会自动刷）

### 查看 OPFS

Chrome 122+：**Application** → **Storage** → `Origin private file system`，能浏览所有文件。

更早版本要用代码：

```js
const root = await navigator.storage.getDirectory();
for await (const [name, h] of root.entries()) {
  console.log(name, h.kind);
}
```

### 配额监控

```js
console.table(await navigator.storage.estimate());
// usage / quota / usageDetails
```

## Web Audio

### Firefox Web Audio Editor

只有 Firefox 支持：DevTools → ⋮ → Settings → 开启 "Web Audio"。能看到完整的节点图、参数曲线、自动化值。Chrome 无对应工具。

### Chrome 排查没声音

打印关键状态：

```js
console.log({
  state: ctx.state,                    // 'suspended' / 'running'
  baseLatency: ctx.baseLatency,
  currentTime: ctx.currentTime,
  destinationChannels: ctx.destination.channelCount,
});
```

`state === 'suspended'` 是 90% "没声音" 的原因。

### 监听节点状态

```js
osc.onended = () => console.log('osc ended at', ctx.currentTime);
```

## Web Crypto

Web Crypto 没有专门面板，但有几个技巧：

### 把 ArrayBuffer 看清楚

```js
const hash = await crypto.subtle.digest('SHA-256', data);

// 转 hex 看
console.log([...new Uint8Array(hash)]
  .map(b => b.toString(16).padStart(2, '0'))
  .join(''));

// 或 copy 到剪贴板
copy([...new Uint8Array(hash)]);
```

### 检查 CryptoKey

```js
console.log(key.type, key.algorithm, key.extractable, key.usages);
```

`extractable: false` 的 key 不能 `exportKey`，但能用 `console.log` 打印元数据。

## WebAuthn

WebAuthn 调试很特殊——浏览器为安全故意不透露细节。

### Chrome WebAuthn 虚拟模拟器

DevTools → ⋮ → More tools → **WebAuthn**。

- 启用后可以**虚拟一个 Authenticator**，无需真实指纹
- 能直接看到生成的 credential ID、public key
- 一键清空所有凭证，反复测试

### Firefox

Firefox 没有内置工具，用 `about:webauthn` 看注册的 Passkey 列表。

## File System Access

DevTools → **Application** → **Storage** → `Origin private file system`（OPFS）。

显式 API 拿到的句柄不在面板里展示——用代码列：

```js
// 已存到 IndexedDB 的句柄
const handles = await db.getAll('handles');
console.table(handles.map(h => ({ name: h.name, kind: h.kind })));
```

## Console 的隐藏招数

| 技巧 | 效果 |
|------|------|
| `copy(obj)` | 把对象 JSON 复制到剪贴板 |
| `monitor(fn)` | 函数被调用时打印参数 |
| `debug(fn)` | 函数被调用时自动停在断点 |
| `$_` | 上一次表达式的结果 |
| `$0` ~ `$4` | Elements 面板里最近选过的 5 个 DOM 节点 |
| `console.table([...])` | 把数组转表格显示 |
| `console.profile('x')` / `console.profileEnd()` | 触发性能采样到 Profile 标签 |
| `console.timeStamp('mark')` | 在 Performance 时间轴上加标记 |

## 跨设备远程调试

| 目标设备 | 工具 |
|----------|------|
| Android Chrome | `chrome://inspect` 直接 USB 调试 |
| iOS Safari | macOS Safari → 开发菜单 → 选设备（要先在 iOS 设置里开 Web 检查器） |
| 任何浏览器 | [Eruda](https://github.com/liriliri/eruda) 注入式 DevTools |
| WebView | 各 App 厂商的远程调试方案（X5、UC 等） |

## 抓包技巧

DevTools 看不全的请求（如 Service Worker 内的 fetch、WebSocket 中间层）：

```bash
# 用 mitmproxy 抓 HTTPS
mitmproxy --listen-port 8080
# 浏览器配置代理 127.0.0.1:8080，手机也能抓
```

## 性能问题快速定位

1. 打开 **Performance** → 录 5 秒
2. 红色长条 = 主线程卡顿
3. 搜索关键 API 名称（如 `decode`, `digest`），定位是不是同步操作引起
4. 看 `Frames` 行的红色帧 = 掉帧

更深入的方法见 [性能基准](./performance)。
