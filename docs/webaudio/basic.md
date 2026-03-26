---
title: Web Audio API 基础用法
description: 创建上下文、加载音频、播放控制 — Web Audio API 的核心操作
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+
:::

## 创建 AudioContext

所有音频操作从这里开始：

```js
// 现代浏览器（新规范）
const ctx = new AudioContext();

// 旧版 Safari（WebKit 前缀）
const ctx = new (window.AudioContext || window.webkitAudioContext)();
```

:::warning 用户手势限制
Chrome/Edge 等现代浏览器要求 AudioContext 必须在用户交互回调中创建。如果创建时机不对，浏览器会自动将其状态设为 `suspended`，调用 `ctx.resume()` 才能正常工作。
:::

## 播放一个音频文件

完整流程：加载 → 解码 → 创建音源节点 → 连接 → 播放：

```js
async function playAudio(ctx, url) {
  // 1. 加载音频文件
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  // 2. 解码为 AudioBuffer
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // 3. 创建音源节点
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  // 4. 连接：source → destination（扬声器）
  source.connect(ctx.destination);

  // 5. 播放
  source.start(0);  // 参数为开始时间（秒），0 表示立即

  return source;
}

button.onclick = async () => {
  const ctx = new AudioContext();
  await playAudio(ctx, '/music.mp3');
};
```

## OscillatorNode（合成声音）

OscillatorNode 本身不加载文件，直接生成波形：

```js
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

// 设置波形类型和频率
osc.type = 'sine';                        // 'sine' | 'square' | 'sawtooth' | 'triangle'
osc.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz = A4

// 设置音量
gain.gain.setValueAtTime(0, ctx.currentTime);

// 连接
osc.connect(gain);
gain.connect(ctx.destination);

// 播放
osc.start();

// 1 秒内音量从 0 渐变到 0.5（避免爆音）
gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1);

// 2 秒后停止
osc.stop(ctx.currentTime + 2);
```

### 波形类型对比

| 类型 | 声音特点 | 频谱 |
|------|----------|------|
| `sine` | 纯净、柔和 | 只有基频 |
| `triangle` | 较柔和、轻盈 | 基频 + 奇次谐波 |
| `sawtooth` | 明亮、刺耳 | 所有谐波 |
| `square` | 厚实、卡通感 | 所有谐波（奇次更明显） |

## 播放控制

### 暂停和恢复

```js
// 暂停（suspend）
await ctx.suspend();

// 恢复（resume）
await ctx.resume();

// 获取当前时间
console.log('当前播放位置:', ctx.currentTime, '秒');
```

### 播放进度跳转

`AudioBufferSourceNode` 可以指定 `offset` 和 `duration`：

```js
const source = ctx.createBufferSource();
source.buffer = audioBuffer;
source.connect(ctx.destination);

// 从第 3 秒开始播放，播放 5 秒后停止
source.start(0, 3, 5);
```

### 音量控制

```js
const gain = ctx.createGain();

// 立即设置音量（0 ~ 1）
gain.gain.setValueAtTime(0.5, ctx.currentTime);

// 1 秒内线性渐变到 0
gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);

// 指数衰减到 0.001（适合淡出）
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
```

## 获取麦克风输入

结合 `getUserMedia` 把麦克风接入音频节点图：

```js
async function micInput(ctx) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  // 麦克风 → 增益节点 → 输出（自己听自己的延迟声音）
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  source.connect(gain).connect(ctx.destination);
}
```

麦克风输入可以直接连接到 `MediaRecorder` 录制，或接入效果处理节点。

## 加载 MP3 时自动播放限制

浏览器有自动播放策略限制：带声音的音频不能在没有用户交互的情况下自动播放。如果音频文件本身没有声音（如纯音乐文件），则不受此限制影响。

```js
button.onclick = async () => {
  // 用户点击后创建 context
  const ctx = new AudioContext();
  await ctx.resume();  // 确保不是 suspended
  await playAudio(ctx, '/bg-music.mp3');
};
```

## 注意事项

- **`start()` 只能调用一次**：`AudioBufferSourceNode` 播放完毕后不能重新 start，需要新建节点
- **`ctx.destination` 是最终输出节点**：任何音频最后都要连到它才能出声
- **`ctx.currentTime` 是音频上下文时间**，不是 wall clock，不受 `ctx.suspend()` / `ctx.resume()` 影响
- **OscillatorNode 在 stop 后不能重启**：需要新建节点
