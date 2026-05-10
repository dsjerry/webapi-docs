---
title: Media Stream Handling
description: getUserMedia usage, MediaStream track management, constraint tuning
outline: [2, 3]
---

:::tip Browser Support
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## Overview

`getUserMedia` is the entry point to WebRTC — it asks the browser for camera and microphone permissions and returns a `MediaStream`. This stream can be consumed directly by `<video>` / `<audio>` tags, or added to an `RTCPeerConnection` to send to the peer.

## Quick Start

```html
<video id="local" autoplay muted></video>
<audio id="remote" autoplay></audio>

<script type="module">
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localVideo.srcObject = stream;

  // Then add to RTCPeerConnection
  // stream.getTracks().forEach(track => pc.addTrack(track, stream));
</script>
```

:::warning Note
The `muted` attribute on the local `<video>` prevents echo (your own voice coming from the speaker and being picked up by the mic). Remote audio does not need `muted`.
:::

## Core Concepts

### MediaStream Structure

A `MediaStream` contains multiple `MediaStreamTrack`s:

```js
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

stream.getVideoTracks(); // [MediaStreamTrack]
stream.getAudioTracks(); // [MediaStreamTrack]
stream.getTracks();      // all tracks
```

Each `MediaStreamTrack` can be independently enabled/disabled:

```js
const [videoTrack] = stream.getVideoTracks();
const [audioTrack] = stream.getAudioTracks();

videoTrack.enabled = false; // pause camera (black screen, not released)
videoTrack.stop();          // release camera entirely
```

### Device Enumeration

Enumerate available devices (for user selection):

```js
await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

const devices = await navigator.mediaDevices.enumerateDevices();
// => MediaDeviceInfo[]
//   kind: 'videoinput' | 'audioinput' | 'audiooutput'
//   label: 'FaceTime HD Camera' (non-empty only after permission granted)
//   deviceId: 'xxx'

const cameras = devices.filter(d => d.kind === 'videoinput');
```

### Hot-Swapping Devices

The `devicechange` event fires when cameras are plugged/unplugged:

```js
navigator.mediaDevices.ondevicechange = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const newCameras = devices.filter(d => d.kind === 'videoinput');
  console.log('Current camera count:', newCameras.length);
};
```

## API Reference

### Constraints

Constraints are the most powerful part of `getUserMedia`. You can adjust resolution, frame rate, mic gain, etc.:

```js
// Basic constraints
await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720 },
});

// Range constraints (device tries to get close)
await navigator.mediaDevices.getUserMedia({
  video: {
    width:  { min: 640, ideal: 1280, max: 1920 },
    height: { min: 480, ideal: 720,  max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',   // front camera
    // facingMode: 'environment', // back camera
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
  },
});
```

:::tip
`ideal` is the target value; `min`/`max` are hard boundaries. The browser will try to get as close to `ideal` as possible within constraints.
:::

### Track State

```js
const track = stream.getVideoTracks()[0];

track.readyState    // 'live' | 'ended'
track.enabled       // true / false (pause, don't release)
track.muted         // true (hardware failure or permission lost)
track.kind          // 'video' | 'audio'
track.label         // 'FaceTime HD Camera'
track.getSettings() // current actual media settings
```

### Screenshot / Frame Capture

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

## Notes

- **HTTPS required**: Except for `localhost` and `file://`, `getUserMedia` throws `NotAllowedError` on non-HTTPS
- **Permission prompt only once**: If the user denies, subsequent calls are also denied; guide them to manually enable in browser settings
- **Device labels are empty**: Before permission is granted, `enumerateDevices` returns empty `label` strings; must call `getUserMedia` first to see device names
- **Tab switch pauses media stream**: The stream returned by `getUserMedia` is automatically throttled by the browser when the tab loses focus
- **Multiple cameras simultaneously**: Some devices don't support simultaneous multi-camera input; this can cause lag
