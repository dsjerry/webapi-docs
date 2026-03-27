---
title: RTCPeerConnection
description: The heart of WebRTC — creating, managing, and closing point-to-point connections
outline: [2, 3]
---

:::tip Browser Support
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## Overview

`RTCPeerConnection` is the heart of WebRTC. It represents a logical connection between two endpoints, managing media negotiation, candidate gathering, and encrypted transport. We add local media tracks to it, listen for remote tracks, and track connection state.

## Quick Start

```js
// Basic: create a connection
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
});

// Listen for connection state changes
pc.onconnectionstatechange = () => {
  console.log('Connection state:', pc.connectionState);
  // => connecting | connected | disconnected | failed | closed
};

// Listen for ICE candidates
pc.onicecandidate = (event) => {
  if (event.candidate) {
    // Send candidate to peer (via signaling server)
    sendToPeer(event.candidate);
  }
};

// Listen for remote tracks arriving
pc.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};
```

## Core Concepts

### Creating a Connection

`RTCPeerConnection` takes a config object; the key part is `iceServers` — defining the STUN/TURN servers for candidate gathering.

```js
const pc = new RTCPeerConnection({
  iceServers: [
    // STUN — get public IP
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN — relay when P2P fails
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass',
    },
  ],
  iceTransportPolicy: 'all', // or 'relay' (force TURN)
});
```

### Adding Local Tracks

Once you have a `MediaStream` from `getUserMedia`, add its video tracks to the connection:

```js
const localStream = await navigator.mediaDevices.getUserMedia({ video: true });

localStream.getTracks().forEach((track) => {
  pc.addTrack(track, localStream);
});
```

### Media Negotiation

Both endpoints need to exchange SDP (Session Description Protocol) to negotiate media capabilities. This exchange must be initiated by one side:

```js
// === Offer side ===
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
sendToPeer({ type: 'offer', sdp: offer.sdp });

// === Answer side ===
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
sendToPeer({ type: 'answer', sdp: answer.sdp });

// === Offer side receives answer ===
await pc.setRemoteDescription(answer);
```

After this offer/answer exchange completes, both sides will receive the `ontrack` event.

## API Reference

### Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `connectionState` | string | Overall connection state |
| `iceConnectionState` | string | ICE connection layer state |
| `localDescription` | RTCSessionDescription | Local SDP |
| `remoteDescription` | RTCSessionDescription | Remote SDP |
| `getSenders()` | RTCRtpSender[] | Added send tracks |
| `getReceivers()` | RTCRtpReceiver[] | Received remote tracks |

### Key Events

| Event | When Fired |
|-------|-----------|
| `ontrack` | Remote media track received |
| `onicecandidate` | ICE candidate generated, ready to send |
| `onconnectionstatechange` | Connection state changed |
| `oniceconnectionstatechange` | ICE connection state changed |
| `ondatachannel` | Received a DataChannel opened by the peer |

### Closing a Connection

```js
// Close all transports and release resources
pc.close();

// For reconnect, create a new instance
// pc = new RTCPeerConnection(config);
```

:::danger Cannot reuse after close
After `close()` the instance is dead. To reconnect, create a new `RTCPeerConnection`.
:::

## Notes

- **`iceServers` is required**: Without it, ICE candidates will always be empty and the connection cannot be established
- **Offer/answer is serial**: One side's `setLocalDescription` must complete before sending; the peer can only `setRemoteDescription` after receiving
- **The same track can be reused across multiple `addTrack` calls**: `RTCRtpSender` can reuse the same track across multiple connections
