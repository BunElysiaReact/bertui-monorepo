# bertui

Zero-config React framework powered by Bun. Minimal core, optional everything else.

## Install

```bash
bun add bertui
```

That's it. React + file-based routing + SSG + HMR + LightningCSS. No forms, no animations, no icons pulled in unless you ask for them.

## Optional packages

Install only what you need:

```bash
bun add @bertui/elysia     # fullstack — Elysia server plugin
bun add @bertui/forms      # forms (coming soon)
bun add @bertui/animations # animations (coming soon)
bun add @bertui/icons      # icons (coming soon)
```

Then enable in `bertui.config.js`:

```js
export default {
  siteName: 'My App',
  elysia: true,      // requires bun add @bertui/elysia
  forms: true,       // requires bun add @bertui/forms
}
```

If you enable a feature without installing its package, BertUI throws a clear error telling you exactly what to run.

## Quick start

```bash
bunx create-bertui my-app
cd my-app
bun install
bun run dev
```

## What's in the core

| Package | What it does |
|---|---|
| `@bertui/core` | Types, config, utils, cache |
| `@bertui/compiler` | JSX/TSX pipeline — dev + build unified |
| `@bertui/router` | File-based React router, SSR-safe |
| `@bertui/ssg` | Static/server islands, SSR renderer |
| `@bertui/css` | LightningCSS — modules, SCSS, minify |
| `@bertui/images` | Image copy + WASM optimization |
| `@bertui/dev` | HMR, file watcher, import map |
| `@bertui/cli` | The `bertui` binary |

## Imports

```ts
// Core
import { loadConfig, formatBytes } from 'bertui'

// Router (client-side)
import { Router, Link, useRouter } from 'bertui/router'

// Config types
import type { BertuiConfig } from 'bertui/config'
```

Made by Pease Ernest
