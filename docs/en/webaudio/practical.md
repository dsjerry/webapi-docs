---
title: "Web Audio API Practical: Audio Visualizer Music Player"
description: Build a music player with spectrum visualization, playback control, and volume adjustment from scratch
outline: [2, 3]
---

:::tip Browser Support
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+

**Note**: User interaction required before audio playback; HTTPS environment required.
:::

## Overview

This section ties together everything: load audio → node connection → AnalyserNode spectrum analysis → Canvas rendering. ~250 lines of code, a complete music player.

## Architecture

```
[AudioBufferSourceNode] → [AnalyserNode] → [GainNode] → [destination]
         ↓                         ↓
    play/pause/seek         getByteFrequencyData()
                                   ↓
                          [Canvas spectrum bars]
```

## Complete Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Audio Visualizer Player</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui; background: #0f0f1e; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
    h1 { font-size: 1.4rem; margin-bottom: 24px; }
    #canvas { width: 100%; max-width: 640px; height: 200px; background: #1a1a2e; border-radius: 12px; margin-bottom: 24px; }
    .controls { width: 100%; max-width: 640px; }
    #fileInput { display: none; }
    .file-btn { display: block; width: 100%; padding: 12px; background: #2d2d44; color: #fff; border: 1px dashed #555; border-radius: 8px; text-align: center; cursor: pointer; margin-bottom: 16px; font-size: 0.9rem; }
    .file-btn:hover { background: #3d3d5c; }
    .progress-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .time { font-size: 0.8rem; color: #888; min-width: 40px; }
    #progressBar { flex: 1; height: 4px; -webkit-appearance: none; background: #2d2d44; border-radius: 2px; cursor: pointer; }
    #progressBar::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #646cff; border-radius: 50%; }
    .btn-row { display: flex; justify-content: center; align-items: center; gap: 16px; margin-bottom: 20px; }
    .ctrl-btn { width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
    .play-btn { width: 64px; height: 64px; background: #646cff; color: #fff; }
    .play-btn:hover { background: #535bf2; }
    .skip-btn { background: #2d2d44; color: #fff; }
    .skip-btn:hover { background: #3d3d5c; }
    .volume-wrap { display: flex; align-items: center; gap: 10px; }
    .volume-wrap span { font-size: 0.8rem; color: #888; }
    #volumeSlider { width: 120px; -webkit-appearance: none; height: 4px; background: #2d2d44; border-radius: 2px; cursor: pointer; }
    #volumeSlider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #646cff; border-radius: 50%; }
    .eq-presets { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
    .eq-btn { padding: 6px 14px; border: 1px solid #444; background: transparent; color: #888; border-radius: 16px; cursor: pointer; font-size: 0.8rem; }
    .eq-btn.active { border-color: #646cff; color: #646cff; background: rgba(100,108,255,0.1); }
    .eq-btn:hover { border-color: #666; color: #fff; }
    #trackName { text-align: center; font-size: 0.9rem; color: #888; margin-bottom: 12px; }
  </style>
</head>
<body>

<h1>Audio Visualizer Player</h1>

<canvas id="canvas"></canvas>

<div class="controls">
  <label class="file-btn" for="fileInput">Click to select local audio file (MP3, WAV, OGG)</label>
  <input type="file" id="fileInput" accept="audio/*" />

  <div id="trackName">No audio loaded</div>

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
    <button class="eq-btn active" data-type="flat">Flat</button>
    <button class="eq-btn" data-type="bass">Bass</button>
    <button class="eq-btn" data-type="vocal">Vocal</button>
    <button class="eq-btn" data-type="electronic">Electronic</button>
  </div>
</div>

<script type="module">
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
    this.onDraw = null;
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
    const hue = 240 + (i / barCount) * 60;
    const saturation = 70 + value * 30;
    const lightness = 40 + value * 20;
    cctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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

const player = new AudioPlayer();
let rafId = null;

player.onDraw = () => {
  drawSpectrum(player.getFrequencyData());
  updateProgress();
};

function loopDraw() {
  if (!player.isPlaying) return;
  drawSpectrum(player.getFrequencyData());
  updateProgress();
  rafId = requestAnimationFrame(loopDraw);
}

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

document.getElementById('progressBar').oninput = (e) => {
  const t = (e.target.value / 100) * player.duration;
  player.seek(t);
};

function updateProgress() {
  const pct = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
  document.getElementById('progressBar').value = pct;
  document.getElementById('currentTime').textContent = fmt(player.currentTime);
}

document.getElementById('volumeSlider').oninput = (e) => {
  player.volume = parseFloat(e.target.value);
};

document.querySelectorAll('.eq-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.eq-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function drawIdle() {
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

## Key Implementation Notes

### Spectrum Drawing

`AnalyserNode.getByteFrequencyData()` returns an array where each element's value (0~255) maps to a frequency band's energy:

```js
const freqData = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(freqData);
// freqData[i] value 0~255 = energy of the i-th frequency band
```

Each bar's height is `value / 255` mapped to canvas height. Color gradients from warm (bass) to cool (treble).

### Progress Sync

Playback position is calculated from `AudioContext.currentTime`, not `setInterval`:

```js
this.startTime = this.ctx.currentTime - offset;
const currentTime = this.ctx.currentTime - this.startTime;
```

### Dynamic EQ

Full EQ requires chaining multiple `BiquadFilterNode`s between `source` and `gainNode`. The example uses simplified logging.

## How to Run

```bash
# Open directly in browser, or serve locally
npx serve .
```

## Notes

- **Select local audio file**: Click "Select local audio file" button; MP3, WAV, OGG formats supported
- **Canvas HiDPI**: Use `devicePixelRatio` on `canvas.width` for sharp rendering on Retina displays
- **Auto-stop on playback end**: Detected via `source.onended` event to update UI state
- **FFT size affects resolution**: `fftSize = 256` gives 128 frequency bands. Use 2048 for finer visualization (1024 bands, more CPU overhead)
