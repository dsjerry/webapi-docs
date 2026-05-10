---
title: Web Audio API 概述
description: Web Audio API 是什么，为什么它是浏览器音频处理的首选方案
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+
所有现代浏览器均已支持，包括移动端。
:::

## 概述

浏览器原生支持两种音频 API：`Audio` 元素（`<audio>`）适合播放文件，而 **Web Audio API** 则是一套完整的**音频信号处理引擎**。

Web Audio API 基于"音频节点图"（Audio Node Graph）工作：将音频信号流经一系列处理节点（GainNode 增益、AnalyserNode 分析、BiquadFilterNode 滤波），最后输出到扬声器。这种节点组合的方式让你可以像搭积木一样构建任意复杂的音频处理链路。

简单说：你想做音频可视化、音效处理、合成器、DJ 应用？Web Audio API 就是为此而生。

## 和 `<audio>` 元素的区别

| | `<audio>` | Web Audio API |
|--|----------|---------------|
| 控制粒度 | 仅播放/暂停/跳转 | 精确到采样级别的处理 |
| 实时处理 | 不支持 | 支持（延迟、混响、滤波实时叠加） |
| 音频分析 | 不支持 | 支持（AnalyserNode 获取频谱） |
| 多轨道混音 | 难实现 | 自然支持（节点图连接） |
| 适用场景 | 背景音乐、视频配音 | 音效处理、音乐制作、语音处理 |

## 快速上手

<!-- 快速上手：创建一个可听见的声音 -->
```js
// 必须放在用户交互事件中（点击按钮触发）
button.onclick = () => {
  const ctx = new AudioContext();

  // 创建振荡器（方形波，440Hz = A4 音）
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);

  // 创建增益节点（控制音量）
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime); // 30% 音量

  // 连接并播放
  osc.connect(gain).connect(ctx.destination);
  osc.start();

  // 1 秒后自动停止
  osc.stop(ctx.currentTime + 1);
};
```

## 核心概念

### AudioContext

所有音频操作的入口，类似 Canvas 的 `getContext('2d')`：

```js
// 创建音频上下文（新浏览器需要用户交互后才能创建）
const ctx = new AudioContext();
```

:::warning 用户手势限制
Chrome 浏览器要求 `AudioContext` 必须在用户交互（如 click）事件回调中创建，否则会被自动暂停。
:::

### 音频节点（AudioNode）

音频节点是音频处理的基本单元，分为三类：

| 类型 | 示例 | 作用 |
|------|------|------|
| 音源节点 | `OscillatorNode`、`AudioBufferSourceNode` | 产生音频信号 |
| 处理节点 | `GainNode`、`BiquadFilterNode`、`ConvolverNode` | 修改信号 |
| 输出节点 | `AudioDestinationNode`（扬声器） | 最终输出 |

### 音频节点图

```
[音源] → [处理节点A] → [处理节点B] → ... → [输出]
```

```js
const ctx = new AudioContext();

// 创建节点
const osc = ctx.createOscillator();   // 振荡器（产生声音）
const gain = ctx.createGain();         // 增益（控制音量）

// 连接：osc → gain → 扬声器
osc.connect(gain);
gain.connect(ctx.destination);

osc.start();  // 开始播放
gain.gain.setValueAtTime(0, ctx.currentTime);  // 静音
```

## 常用节点一览

| 节点 | 用途 |
|------|------|
| `OscillatorNode` | 合成波形（正弦、方波、锯齿、三角） |
| `AudioBufferSourceNode` | 播放已加载的音频文件 |
| `GainNode` | 控制音量增益 |
| `BiquadFilterNode` | 低通、高通、带通滤波 |
| `DelayNode` | 延迟效果 |
| `ConvolverNode` | 卷积混响 |
| `AnalyserNode` | 频谱/波形分析（可视化用） |
| `AudioWorkletNode` | 自定义采样级处理（替代废弃的 ScriptProcessorNode） |
| `MediaStreamSource` | 麦克风输入 |
| `MediaRecorder` | 录制音频到文件 |

## 注意事项

- **用户手势限制**：AudioContext 在新浏览器中默认暂停，需要在用户点击等交互后调用 `ctx.resume()`
- **节点只能连接一次但可断开**：同一个 `AudioBufferSourceNode` 可以同时连接多个目标节点
- **音频文件需要先解码**：用 `ctx.decodeAudioData(arrayBuffer)` 把 MP3/WAV 转成 AudioBuffer 才能播放
- **节点不能复用**：每个节点创建后不能重置参数重新使用，需要新建节点
