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
