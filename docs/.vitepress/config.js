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
      { text: 'WebRTC', link: '/webrtc/' },
      { text: 'Web Worker', link: '/webworker/' },
      { text: 'WebSocket', link: '/websocket/' },
      { text: 'IndexedDB', link: '/indexeddb/' },
      { text: 'Web Audio API', link: '/webaudio/' },
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

    localeLinks: {
      text: 'English',
      link: '/en/',
    },
  },

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description: 'Skip the fluff, get to the point — a concise Web API learning site',
      head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
        ['meta', { name: 'theme-color', content: '#646cff' }],
        ['meta', { name: 'og:type', content: 'website' }],
        ['meta', { name: 'og:title', content: 'WebAPI Docs' }],
        ['meta', { name: 'og:description', content: 'Skip the fluff, get to the point — a concise Web API learning site' }],
      ],
      themeConfig: {
        siteTitle: 'WebAPI Docs',

        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'WebRTC', link: '/en/webrtc/' },
          { text: 'Web Worker', link: '/en/webworker/' },
          { text: 'WebSocket', link: '/en/websocket/' },
          { text: 'IndexedDB', link: '/en/indexeddb/' },
          { text: 'Web Audio API', link: '/en/webaudio/' },
        ],

        sidebar: {
          '/en/webrtc/': [
            {
              text: 'WebRTC',
              items: [
                { text: 'Overview', link: '/en/webrtc/' },
                { text: 'Core Concepts', link: '/en/webrtc/overview' },
                { text: 'RTCPeerConnection', link: '/en/webrtc/peer-connection' },
                { text: 'Signaling', link: '/en/webrtc/signaling' },
                { text: 'RTCDataChannel', link: '/en/webrtc/data-channel' },
                { text: 'Media Streams', link: '/en/webrtc/media' },
                { text: 'Practical Example', link: '/en/webrtc/practical' },
              ],
            },
          ],
          '/en/webworker/': [
            {
              text: 'Web Worker',
              items: [
                { text: 'Overview', link: '/en/webworker/' },
                { text: 'Core Concepts', link: '/en/webworker/overview' },
                { text: 'Basic Usage', link: '/en/webworker/basic' },
                { text: 'Dedicated vs Shared', link: '/en/webworker/dedicated-vs-shared' },
                { text: 'MessageChannel', link: '/en/webworker/message-channel' },
                { text: 'Service Worker', link: '/en/webworker/service-worker' },
                { text: 'Practical Example', link: '/en/webworker/practical' },
              ],
            },
          ],
          '/en/websocket/': [
            {
              text: 'WebSocket',
              items: [
                { text: 'Overview', link: '/en/websocket/' },
                { text: 'Core Concepts', link: '/en/websocket/overview' },
                { text: 'Basic Usage', link: '/en/websocket/basic' },
                { text: 'Advanced Usage', link: '/en/websocket/advanced' },
                { text: 'Practical Example', link: '/en/websocket/practical' },
              ],
            },
          ],
          '/en/indexeddb/': [
            {
              text: 'IndexedDB',
              items: [
                { text: 'Overview', link: '/en/indexeddb/' },
                { text: 'Core Concepts', link: '/en/indexeddb/overview' },
                { text: 'Basic Usage', link: '/en/indexeddb/basic' },
                { text: 'Advanced Usage', link: '/en/indexeddb/advanced' },
                { text: 'Practical Example', link: '/en/indexeddb/practical' },
              ],
            },
          ],
          '/en/webaudio/': [
            {
              text: 'Web Audio API',
              items: [
                { text: 'Overview', link: '/en/webaudio/' },
                { text: 'Core Concepts', link: '/en/webaudio/overview' },
                { text: 'Basic Usage', link: '/en/webaudio/basic' },
                { text: 'Advanced Usage', link: '/en/webaudio/advanced' },
                { text: 'Practical Example', link: '/en/webaudio/practical' },
              ],
            },
          ],
        },

        socialLinks: [
          { icon: 'github', link: 'https://github.com/dsjerry/webapi-docs.git' },
        ],

        footer: {
          message: 'Built with VitePress',
          copyright: 'Copyright © 2026 WebAPI Docs',
        },

        editLink: {
          pattern: 'https://github.com/dsjerry/webapi-docs/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },

        lastUpdated: {
          text: 'Last Updated',
          formatOptions: {
            dateStyle: 'short',
            timeStyle: 'short',
          },
        },

        outline: {
          level: [2, 3],
          label: 'On This Page',
        },

        search: {
          provider: 'local',
          options: {
            detailedView: true,
          },
        },

        docFooter: {
          prev: 'Previous',
          next: 'Next',
        },

        returnToTopLabel: 'Return to Top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchTitle: 'Toggle Dark Mode',
        lightModeSwitchTitle: 'Toggle Light Mode',

        localeLinks: {
          text: '简体中文',
          link: '/',
        },
      },
    },
  },
})
