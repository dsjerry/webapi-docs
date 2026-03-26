---
title: 媒体流处理
description: getUserMedia 的用法、MediaStream 轨道管理、约束条件调优
outline: [2, 3]
---

:::tip 浏览器支持
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## 概述

`getUserMedia` 是 WebRTC 的入口——它让浏览器向用户申请摄像头和麦克风权限，返回一条 `MediaStream`（媒体流）。这条流可以被 `video` / `audio` 标签直接消费，也可以加到 `RTCPeerConnection` 上发送给对端。

## 快速上手

<!-- 快速上手：获取摄像头 + 麦克风并显示 -->
```html
<video id="local" autoplay muted></video>
<audio id="remote" autoplay></audio>

<script type="module">
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localVideo.srcObject = stream;

  // 后续加到 RTCPeerConnection 上
  // stream.getTracks().forEach(track => pc.addTrack(track, stream));
</script>
```

:::warning 注意
`muted` 属性加在本地 `video` 上是为了防止回音（你自己说话的声音从扬声器出来再被麦克风录进去）。远程音频不需要 `muted`。
:::

## 核心概念

### MediaStream 的结构

一条 `MediaStream` 包含多个 `MediaStreamTrack`：

```js
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

stream.getVideoTracks(); // [MediaStreamTrack]
stream.getAudioTracks(); // [MediaStreamTrack]
stream.getTracks();      // 全部轨道
```

每个 `MediaStreamTrack` 可以独立开启/关闭：

```js
const [videoTrack] = stream.getVideoTracks();
const [audioTrack] = stream.getAudioTracks();

videoTrack.enabled = false; // 暂停摄像头（黑屏但不释放）
videoTrack.stop();          // 彻底释放摄像头
```

### 设备枚举

枚举可用设备（用于让用户选择）：

```js
// 先请求权限
await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

const devices = await navigator.mediaDevices.enumerateDevices();
// => MediaDeviceInfo[]
//   kind: 'videoinput' | 'audioinput' | 'audiooutput'
//   label: 'FaceTime HD Camera'（需要已授权才非空）
//   deviceId: 'xxx'

const cameras = devices.filter(d => d.kind === 'videoinput');
```

### 设备切换（热插拔）

摄像头插拔时触发 `devicechange` 事件：

```js
navigator.mediaDevices.ondevicechange = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const newCameras = devices.filter(d => d.kind === 'videoinput');
  console.log('当前摄像头数:', newCameras.length);
};
```

## API 详解

### 约束条件（Constraints）

约束是 `getUserMedia` 最强大的部分。你可以通过它调整分辨率、帧率、麦克风增益等：

```js
// 基础约束
await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720 },
});

// 范围约束（设备尽量接近）
await navigator.mediaDevices.getUserMedia({
  video: {
    width:  { min: 640, ideal: 1280, max: 1920 },
    height: { min: 480, ideal: 720,  max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',   // 前置摄像头
    // facingMode: 'environment', // 后置摄像头
  },
  audio: {
    echoCancellation: true,    // 回声消除
    noiseSuppression: true,    // 降噪
    autoGainControl: true,     // 自动增益
    sampleRate: 44100,
  },
});
```

:::tip
`ideal` 是目标值，`min`/`max` 是硬性边界。浏览器会在满足条件的情况下尽量逼近 `ideal`。
:::

### 轨道状态

```js
const track = stream.getVideoTracks()[0];

track.readyState    // 'live' | 'ended'
track.enabled       // true / false（暂停，不释放）
track.muted         // true（硬件故障或权限丢失）
track.kind          // 'video' | 'audio'
track.label         // 'FaceTime HD Camera'
track.getSettings() // 当前实际使用的媒体设置
```

### 截图 / 帧捕获

```js
const video = document.getElementById('local');

video.addEventListener('loadedmetadata', () => {
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const img = canvas.toDataURL('image/png');
  // => data:image/png;base64,xxxxx
});
```

## 实战案例

实现一个可切换分辨率 + 前/后摄像头的直播预览：

```js
class CameraPreview {
  constructor(videoEl) {
    this.video = videoEl;
    this.stream = null;
  }

  async start({ facingMode = 'user', width = 1280 } = {}) {
    this.stop();

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: width },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });

    this.video.srcObject = this.stream;
    await this.video.play();
  }

  switchFacing() {
    const current = this.stream?.getVideoTracks()[0]?.getSettings().facingMode;
    const next = current === 'user' ? 'environment' : 'user';
    return this.start({ facingMode: next });
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}

// 用法
const preview = new CameraPreview(document.getElementById('cam'));
await preview.start();
document.getElementById('flip').onclick = () => preview.switchFacing();
document.getElementById('stop').onclick = () => preview.stop();
```

## 注意事项

- **HTTPS 强制**：除 `localhost` 和 `file://` 外，`getUserMedia` 在非 HTTPS 下直接抛出 `NotAllowedError`
- **权限提示只弹一次**：用户拒绝后再次调用仍会拒绝，需要引导用户在浏览器设置里手动开启
- **设备标签为空**：未授权前 `enumerateDevices` 返回的 `label` 为空字符串；必须先 `getUserMedia` 一次授权后才能看到设备名
- **Tab 切换会暂停媒体流**：`getUserMedia` 返回的流在 Tab 失焦时浏览器会自动降低帧率节省资源
- **同时开多个摄像头**：部分设备不支持，同时采集多路视频会卡顿
