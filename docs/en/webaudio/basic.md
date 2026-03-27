---
title: Web Audio API Basic Usage
description: Creating context, loading audio, playback control — core Web Audio API operations
outline: [2, 3]
---

:::tip Browser Support
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+
:::

## Creating AudioContext

All audio operations start here:

```js
// Modern browsers (newer spec)
const ctx = new AudioContext();

// Legacy Safari (WebKit prefix)
const ctx = new (window.AudioContext || window.webkitAudioContext)();
```

:::warning User Gesture Restriction
Chrome/Edge require AudioContext to be created inside a user interaction callback. If created at the wrong time, the browser auto-suspends it; call `ctx.resume()` to fix.
:::

## Playing an Audio File

Full flow: load → decode → create source node → connect → play:

```js
async function playAudio(ctx, url) {
  // 1. Load audio file
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  // 2. Decode to AudioBuffer
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // 3. Create source node
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  // 4. Connect: source → destination (speakers)
  source.connect(ctx.destination);

  // 5. Play
  source.start(0);  // 0 means start immediately

  return source;
}

button.onclick = async () => {
  const ctx = new AudioContext();
  await playAudio(ctx, '/music.mp3');
};
```

## OscillatorNode (Synthesizing Sound)

OscillatorNode doesn't load files; it generates waveforms directly:

```js
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

// Set waveform type and frequency
osc.type = 'sine';                        // 'sine' | 'square' | 'sawtooth' | 'triangle'
osc.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz = A4

// Set volume
gain.gain.setValueAtTime(0, ctx.currentTime);

// Connect
osc.connect(gain);
gain.connect(ctx.destination);

// Play
osc.start();

// Fade volume from 0 to 0.5 over 1 second (prevent popping)
gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1);

// Stop after 2 seconds
osc.stop(ctx.currentTime + 2);
```

### Waveform Types

| Type | Sound Character | Spectrum |
|------|----------------|---------|
| `sine` | Pure, smooth | Fundamental only |
| `triangle` | Soft, light | Fundamental + odd harmonics |
| `sawtooth` | Bright, harsh | All harmonics |
| `square` | Thick, cartoonish | All harmonics (odd emphasized) |

## Playback Control

### Pause and Resume

```js
// Pause (suspend)
await ctx.suspend();

// Resume
await ctx.resume();

// Get current time
console.log('Current position:', ctx.currentTime, 'seconds');
```

### Seeking

`AudioBufferSourceNode` can specify `offset` and `duration`:

```js
const source = ctx.createBufferSource();
source.buffer = audioBuffer;
source.connect(ctx.destination);

// Start from 3s, stop after 5s
source.start(0, 3, 5);
```

### Volume Control

```js
const gain = ctx.createGain();

// Set volume immediately (0 ~ 1)
gain.gain.setValueAtTime(0.5, ctx.currentTime);

// Linear ramp to 0 over 1 second
gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);

// Exponential decay to 0.001 (good for fade out)
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
```

## Getting Microphone Input

Integrate microphone into the audio node graph with `getUserMedia`:

```js
async function micInput(ctx) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  source.connect(gain).connect(ctx.destination);
}
```

Microphone input can be connected directly to `MediaRecorder` for recording, or piped into effect processing nodes.

## Autoplay Restrictions

Browsers have autoplay policies: audio with sound cannot auto-play without user interaction. If the audio file itself has no sound (e.g., pure music file), this restriction doesn't apply.

```js
button.onclick = async () => {
  const ctx = new AudioContext();
  await ctx.resume();
  await playAudio(ctx, '/bg-music.mp3');
};
```

## Notes

- **`start()` can only be called once**: `AudioBufferSourceNode` cannot `start()` again after playback finishes; create a new node
- **`ctx.destination` is the final output node**: All audio must connect to it to make sound
- **`ctx.currentTime` is audio context time**, not wall clock; not affected by `ctx.suspend()` / `ctx.resume()`
- **OscillatorNode cannot restart after stop**: Need to create a new node
