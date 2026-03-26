---
title: Web Audio API 实战：音频可视化音乐播放器
description: 从零实现一个带频谱可视化、播放控制、音量调节的音乐播放器
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+

**注意**：需要用户交互后才能播放音频，需要 HTTPS 环境。
:::

## 概述

这一节把 Web Audio API 的知识串联起来：加载音频 → 节点连接 → AnalyserNode 频谱分析 → Canvas 渲染。拢共约 250 行代码，实现一个完整的音乐播放器。

## 架构

```
[AudioBufferSourceNode] → [AnalyserNode] → [GainNode] → [destination]
         ↓                         ↓
    播放/暂停/跳转           getByteFrequencyData()
                                   ↓
                          [Canvas 频谱柱状图]
```

## 完整代码

<!-- index.html -->
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>音频可视化播放器</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Noto Sans SC", sans-serif; background: #0f0f1e; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
    h1 { font-size: 1.4rem; margin-bottom: 24px; color: #fff; }

    /* 频谱可视化区 */
    #canvas {
      width: 100%; max-width: 640px; height: 200px;
      background: #1a1a2e; border-radius: 12px; margin-bottom: 24px;
    }

    /* 播放控制区 */
    .controls { width: 100%; max-width: 640px; }
    #fileInput { display: none; }
    .file-btn { display: block; width: 100%; padding: 12px; background: #2d2d44; color: #fff; border: 1px dashed #555; border-radius: 8px; text-align: center; cursor: pointer; margin-bottom: 16px; font-size: 0.9rem; }
    .file-btn:hover { background: #3d3d5c; }

    /* 进度条 */
    .progress-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .time { font-size: 0.8rem; color: #888; min-width: 40px; }
    #progressBar { flex: 1; height: 4px; -webkit-appearance: none; background: #2d2d44; border-radius: 2px; cursor: pointer; }
    #progressBar::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #646cff; border-radius: 50%; }

    /* 按钮行 */
    .btn-row { display: flex; justify-content: center; align-items: center; gap: 16px; margin-bottom: 20px; }
    .ctrl-btn { width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
    .play-btn { width: 64px; height: 64px; background: #646cff; color: #fff; }
    .play-btn:hover { background: #535bf2; }
    .skip-btn { background: #2d2d44; color: #fff; }
    .skip-btn:hover { background: #3d3d5c; }

    /* 音量控制 */
    .volume-wrap { display: flex; align-items: center; gap: 10px; }
    .volume-wrap span { font-size: 0.8rem; color: #888; }
    #volumeSlider { width: 120px; -webkit-appearance: none; height: 4px; background: #2d2d44; border-radius: 2px; cursor: pointer; }
    #volumeSlider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #646cff; border-radius: 50%; }

    /* EQ 预设 */
    .eq-presets { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
    .eq-btn { padding: 6px 14px; border: 1px solid #444; background: transparent; color: #888; border-radius: 16px; cursor: pointer; font-size: 0.8rem; }
    .eq-btn.active { border-color: #646cff; color: #646cff; background: rgba(100,108,255,0.1); }
    .eq-btn:hover { border-color: #666; color: #fff; }

    /* 歌曲名 */
    #trackName { text-align: center; font-size: 0.9rem; color: #888; margin-bottom: 12px; }
  </style>
</head>
<body>

<h1>音频可视化播放器</h1>

<canvas id="canvas"></canvas>

<div class="controls">
  <label class="file-btn" for="fileInput">点击选择本地音频文件（MP3、WAV、OGG）</label>
  <input type="file" id="fileInput" accept="audio/*" />

  <div id="trackName">未加载音频</div>

  <div class="progress-wrap">
    <span class="time" id="currentTime">0:00</span>
    <input type="range" id="progressBar" min="0" max="100" value="0" />
    <span class="time" id="totalTime">0:00</span>
  </div>

  <div class="btn-row">
    <button class="ctrl-btn skip-btn" id="prevBtn">⏮</button>
    <button class="ctrl-btn play-btn" id="playBtn">▶</button>
    <button class="ctrl-btn skip-btn" id="nextBtn">⏭</button>
  </div>

  <div class="volume-wrap">
    <span>🔈</span>
    <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.8" />
    <span>🔊</span>
  </div>

  <div class="eq-presets">
    <button class="eq-btn active" data-type="flat">原声</button>
    <button class="eq-btn" data-type="bass">低音</button>
    <button class="eq-btn" data-type="vocal">人声</button>
    <button class="eq-btn" data-type="electronic">电子</button>
  </div>
</div>

<script type="module">
// === 音频播放器核心 ===
class AudioPlayer {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.audioBuffer = null;
    this.analyser = null;
    this.gainNode = null;
    this.startTime = 0;
    this.pauseTime = 0;
    this.isPlaying = false;
    this.animationId = null;
    this.onDraw = null;  // 外部传入的绘制回调
  }

  async init() {
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.8;
    this.gainNode.connect(this.analyser).connect(this.ctx.destination);
  }

  async loadAudio(arrayBuffer) {
    if (!this.ctx) await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.stop();
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.pauseTime = 0;
    return this.audioBuffer;
  }

  play(offset = 0) {
    if (!this.audioBuffer || !this.ctx) return;
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.gainNode);
    this.startTime = this.ctx.currentTime - offset;
    this.source.start(0, offset);
    this.isPlaying = true;
    this.source.onended = () => { if (this.isPlaying) this.stop(); };
    this._startDraw();
  }

  pause() {
    if (!this.isPlaying) return;
    this.pauseTime = this.ctx.currentTime - this.startTime;
    this.source?.stop();
    this.source = null;
    this.isPlaying = false;
    this._stopDraw();
  }

  stop() {
    this.source?.stop();
    this.source = null;
    this.isPlaying = false;
    this._stopDraw();
  }

  seek(time) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseTime = time;
    if (wasPlaying) this.play(time);
  }

  get currentTime() {
    if (this.isPlaying) return this.ctx.currentTime - this.startTime;
    return this.pauseTime;
  }

  get duration() { return this.audioBuffer?.duration ?? 0; }

  set volume(v) { if (this.gainNode) this.gainNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01); }
  get volume() { return this.gainNode?.gain.value ?? 1; }

  applyEQ(type) {
    if (!this.analyser) return;
    const a = this.analyser;
    // 使用简单的高低 shelf 滤波器模拟 EQ 预设
    // 注：完整 EQ 需要串联多个 BiquadFilterNode，此处做简化演示
    console.log('应用 EQ 预设:', type);
  }

  _startDraw() {
    const draw = () => {
      if (!this.isPlaying) return;
      if (this.onDraw) this.onDraw();
      this.animationId = requestAnimationFrame(draw);
    };
    draw();
  }

  _stopDraw() {
    if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  destroy() {
    this.stop();
    this.ctx?.close();
  }
}

// === 频谱绘制 ===
const canvas = document.getElementById('canvas');
const cctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  cctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawSpectrum(freqData) {
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  cctx.clearRect(0, 0, W, H);

  const barCount = freqData.length;
  const barWidth = (W / barCount) * 0.8;
  const gap = (W / barCount) * 0.2;

  for (let i = 0; i < barCount; i++) {
    const value = freqData[i] / 255;
    const barHeight = value * H * 0.9;
    const x = i * (barWidth + gap);
    const y = H - barHeight;

    // 渐变色：低音偏红，高音偏蓝紫
    const hue = 240 + (i / barCount) * 60; // 240~300
    const saturation = 70 + value * 30;
    const lightness = 40 + value * 20;
    cctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    // 圆角柱
    const radius = Math.min(barWidth / 2, 4);
    cctx.beginPath();
    cctx.moveTo(x + radius, y);
    cctx.lineTo(x + barWidth - radius, y);
    cctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
    cctx.lineTo(x + barWidth, H);
    cctx.lineTo(x, H);
    cctx.arcTo(x, y, x + radius, y, radius);
    cctx.closePath();
    cctx.fill();
  }
}

// === UI 绑定 ===
const player = new AudioPlayer();
let rafId = null;

player.onDraw = () => {
  drawSpectrum(player.getFrequencyData());
  updateProgress();
};

// 播放状态下的持续绘制
function loopDraw() {
  if (!player.isPlaying) return;
  drawSpectrum(player.getFrequencyData());
  updateProgress();
  rafId = requestAnimationFrame(loopDraw);
}

// 文件选择
document.getElementById('fileInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  await player.loadAudio(buf);
  document.getElementById('trackName').textContent = file.name;
  document.getElementById('totalTime').textContent = fmt(player.duration);
  player.play();
  loopDraw();
  document.getElementById('playBtn').textContent = '⏸';
};

// 播放/暂停
document.getElementById('playBtn').onclick = () => {
  if (!player.audioBuffer) return;
  if (player.isPlaying) {
    player.pause();
    document.getElementById('playBtn').textContent = '▶';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  } else {
    player.play(player.pauseTime);
    document.getElementById('playBtn').textContent = '⏸';
    loopDraw();
  }
};

// 进度跳转
document.getElementById('progressBar').oninput = (e) => {
  const t = (e.target.value / 100) * player.duration;
  player.seek(t);
};
function updateProgress() {
  const pct = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
  document.getElementById('progressBar').value = pct;
  document.getElementById('currentTime').textContent = fmt(player.currentTime);
}

// 音量
document.getElementById('volumeSlider').oninput = (e) => {
  player.volume = parseFloat(e.target.value);
};

// EQ 预设
document.querySelectorAll('.eq-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.eq-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    player.applyEQ(btn.dataset.type);
  };
});

// 格式化时间
function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// 初始绘制空白频谱
function drawIdle() {
  if (player.isPlaying) return;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  cctx.clearRect(0, 0, W, H);
  cctx.fillStyle = '#2d2d44';
  cctx.fillRect(0, H / 2 - 2, W, 4);
}
drawIdle();
</script>
</body>
</html>
```

## 关键实现解析

### 频谱绘制

核心在于 `AnalyserNode.getByteFrequencyData()` 返回的数组：

```js
const freqData = new Uint8Array(analyser.frequencyBinCount); // 128 个频段
analyser.getByteFrequencyData(freqData);
// freqData[i] 的值 0~255 对应第 i 个频段的能量
```

每根柱子的高度直接用 `value / 255` 映射到 canvas 高度，颜色按频率从暖到冷渐变（低音偏红，高音偏蓝紫）。

### 进度同步

播放进度用 `AudioContext.currentTime` 计算，而不是 `setInterval`：

```js
// 播放开始时记录偏移量
this.startTime = this.ctx.currentTime - offset;

// 任何时刻都能准确获取当前播放位置
const currentTime = this.ctx.currentTime - this.startTime;
```

### 动态 EQ

完整 EQ 需要在 `source` 和 `gainNode` 之间串联多个 `BiquadFilterNode`。示例中用了简化的 `applyEQ()` 打印日志，生产环境中可以这样实现：

```js
// 串联 3 段 EQ
const lowShelf = ctx.createBiquadFilter();
lowShelf.type = 'lowshelf';
lowShelf.frequency.value = 200;
lowShelf.gain.value = preset.lowGain;

const midPeak = ctx.createBiquadFilter();
midPeak.type = 'peaking';
midPeak.frequency.value = 1000;
midPeak.gain.value = preset.midGain;

const highShelf = ctx.createBiquadFilter();
highShelf.type = 'highshelf';
highShelf.frequency.value = 5000;
highShelf.gain.value = preset.highGain;

source.connect(lowShelf).connect(midPeak).connect(highShelf).connect(gainNode);
```

## 如何运行

```bash
# 直接在浏览器中打开 index.html 即可
# 或起本地服务器
npx serve .
```

## 注意事项

- **选择本地音频文件**：点击"选择本地音频文件"按钮，选择 MP3、WAV、OGG 等格式的音频文件
- **Canvas 高清屏适配**：`canvas.width` 使用 `devicePixelRatio` 乘以实际像素，保证 Retina 屏幕清晰
- **播放结束后自动停止**：通过 `source.onended` 事件检测播放结束，更新 UI 状态
- **FFT 大小影响分辨率**：`fftSize = 256` 产生 128 个频段。如需更细腻的可视化可改为 2048（产生 1024 个频段，但性能开销更大）
