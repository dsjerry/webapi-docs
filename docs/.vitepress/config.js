import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WebAPI Docs',
  description: '拒绝冗余，只讲本质 — 简洁的 Web API 学习网站',

  lang: 'zh-CN',

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'WebAPI Docs' }],
    ['meta', { name: 'og:description', content: '拒绝冗余，只讲本质 — 简洁的 Web API 学习网站' }],
  ],

  themeConfig: {
    siteTitle: 'WebAPI Docs',

    nav: [
      { text: '首页', link: '/' },
      {
        text: 'WebRTC',
        link: '/webrtc/',
      },
      {
        text: 'Web Worker',
        link: '/webworker/',
      },
      {
        text: 'WebSocket',
        link: '/websocket/',
      },
      {
        text: 'IndexedDB',
        link: '/indexeddb/',
      },
      {
        text: 'Web Audio API',
        link: '/webaudio/',
      },
    ],

    sidebar: {
      '/webrtc/': [
        {
          text: 'WebRTC',
          items: [
            { text: '概述', link: '/webrtc/' },
            { text: '核心概念', link: '/webrtc/overview' },
            { text: 'RTCPeerConnection', link: '/webrtc/peer-connection' },
            { text: '信令机制', link: '/webrtc/signaling' },
            { text: 'RTCDataChannel', link: '/webrtc/data-channel' },
            { text: '媒体流处理', link: '/webrtc/media' },
            { text: '实战案例', link: '/webrtc/practical' },
          ],
        },
      ],
      '/webworker/': [
        {
          text: 'Web Worker',
          items: [
            { text: '概述', link: '/webworker/' },
            { text: '核心概念', link: '/webworker/overview' },
            { text: '基础用法', link: '/webworker/basic' },
            { text: '专用 vs 共享', link: '/webworker/dedicated-vs-shared' },
            { text: 'MessageChannel', link: '/webworker/message-channel' },
            { text: 'Service Worker', link: '/webworker/service-worker' },
            { text: '实战案例', link: '/webworker/practical' },
          ],
        },
      ],
      '/websocket/': [
        {
          text: 'WebSocket',
          items: [
            { text: '概述', link: '/websocket/' },
            { text: '核心概念', link: '/websocket/overview' },
            { text: '基础用法', link: '/websocket/basic' },
            { text: '进阶用法', link: '/websocket/advanced' },
            { text: '实战案例', link: '/websocket/practical' },
          ],
        },
      ],
      '/indexeddb/': [
        {
          text: 'IndexedDB',
          items: [
            { text: '概述', link: '/indexeddb/' },
            { text: '核心概念', link: '/indexeddb/overview' },
            { text: '基础用法', link: '/indexeddb/basic' },
            { text: '进阶用法', link: '/indexeddb/advanced' },
            { text: '实战案例', link: '/indexeddb/practical' },
          ],
        },
      ],
      '/webaudio/': [
        {
          text: 'Web Audio API',
          items: [
            { text: '概述', link: '/webaudio/' },
            { text: '核心概念', link: '/webaudio/overview' },
            { text: '基础用法', link: '/webaudio/basic' },
            { text: '进阶用法', link: '/webaudio/advanced' },
            { text: '实战案例', link: '/webaudio/practical' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/dsjerry/webapi-docs.git' },
    ],

    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2026 WebAPI Docs',
    },

    editLink: {
      pattern: 'https://github.com/dsjerry/webapi-docs/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short',
      },
    },

    outline: {
      level: [2, 3],
      label: '目录',
    },

    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchTitle: '切换深色模式',
    lightModeSwitchTitle: '切换浅色模式',
  },
})
