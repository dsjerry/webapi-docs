# WebAPI Docs

**Skip the fluff, get to the point.**

A concise Web API learning site. Deconstruct modern browser Web APIs with straightforward language. No more endless MDN articles — straight to the core usage of every API.

## Getting Started

```bash
# Install dependencies
npm install

# Dev server preview
npm run docs:dev

# Build static site
npm run docs:build

# Preview built output
npm run docs:preview
```

Visit <http://localhost:5173> to view the site.

## Current Modules

### WebRTC

Browser peer-to-peer communication. Video/audio calls, P2P data channels — no server relay required.

### WebSocket

Full-duplex communication between browser and server. Real-time push, chat, game servers — no polling needed.

### Web Worker

Offload heavy computation from the main thread. Keep the UI responsive while running complex logic in the background.

## Adding New Modules

Create a corresponding directory under `docs/` (e.g., `docs/websocket/`), then register the route in `.vitepress/config.js`'s `sidebar` configuration.

## Content Standards

All pages follow this structure:

1. **Overview** — One-sentence definition, within 1 paragraph
2. **Quick Start** — Minimal runnable example, < 20 lines
3. **Core Concepts** — API breakdown, explained one by one
4. **API Reference** — Parameter tables, event tables, option descriptions
5. **Practical Example** — End-to-end real-world example
6. **Notes** — Gotchas, browser differences, common pitfalls

See rule files in `.cursor/rules/` for details.
