# BertUI v2 — Monorepo

Zero-config React framework powered by Bun. Now a fully modular TypeScript monorepo.

---

## Packages

| Package | Description |
|---|---|
| `@bertui/core` | Types, config, utils, cache — the foundation |
| `@bertui/compiler` | Unified JSX/TSX pipeline (single path for dev + build) |
| `@bertui/router` | SSR-safe file-based React router |
| `@bertui/ssg` | Server islands, static HTML extraction, SSR renderer |
| `@bertui/dev` | HMR, file watcher, import map builder |
| `@bertui/css` | LightningCSS processor, CSS modules, SCSS |
| `@bertui/images` | Image copy + WASM optimization |
| `@bertui/elysia` | Elysia plugin — singleton lifecycle, no per-request recreation |
| `@bertui/cli` | The `bertui` CLI |
| `create-bertui` | `bunx create-bertui my-app` |

---

## Quick Start

```bash
# Install
bun install

# Dev
bun run dev

# Build all packages
bun run build

# Typecheck
bun run typecheck
```

---

## Using @bertui/elysia

```ts
import { Elysia } from 'elysia'
import { bertui } from '@bertui/elysia'

const app = new Elysia()
  .use(await bertui({ root: './my-app' }))
  .get('/api/health', () => ({ status: 'ok' }))
  .listen(3000)
```

---

## What changed from v1

- **Single compiler pipeline** — `compileProject` in `@bertui/compiler` handles both dev and build. No more drift between `compiler.js` and `file-transpiler.js`.
- **Typed everything** — hand-written interfaces in `@bertui/core/types`. No more auto-generated `.d.ts` files.
- **Elysia singleton** — `@bertui/elysia` keeps one `DevHandler` instance alive. v1 recreated it on every request.
- **React 19** — import maps updated, peer deps updated.
- **TS 6** — native Go compiler ready when it ships mid-2026.

---

Made by Pease Ernest
