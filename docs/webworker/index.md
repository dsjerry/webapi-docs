---
title: Web Worker
description: 浏览器后台线程模块
---

# Web Worker

把耗时计算从主线程剥离。保持 UI 流畅，后台跑复杂逻辑。

## 模块内容

- [概述](./overview) — Worker 是什么，为什么需要它
- [基础用法](./basic) — 创建、postMessage、terminate
- [专用 vs 共享](./dedicated-vs-shared) — Dedicated / Shared Worker 怎么选
- [MessageChannel](./message-channel) — 两个 Worker 直连通信
- [Service Worker](./service-worker) — 网络代理与离线缓存
- [实战：剥离重计算](./practical) — 斐波那契 + 大数组排序搬进 Worker
