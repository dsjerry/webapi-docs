---
title: Signaling
description: How WebRTC finds the other peer without knowing their address
outline: [2, 3]
---

:::tip Browser Support
Chrome 56+ · Firefox 44+ · Safari 11+ · Edge 79+
:::

## Overview

WebRTC only handles transport — it doesn't decide "who speaks first." Before two endpoints can exchange media data, they must agree on media capabilities (SDP offer/answer) and network paths (ICE candidates). This negotiation is called **Signaling** — WebRTC's standard doesn't specify how to implement it because it can be anything you want.

## Quick Start

Simplest approach: simulate two endpoints on the same page (for understanding only; use WebSocket in production):

```js
// Simulate offer/answer exchange on same page
const pc1 = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
const pc2 = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

pc2.ontrack = (e) => { /* remote stream */ };

// pc1 creates offer
const offer = await pc1.createOffer();
await pc1.setLocalDescription(offer);

// pc2 receives offer, sets remote description
await pc2.setRemoteDescription(offer);

// pc2 creates answer
const answer = await pc2.createAnswer();
await pc2.setLocalDescription(answer);

// pc1 receives answer
await pc1.setRemoteDescription(answer);
```

After `setRemoteDescription`, ICE candidates start generating and `onicecandidate` fires.

## Core Concepts

### Why Is Signaling Needed?

Browser A doesn't know Browser B's IP; Browser B doesn't know Browser A's IP. These two blind people need a "middleman" — the signaling server. The signaling server is essentially a message courier, forwarding two types of messages:

1. **SDP (Session Description Protocol)**: What are my media capabilities (codecs, resolution, audio or not...)
2. **ICE Candidate**: Which network paths I've found (IP + port + protocol combinations)

### SDP Offer / Answer

Standard flow for negotiating media parameters:

```
A (offerer)                           B (answerer)
   |--- createOffer() --->
   |--- setLocalDescription(offer)
   |--- send offer SDP --------->   | received SDP
                                      |--- setRemoteDescription(offer)
                                      |--- createAnswer()
                                      |--- setLocalDescription(answer)
   |<---- send answer SDP --------|  received answer
   |--- setRemoteDescription(answer)|
```

### ICE Candidate Gathering

Once `setRemoteDescription` completes, both endpoints start gathering ICE candidates in parallel. Each candidate represents a "possible path":

```js
// ICE candidate example
{
  candidate: "candidate:1 1 UDP 2122252543 192.168.1.5 54321 typ host"
  //        ↑ type: host (LAN direct)
  //                    typ srflx (public reflected)
  //                    typ relay (TURN relay)
  sdpMid: "0",
  sdpMLineIndex: 0
}
```

The ICE agent runs connectivity tests (STUN binding request) on these candidates until it finds the best path.

### STUN / TURN Role

| Technology | Role | When Used |
|------------|------|-----------|
| STUN | Get public mapped IP | Most NAT scenarios, P2P direct |
| TURN | Data relay forwarding | Symmetric NAT, strict firewalls |

### Real Signaling Solutions

| Solution | Best For |
|----------|----------|
| WebSocket | Most common, bidirectional real-time push |
| Server-Sent Events | Server-to-client push only |
| HTTP Polling | Simplest, good for debugging |
| WebSocket + TURN service | Production standard |

## API Reference

### ICE Candidate Exchange

```js
// Send candidate to peer
pc.onicecandidate = ({ candidate }) => {
  if (candidate) {
    ws.send(JSON.stringify(candidate));
  }
};

// Receive peer's candidate and add it
ws.onmessage = ({ data }) => {
  const candidate = JSON.parse(data);
  pc.addIceCandidate(candidate);
};
```

### ICE Transport Policy

```js
const pc = new RTCPeerConnection({
  iceTransportPolicy: 'relay', // force TURN (for debugging)
  // 'all' = prefer host → srflx → relay
});
```

### ICE Connection State

```js
pc.oniceconnectionstatechange = () => {
  switch (pc.iceConnectionState) {
    case 'checking':    console.log('Checking paths');    break;
    case 'connected':   console.log('Path found');        break;
    case 'completed':   console.log('Connection complete'); break;
    case 'failed':      console.log('All paths failed');  break;
    case 'disconnected': console.log('Temporarily disconnected'); break;
    case 'closed':      console.log('Closed');            break;
  }
};
```

## Practical Example

A minimal signaling client using WebSocket:

```js
class Signaling {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.onOffer = null;
    this.onAnswer = null;
    this.onCandidate = null;

    this.ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.type === 'offer')    this.onOffer?.(msg);
      if (msg.type === 'answer')   this.onAnswer?.(msg);
      if (msg.candidate)           this.onCandidate?.(msg.candidate);
    };
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  sendOffer(offer)   { this.send({ type: 'offer',   sdp: offer.sdp }); }
  sendAnswer(answer) { this.send({ type: 'answer',  sdp: answer.sdp }); }
  sendCandidate(c)   { this.send({ candidate: c }); }
}
```

## Notes

- **Signaling server is not part of WebRTC**: Use any protocol, any backend — even copy-pasting SDP manually (for debugging)
- **Offer/answer must be paired**: Once you send an offer, you must wait for the answer; don't send two offers in a row
- **ICE candidate gathering has latency**: After `setRemoteDescription`, wait a few seconds for enough candidates — be patient
- **HTTPS required in production**: STUN/TURN servers also require TLS
