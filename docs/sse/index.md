---
title: Server-Sent Events
description: 服务端单向推送模块
---

# Server-Sent Events (SSE)

服务端单向推送的 HTTP 长连接。比 WebSocket 简单，自带断线重连，浏览器原生支持，特别适合通知、流式回复、实时仪表盘。

## 模块内容

- [概述](./overview) — SSE 是什么，和 WebSocket 有什么区别
- [核心概念](./overview#核心概念) — `text/event-stream` 协议、`EventSource`、字段格式
- [基础用法](./basic) — 监听消息、命名事件、断线重连
- [进阶用法](./advanced) — 自定义重连、携带 token、Last-Event-ID 续传
- [实战：AI 流式对话](./practical) — 仿 ChatGPT 的流式回复界面
