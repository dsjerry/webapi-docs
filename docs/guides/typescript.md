---
title: TypeScript 类型最佳实践
description: 各 Web API 的 TS 类型定义和最小封装 — 直接复制就能用
outline: [2, 3]
---

所有原生 Web API 的类型 **TypeScript 内置**（`lib.dom.d.ts`），不用装 `@types/web`。但在工程里直接用原生类型常常很笨重，本篇给每个模块一份**实用最小封装**。

:::tip TS 配置
确保 `tsconfig.json` 的 `lib` 包含：

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

`WebWorker` 仅在 worker 文件用，主线程不需要。
:::

## WebSocket

原生 `WebSocket` 类型已经够用，但消息常常是 JSON——加一层泛型让收发都有类型：

```ts
type Schema<T extends Record<string, unknown>> = {
  [K in keyof T]: { type: K; payload: T[K] };
}[keyof T];

type ChatProtocol = Schema<{
  message: { user: string; text: string };
  typing: { user: string };
  leave: { user: string };
}>;

class TypedWebSocket<T extends { type: string }> {
  private ws: WebSocket;
  constructor(url: string) { this.ws = new WebSocket(url); }

  send(msg: T) {
    this.ws.send(JSON.stringify(msg));
  }

  onMessage<K extends T['type']>(
    type: K,
    handler: (payload: Extract<T, { type: K }>['payload']) => void
  ) {
    this.ws.addEventListener('message', (e) => {
      const data = JSON.parse(e.data) as T;
      if (data.type === type) handler((data as Extract<T, { type: K }>).payload);
    });
  }
}

// 用法（全程类型安全）
const ws = new TypedWebSocket<ChatProtocol>('wss://chat.example.com');
ws.send({ type: 'message', payload: { user: 'Alice', text: 'hi' } });
ws.onMessage('typing', (p) => console.log(p.user));
//                                       ^^ 自动推断为 string
```

## SSE

```ts
interface SSEMessage<T = unknown> {
  type: string;
  data: T;
  id?: string;
}

async function* sseStream<T>(
  url: string,
  init?: RequestInit
): AsyncGenerator<SSEMessage<T>> {
  const res = await fetch(url, init);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const raw of events) {
      const msg = parseEvent<T>(raw);
      if (msg) yield msg;
    }
  }
}

function parseEvent<T>(raw: string): SSEMessage<T> | null {
  let event = 'message';
  let id: string | undefined;
  let dataLines: string[] = [];

  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).trimStart();
    if (field === 'event') event = value;
    else if (field === 'id') id = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (!dataLines.length) return null;
  const text = dataLines.join('\n');
  return {
    type: event,
    data: JSON.parse(text) as T,
    id,
  };
}

// 用法
interface Tick { price: number; symbol: string }
for await (const msg of sseStream<Tick>('/api/ticks')) {
  console.log(msg.data.price);
}
```

## IndexedDB

原生 IndexedDB 没有泛型——强烈推荐用 `idb`，它带完整 TS：

```ts
import { openDB, type DBSchema } from 'idb';

interface MyDB extends DBSchema {
  users: {
    key: string;
    value: { id: string; name: string; age: number };
    indexes: { 'by-age': number };
  };
  notes: {
    key: number;
    value: { id?: number; title: string; content: string };
  };
}

const db = await openDB<MyDB>('myapp', 1, {
  upgrade(db) {
    const users = db.createObjectStore('users', { keyPath: 'id' });
    users.createIndex('by-age', 'age');
    db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
  },
});

// 全程类型安全
await db.add('users', { id: 'u1', name: 'Alice', age: 25 });
//                                                ^^^ 必填，少了 TS 报错

const adults = await db.getAllFromIndex('users', 'by-age',
  IDBKeyRange.lowerBound(18));
adults[0].name;  // ✓ string
```

## Web Worker

### 主线程

```ts
// === main.ts ===
type WorkerRequest =
  | { id: number; cmd: 'add'; args: [number, number] }
  | { id: number; cmd: 'sort'; args: [number[]] };

type WorkerResponse =
  | { id: number; result: number }
  | { id: number; result: number[] }
  | { id: number; error: string };

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const pending = new Map<number, (res: any) => void>();
let nextId = 0;

function call<R>(req: Omit<WorkerRequest, 'id'>): Promise<R> {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, (res) => 'error' in res ? reject(res.error) : resolve(res.result));
    worker.postMessage({ ...req, id });
  });
}

worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
  pending.get(e.data.id)?.(e.data);
  pending.delete(e.data.id);
};

// 用法
const sum = await call<number>({ cmd: 'add', args: [1, 2] });
const sorted = await call<number[]>({ cmd: 'sort', args: [[3, 1, 2]] });
```

### Worker 内部

```ts
// === worker.ts ===
// 顶部加一行才能拿到 Worker 全局类型
/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, cmd, args } = e.data;
  try {
    if (cmd === 'add') {
      self.postMessage({ id, result: args[0] + args[1] } satisfies WorkerResponse);
    } else if (cmd === 'sort') {
      self.postMessage({ id, result: [...args[0]].sort((a, b) => a - b) } satisfies WorkerResponse);
    }
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies WorkerResponse);
  }
};
```

