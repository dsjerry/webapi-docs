import { defineConfig } from "vitepress";

export default defineConfig({
  title: "WebAPI Docs",
  description: "拒绝冗余，只讲本质 — 简洁的 Web API 学习网站",

  lang: "zh-CN",

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#646cff" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "WebAPI Docs" }],
    [
      "meta",
      {
        name: "og:description",
        content: "拒绝冗余，只讲本质 — 简洁的 Web API 学习网站",
      },
    ],
  ],

  themeConfig: {
    siteTitle: "WebAPI Docs",

    nav: [
      { text: "首页", link: "/" },
      {
        text: "通信",
        items: [
          { text: "WebRTC — 点对点音视频", link: "/webrtc/" },
          { text: "WebSocket — 全双工通信", link: "/websocket/" },
          { text: "SSE — 服务端推送", link: "/sse/" },
        ],
      },
      {
        text: "存储与文件",
        items: [
          { text: "IndexedDB — 本地数据库", link: "/indexeddb/" },
          { text: "File System Access — 读写本地文件", link: "/file-system/" },
        ],
      },
      {
        text: "后台与多媒体",
        items: [
          { text: "Web Worker — 多线程", link: "/webworker/" },
          { text: "Web Audio API — 音频处理", link: "/webaudio/" },
        ],
      },
      {
        text: "安全与身份",
        items: [
          { text: "Web Crypto — 加密签名", link: "/webcrypto/" },
          { text: "WebAuthn — 无密码登录", link: "/webauthn/" },
        ],
      },
      {
        text: "指南",
        items: [
          { text: "DevTools 调试", link: "/guides/debugging" },
          { text: "性能基准", link: "/guides/performance" },
          { text: "TypeScript 类型", link: "/guides/typescript" },
        ],
      },
    ],

    sidebar: {
      "/webrtc/": [
        {
          text: "WebRTC",
          items: [
            { text: "概述", link: "/webrtc/" },
            { text: "核心概念", link: "/webrtc/overview" },
            { text: "RTCPeerConnection", link: "/webrtc/peer-connection" },
            { text: "信令机制", link: "/webrtc/signaling" },
            { text: "RTCDataChannel", link: "/webrtc/data-channel" },
            { text: "媒体流处理", link: "/webrtc/media" },
            { text: "实战案例", link: "/webrtc/practical" },
          ],
        },
      ],
      "/webworker/": [
        {
          text: "Web Worker",
          items: [
            { text: "概述", link: "/webworker/" },
            { text: "核心概念", link: "/webworker/overview" },
            { text: "基础用法", link: "/webworker/basic" },
            { text: "专用 vs 共享", link: "/webworker/dedicated-vs-shared" },
            { text: "MessageChannel", link: "/webworker/message-channel" },
            { text: "Service Worker", link: "/webworker/service-worker" },
            { text: "实战案例", link: "/webworker/practical" },
          ],
        },
      ],
      "/websocket/": [
        {
          text: "WebSocket",
          items: [
            { text: "概述", link: "/websocket/" },
            { text: "核心概念", link: "/websocket/overview" },
            { text: "基础用法", link: "/websocket/basic" },
            { text: "进阶用法", link: "/websocket/advanced" },
            { text: "实战案例", link: "/websocket/practical" },
          ],
        },
      ],
      "/indexeddb/": [
        {
          text: "IndexedDB",
          items: [
            { text: "概述", link: "/indexeddb/" },
            { text: "核心概念", link: "/indexeddb/overview" },
            { text: "基础用法", link: "/indexeddb/basic" },
            { text: "进阶用法", link: "/indexeddb/advanced" },
            { text: "实战案例", link: "/indexeddb/practical" },
          ],
        },
      ],
      "/webaudio/": [
        {
          text: "Web Audio API",
          items: [
            { text: "概述", link: "/webaudio/" },
            { text: "核心概念", link: "/webaudio/overview" },
            { text: "基础用法", link: "/webaudio/basic" },
            { text: "进阶用法", link: "/webaudio/advanced" },
            { text: "实战案例", link: "/webaudio/practical" },
          ],
        },
      ],
      "/webcrypto/": [
        {
          text: "Web Crypto API",
          items: [
            { text: "概述", link: "/webcrypto/" },
            { text: "核心概念", link: "/webcrypto/overview" },
            { text: "基础用法", link: "/webcrypto/basic" },
            { text: "进阶用法", link: "/webcrypto/advanced" },
            { text: "实战案例", link: "/webcrypto/practical" },
          ],
        },
      ],
      "/sse/": [
        {
          text: "Server-Sent Events",
          items: [
            { text: "概述", link: "/sse/" },
            { text: "核心概念", link: "/sse/overview" },
            { text: "基础用法", link: "/sse/basic" },
            { text: "进阶用法", link: "/sse/advanced" },
            { text: "实战：AI 流式对话", link: "/sse/practical" },
          ],
        },
      ],
      "/webauthn/": [
        {
          text: "WebAuthn / Passkeys",
          items: [
            { text: "概述", link: "/webauthn/" },
            { text: "核心概念", link: "/webauthn/overview" },
            { text: "基础用法", link: "/webauthn/basic" },
            { text: "进阶用法", link: "/webauthn/advanced" },
            { text: "实战：完整登录流程", link: "/webauthn/practical" },
          ],
        },
      ],
      "/file-system/": [
        {
          text: "File System Access",
          items: [
            { text: "概述", link: "/file-system/" },
            { text: "核心概念", link: "/file-system/overview" },
            { text: "基础用法", link: "/file-system/basic" },
            { text: "进阶用法", link: "/file-system/advanced" },
            { text: "实战：本地编辑器", link: "/file-system/practical" },
          ],
        },
      ],
      "/guides/": [
        {
          text: "实用指南",
          items: [
            { text: "DevTools 调试技巧", link: "/guides/debugging" },
            { text: "性能基准", link: "/guides/performance" },
            { text: "TypeScript 类型最佳实践", link: "/guides/typescript" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/dsjerry/webapi-docs.git" },
    ],

    footer: {
      message: "基于 VitePress 构建",
      copyright: "Copyright © 2026 WebAPI Docs",
    },

    editLink: {
      pattern: "https://github.com/dsjerry/webapi-docs/edit/main/docs/:path",
      text: "在 GitHub 上编辑此页",
    },

    lastUpdated: {
      text: "最后更新",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "short",
      },
    },

    outline: {
      level: [2, 3],
      label: "目录",
    },

    search: {
      provider: "local",
      options: {
        detailedView: true,
      },
    },

    docFooter: {
      prev: "上一篇",
      next: "下一篇",
    },

    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchTitle: "切换深色模式",
    lightModeSwitchTitle: "切换浅色模式",
  },
});
