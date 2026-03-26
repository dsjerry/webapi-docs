---
title: Web Audio API 进阶用法
description: 音效处理、频谱分析、录音、MIDI — 让 Web Audio 在生产环境可靠运行
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+
:::

## 频谱分析（AnalyserNode）

AnalyserNode 可以实时获取音频的频域/时域数据，用于可视化：

```js
const ctx = new AudioContext();
const analyser = ctx.createAnalyser();

// 配置
analyser.fftSize = 2048;        // FFT 窗口大小（越大频率分辨率越高）
analyser.smoothingTimeConstant = 0.8; // 平滑系数 0~1，1 最平滑

// 连接：音源 → analyser → 扬声器
source.connect(analyser);
analyser.connect(ctx.destination);

// 获取频域数据（Uint8Array，长度 = fftSize / 2）
const frequencyData = new Uint8Array(analyser.frequencyBinCount); // 1024

function draw() {
  analyser.getByteFrequencyData(frequencyData);
  // frequencyData[i] 的值范围 0~255，对应频率 i * (sampleRate / fftSize) Hz
  requestAnimationFrame(draw);
}
draw();
```

### 时域波形数据

```js
const timeData = new Uint8Array(analyser.fftSize);
analyser.getByteTimeDomainData(timeData); // 时域波形（0~255，128 为静音基线）
```

## 滤波器（BiquadFilterNode）

BiquadFilterNode 实现常见的音频滤波器：

```js
const filter = ctx.createBiquadFilter();

// 滤波器类型
filter.type = 'lowpass';   // 低通：保留低频，衰减高频
filter.type = 'highpass';  // 高通：保留高频，衰减低频
filter.type = 'bandpass';  // 带通：只保留某个频段
filter.type = 'notch';     // 陷波：切除某个频段
filter.type = 'peaking';   // 峰值：增强/削减某个频段

// 中心频率（Hz）
filter.frequency.setValueAtTime(1000, ctx.currentTime);

// Q 值（品质因子，控制带宽。Q 越高频段越窄）
filter.Q.setValueAtTime(1, ctx.currentTime);

// 增益（peaking 类型专用，dB 单位）
filter.gain.setValueAtTime(6, ctx.currentTime);
```

### 均衡器示例（三段）

```js
function createEQ(ctx, source) {
  // 低频：100Hz 低通，增益 +3dB
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 100;
  low.gain.value = 3;

  // 中频：1kHz 带通，增益 -2dB（削减人声）
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1000;
  mid.gain.value = -2;
  mid.Q.value = 1;

  // 高频：8kHz 高架，增益 +4dB
  const high = ctx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 8000;
  high.gain.value = 4;

  // 串联
  source.connect(low).connect(mid).connect(high).connect(ctx.destination);
}
```

## 延迟效果（DelayNode）

```js
const delay = ctx.createDelay(5.0); // 最大延迟 5 秒
delay.delayTime.value = 0.3;         // 当前延迟 0.3 秒

// 干湿混合
const dryGain = ctx.createGain();
const wetGain = ctx.createGain();
const feedbackGain = ctx.createGain();

dryGain.gain.value = 0.6;
wetGain.gain.value = 0.4;
feedbackGain.gain.value = 0.3; // 反馈量

source.connect(dryGain).connect(ctx.destination);        // 干信号
source.connect(delay);
delay.connect(wetGain).connect(ctx.destination);          // 湿信号
delay.connect(feedbackGain).connect(delay);               // 反馈回路
```

## 录音（MediaRecorder + Blob）

把麦克风输入录制为音频文件：

```js
async function recordMic(durationSec = 5) {
  const ctx = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);

  // MediaRecorder 直接从 MediaStream 录制（不需要接入 AudioContext）
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks = [];

  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    // 下载文件
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recording.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  recorder.start();
  setTimeout(() => recorder.stop(), durationSec * 1000);
}
```

## 混响（ConvolverNode）

使用脉冲响应文件（IR）模拟真实空间：

```js
async function loadIR(ctx, url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return ctx.decodeAudioData(buf);
}

async function addReverb(ctx, source, irUrl) {
  const convolver = ctx.createConvolver();
  convolver.buffer = await loadIR(ctx, irUrl);

  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 0.7;
  wetGain.gain.value = 0.3;

  source.connect(dryGain).connect(ctx.destination);
  source.connect(convolver).connect(wetGain).connect(ctx.destination);
}
```

## 音频事件调度

用精确时间调度音符，实现音序器：

```js
const ctx = new AudioContext();

function playNote(frequency, startTime, duration = 0.5) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.value = frequency;
  osc.connect(gain).connect(ctx.destination);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// 演奏 C 大调音阶（每个音符间隔 0.3 秒）
const C_MAJOR = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
const start = ctx.currentTime + 0.1;
C_MAJOR.forEach((freq, i) => {
  playNote(freq, start + i * 0.3);
});
```

## AudioWorklet（自定义音频处理）

AudioWorklet 允许用 JavaScript 代码做自定义 DSP（运行在工作线程，不阻塞主线程）：

```js
// 注册处理器（在单独的文件中）
// processor.js
class BitcrusherProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.quantizationSteps = 16;
  }
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    for (let ch = 0; ch < input.length; ch++) {
      for (let i = 0; i < input[ch].length; i++) {
        const step = 2 / this.quantizationSteps;
        output[ch][i] = step * Math.floor(input[ch][i] / step + 0.5);
      }
    }
    return true;
  }
}
registerProcessor('bitcrusher', BitcrusherProcessor);
```

```js
// 主线程加载
await ctx.audioWorklet.addModule('/processor.js');
const crusher = new AudioWorkletNode(ctx, 'bitcrusher');
```

:::tip AudioWorklet vs ScriptProcessorNode
`ScriptProcessorNode` 已废弃（运行在主线程，会卡 UI）。新项目必须用 `AudioWorklet`。
:::

## 注意事项

- **`AnalyserNode.getByteFrequencyData()` 每帧都要调用**：放在 `requestAnimationFrame` 循环里，避免 CPU 空转
- **音频节点链不要太长**：超过 10 个处理节点会增加延迟，建议控制在 5-8 个以内
- **MediaRecorder 的 mimeType**：不是所有浏览器都支持所有格式。录制前先检查 `MediaRecorder.isTypeSupported()`
- **`ctx.close()` 会销毁所有节点**：关闭上下文后无法恢复，需要重建
