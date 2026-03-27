---
title: Web Audio API Overview
description: What Web Audio API is and why it's the go-to solution for browser audio processing
outline: [2, 3]
---

:::tip Browser Support
Chrome 35+ · Firefox 25+ · Safari 14.1+ · Edge 79+
All modern browsers support it, including mobile.
:::

## Overview

The browser natively supports two audio APIs: the `<audio>` element is great for playing files, while **Web Audio API** is a complete **audio signal processing engine**.

Web Audio API works on an "Audio Node Graph": audio signals flow through a series of processing nodes (GainNode for gain, AnalyserNode for analysis, BiquadFilterNode for filtering), and finally output to speakers. This node-composition approach lets you build arbitrarily complex audio processing chains like building with blocks.

In short: want to do audio visualization, sound effects, synthesizers, DJ apps? Web Audio API is what it was built for.

## Essential Difference from `<audio>` Element

| | `<audio>` | Web Audio API |
|--|----------|---------------|
| Control granularity | Play/pause/seek only | Sample-level precision |
| Real-time processing | Not supported | Supported (delay, reverb, filtering in real time) |
| Audio analysis | Not supported | Supported (AnalyserNode for spectrum) |
| Multi-track mixing | Hard to implement | Naturally supported (node graph routing) |
| Use case | Background music, video audio | Sound effects, music production, voice processing |

## Core Concepts

### AudioContext

The entry point for all audio operations, similar to Canvas's `getContext('2d')`:

```js
// Create audio context (newer browsers require user interaction to create)
const ctx = new AudioContext();
```

:::warning User Gesture Restriction
Chrome requires `AudioContext` to be created inside a user interaction (e.g., click) event callback, otherwise it's auto-suspended.
:::

### AudioNode

AudioNode is the basic unit of audio processing, in three categories:

| Type | Examples | Role |
|------|---------|------|
| Source nodes | `OscillatorNode`, `AudioBufferSourceNode` | Generate audio signals |
| Processing nodes | `GainNode`, `BiquadFilterNode`, `ConvolverNode` | Modify signals |
| Output nodes | `AudioDestinationNode` (speakers) | Final output |

### Audio Node Graph

```
[Source] → [Processing Node A] → [Processing Node B] → ... → [Output]
```

```js
const ctx = new AudioContext();

// Create nodes
const osc = ctx.createOscillator();   // oscillator (generates sound)
const gain = ctx.createGain();         // gain (volume control)

// Connect: osc → gain → speakers
osc.connect(gain);
gain.connect(ctx.destination);

osc.start();
gain.gain.setValueAtTime(0, ctx.currentTime);  // mute
```

## Quick Start

```js
button.onclick = async () => {
  const ctx = new AudioContext();
  await ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz = A4

  gain.gain.setValueAtTime(0.3, ctx.currentTime);

  osc.connect(gain).connect(ctx.destination);
  osc.start();

  osc.stop(ctx.currentTime + 1);
};
```

## Common Nodes

| Node | Purpose |
|------|---------|
| `OscillatorNode` | Synthesize waveforms (sine, square, sawtooth, triangle) |
| `AudioBufferSourceNode` | Play loaded audio files |
| `GainNode` | Control volume/gain |
| `BiquadFilterNode` | Low-pass, high-pass, band-pass filtering |
| `DelayNode` | Delay effect |
| `ConvolverNode` | Convolution reverb |
| `AnalyserNode` | Spectrum/waveform analysis (for visualization) |
| `MediaStreamSource` | Microphone input |
| `MediaRecorder` | Record audio to file |

## Notes

- **User gesture restriction**: AudioContext is suspended by default in newer browsers; call `ctx.resume()` after user interaction
- **Nodes can be connected multiple times**: A single `AudioBufferSourceNode` can connect to multiple destination nodes
- **Audio files need decoding first**: Use `ctx.decodeAudioData(arrayBuffer)` to convert MP3/WAV to AudioBuffer before playback
- **Nodes cannot be reused**: Each node cannot have its parameters reset after creation; need to create new nodes