或者更简单——直接用 [Comlink](https://github.com/GoogleChromeLabs/comlink)，它的 TS 类型完美：

```ts
// === worker.ts ===
import * as Comlink from 'comlink';

const api = {
  add: (a: number, b: number) => a + b,
  sort: (arr: number[]) => [...arr].sort((a, b) => a - b),
};
export type Api = typeof api;

Comlink.expose(api);

// === main.ts ===
import * as Comlink from 'comlink';
import type { Api } from './worker';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const api = Comlink.wrap<Api>(worker);

const sum = await api.add(1, 2);  // ✓ number
```

## Web Audio

```ts
class AudioPlayer {
  private ctx: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;

  constructor() {
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  async load(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    return this.ctx.decodeAudioData(buffer);
  }

  play(buffer: AudioBuffer, when = 0): void {
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.connect(this.gain);
    this.source.start(when);
  }

  stop(): void {
    this.source?.stop();
    this.source = null;
  }

  setVolume(value: number): void {
    this.gain.gain.setValueAtTime(value, this.ctx.currentTime);
  }
}
```

### AudioWorklet 类型

```ts
// === processor.ts ===
class MyProcessor extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    // ...
    return true;
  }
}

registerProcessor('my-processor', MyProcessor);
```

需要在 `tsconfig.json` 加：

```json
{ "compilerOptions": { "lib": ["ES2022", "DOM", "WebWorker"] } }
```

## Web Crypto

```ts
// 一个类型安全的加解密封装
class AesGcm {
  constructor(private key: CryptoKey) {}

  static async generate(): Promise<AesGcm> {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    return new AesGcm(key);
  }

  static async fromJwk(jwk: JsonWebKey): Promise<AesGcm> {
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'],
    );
    return new AesGcm(key);
  }

  async encrypt(plaintext: string): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, this.key, data,
    );
    const out = new Uint8Array(iv.length + ciphertext.byteLength);
    out.set(iv);
    out.set(new Uint8Array(ciphertext), iv.length);
    return out;
  }

  async decrypt(payload: Uint8Array): Promise<string> {
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, this.key, ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  }

  async export(): Promise<JsonWebKey> {
    return crypto.subtle.exportKey('jwk', this.key);
  }
}

// 用法
const aes = await AesGcm.generate();
const cipher = await aes.encrypt('hello');
const plain = await aes.decrypt(cipher);   // ✓ string
```

## WebRTC

```ts
type SignalMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

class P2PConnection {
  private pc: RTCPeerConnection;

  constructor(
    iceServers: RTCIceServer[],
    private send: (msg: SignalMessage) => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ type: 'candidate', candidate: e.candidate.toJSON() });
    };
  }

  async createOffer(stream: MediaStream): Promise<void> {
    stream.getTracks().forEach(t => this.pc.addTrack(t, stream));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.send({ type: 'offer', sdp: offer.sdp! });
  }

  async receive(msg: SignalMessage): Promise<void> {
    switch (msg.type) {
      case 'offer':
        await this.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.send({ type: 'answer', sdp: answer.sdp! });
        break;
      case 'answer':
        await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
        break;
      case 'candidate':
        await this.pc.addIceCandidate(msg.candidate);
        break;
    }
  }

  onTrack(cb: (stream: MediaStream) => void): void {
    this.pc.ontrack = (e) => cb(e.streams[0]);
  }

  close(): void {
    this.pc.close();
  }
}
```

## File System Access

需要在 `tsconfig.json` 加 `lib`：`"lib": ["DOM"]` 已经包含了类型，不用额外装包。

```ts
async function pickAndRead(): Promise<{ name: string; content: string; handle: FileSystemFileHandle }> {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'Text', accept: { 'text/plain': ['.txt', '.md'] } }],
  });
  const file = await handle.getFile();
  return { name: file.name, content: await file.text(), handle };
}

async function ensureWritePermission(handle: FileSystemHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}
```

## WebAuthn

`@simplewebauthn/browser` 和 `@simplewebauthn/server` 都自带 TS：

```ts
import {
  startRegistration,
  startAuthentication,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

interface RegisterOptions {
  // 服务端返回的 PublicKeyCredentialCreationOptionsJSON
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  // ...其余字段
}

async function register(opts: RegisterOptions): Promise<RegistrationResponseJSON> {
  return startRegistration(opts);
}
```

## 通用工具类型

经常用到的几个：

```ts
// 1. 强类型 EventTarget
type TypedEventTarget<EventMap extends Record<string, Event>> = {
  addEventListener<K extends keyof EventMap>(
    type: K,
    listener: (ev: EventMap[K]) => void,
  ): void;
  removeEventListener<K extends keyof EventMap>(
    type: K,
    listener: (ev: EventMap[K]) => void,
  ): void;
};

// 2. ArrayBuffer / Uint8Array 互转的类型守卫
function toUint8Array(input: BufferSource): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

// 3. Promise 超时包装
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)
    ),
  ]);
}
```

## 常见错误

| 报错 | 原因 |
|------|------|
| `Property 'showOpenFilePicker' does not exist on type 'Window'` | TS 版本太低，升到 5.0+ |
| `'AudioWorkletProcessor' is not defined` | `tsconfig` 缺 `"lib": ["WebWorker"]` |
| `'self' is of type 'never'` 在 worker 里 | 加 `/// <reference lib="webworker" />` |
| `Type '"public-key"' is not assignable to type 'PublicKeyCredentialType'` | 用 `as const`：`{ type: 'public-key' as const }` |
| Vite/Webpack import worker 报错 | 用 `new Worker(new URL('./w.ts', import.meta.url), { type: 'module' })` |
