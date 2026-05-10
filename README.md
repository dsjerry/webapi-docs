# WebAPI Docs

**拒绝冗余，只讲本质。**

用简洁的语言，拆解现代浏览器 Web API。告别 MDN 的冗长文案，直击每个 API 的核心用法。

## 开始使用

```bash
# 安装依赖
npm install

# 本地开发预览
npm run docs:dev

# 构建静态站点
npm run docs:build

# 预览构建产物
npm run docs:preview
```

访问 <http://localhost:5173> 查看站点。

## 当前模块

### WebRTC

浏览器端到端通信。音视频通话、P2P 数据通道，无需服务器中转数据。

### WebSocket

浏览器与服务端全双工通信。实时推送、聊天、游戏服务器，无需轮询。

### Web Worker

把耗时计算从主线程剥离。保持 UI 流畅，后台跑复杂逻辑。

### IndexedDB

浏览器内置的 NoSQL 数据库。存大量结构化数据，支持索引和事务，离线可用。

### Web Audio API

浏览器音频处理引擎。合成、滤波、混音、可视化，搭一条节点图就能跑。

### Web Crypto API

浏览器原生加密。哈希、AES、RSA、签名验签，性能超过任何 JS 加密库。

### Server-Sent Events

服务端单向推送的 HTTP 长连接。简单、自动重连，AI 流式回复的标配。

### WebAuthn / Passkeys

浏览器原生无密码登录。公私钥 + 生物识别，彻底替代密码。

### File System Access API

让浏览器直接读写本地文件。VS Code Web、Photopea 都靠它。

## 实用指南

- **DevTools 调试技巧** — 各 API 在 Chrome / Firefox 中的高效调试方法
- **性能基准** — 各方案的真实 ms 数据，选型时用得上的硬指标
- **TypeScript 类型最佳实践** — 直接复制就能用的最小封装

## 添加新模块

在 `docs/` 下创建对应目录（如 `docs/websocket/`），在 `.vitepress/config.js` 的 `sidebar` 中注册路由即可。

## 内容规范

所有页面遵循以下规范：

1. **概述** — 一句话定义，1 段以内
2. **快速上手** — 可运行的最小示例，< 20 行
3. **核心概念** — API 分解，逐个讲解
4. **API 详解** — 参数表、事件表、选项说明
5. **实战案例** — 端到端真实示例
6. **注意事项** — gotchas、浏览器差异、常见坑

详见 `.cursor/rules/` 中的规则文件。
