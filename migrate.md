# BertUI v2 — Monorepo Migration

> **This is a major breaking release.** v2 restructures BertUI from a single package into a fully modular TypeScript monorepo. Migration is required. It's worth it.

---

## What's New

### Single Compiler Pipeline
v1 had two separate compilers — `compiler.js` for dev and `file-transpiler.js` for build. They drifted. Bugs fixed in one wouldn't appear in the other. v2 has one: `compileProject` in `@bertui/compiler` handles both dev and production with an `env` flag. No more drift.

### TypeScript Everywhere
v1 was JavaScript with JSDoc comments pretending to be types. v2 has hand-written interfaces in `@bertui/core/types`. Every package is fully typed. No auto-generated `.d.ts` nonsense.

### Elysia Singleton
v1 recreated `DevHandler` on every single request. v2 keeps one instance alive for the lifetime of the server. The `@bertui/elysia` plugin manages this automatically.

### React 19
Import maps updated. Peer deps updated. `esm.sh/react@19.0.0` across the board.

### TypeScript 6
`tsconfig.base.json` is ready for the native Go compiler shipping mid-2026. `composite: true`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes` — all enabled.

### Optional Features System
Features like `elysia`, `forms`, `animations` are off by default. Enable them in config, and if the package isn't installed, BertUI throws a clear error telling you exactly what to run. No silent failures.

---

## Package Map

| Package | What it does |
|---|---|
| `@bertui/core` | Types, config, utils, cache — the foundation everything else imports |
| `@bertui/compiler` | Unified JSX/TSX pipeline, same code path for dev and build |
| `@bertui/router` | SSR-safe file-based React router |
| `@bertui/ssg` | Server islands, static HTML extraction, SSR renderer |
| `@bertui/dev` | HMR, file watcher, import map builder |
| `@bertui/css` | LightningCSS processor, CSS modules, SCSS |
| `@bertui/images` | Image copy + WASM optimization |
| `@bertui/elysia` | Elysia plugin with singleton lifecycle |
| `@bertui/cli` | The `bertui` binary |
| `bertui` | The single package users install — re-exports everything |
| `create-bertui` | `bunx create-bertui my-app` scaffolder |

---

## Migration Guide

This is the hard part. Here's everything you need to change, in order.

### 1. Update your dependency

```bash
# Remove v1
bun remove bertui

# Install v2
bun add bertui@^2.0.0
```

If you were using `bertui` as a bun link during development, re-run `bun link` from `packages/bertui` after building.

---

### 2. Router imports are unchanged

Good news — `bertui/router` imports work exactly the same.

```ts
// v1 ✓
import { Router, Link, useRouter } from 'bertui/router'

// v2 ✓ — same, no change needed
import { Router, Link, useRouter } from 'bertui/router'
```

---

### 3. Config imports changed

```ts
// v1
import { loadConfig, defaultConfig } from 'bertui/config'

// v2 — same path, same exports, nothing to change
import { loadConfig, defaultConfig } from 'bertui/config'
```

Still fine. The re-export structure is identical.

---

### 4. Direct package imports (advanced usage only)

If you were importing from internal paths like `bertui/src/compiler.js` or `bertui/src/build.js` — those are gone. Use the public packages instead.

```ts
// v1 — internal path, breaks in v2
import { compileProject } from 'bertui/src/client/compiler.js'

// v2 — use the public package
import { compileProject } from '@bertui/compiler'
```

```ts
// v1 — internal path, breaks in v2
import { buildProduction } from 'bertui/src/build.js'

// v2 — use the CLI package
import { buildProduction } from '@bertui/cli'
```

```ts
// v1 — internal path
import { minifyCSS } from 'bertui/src/css/processor.js'

// v2 — use the CSS package
import { minifyCSS } from '@bertui/css'
```

---

### 5. Elysia plugin usage changed

The plugin signature is the same but the import path changed, and `bertui` now requires `await`.

```ts
// v1
import { bertui } from 'bertui-elysia'

const app = new Elysia()
  .use(bertui({ root: './my-app' }))

// v2
import { bertui } from '@bertui/elysia'

const app = new Elysia()
  .use(await bertui({ root: './my-app' }))
```

The `await` is required because v2 initializes the dev handler singleton during setup instead of lazily on first request.

---

### 6. `bertui.config.js` — add optional feature flags

Your existing config still works. But if you want fullstack with Elysia you now need to opt in explicitly.

```js
// bertui.config.js
export default {
  siteName: 'My App',
  baseUrl: 'https://example.com',

  // v2: explicit opt-in for optional features
  elysia: true,       // requires: bun add @bertui/elysia
  // forms: true,     // requires: bun add @bertui/forms (coming soon)
  // animations: true // requires: bun add @bertui/animations (coming soon)

  importhow: {
    ui: '../components/ui',
  },

  meta: {
    title: 'My App',
    description: 'Built with BertUI',
  },
}
```

If you set `elysia: true` but don't have `@bertui/elysia` installed, you'll get:

```
╔══════════════════════════════════════════════════╗
║  [@bertui] Missing optional packages            ║
╚══════════════════════════════════════════════════╝

  • Elysia Fullstack (config.elysia = true)
    → bun add @bertui/elysia

  Install them all at once:

      bun add @bertui/elysia
```

---

### 7. `importhow` alias resolution — behavior change in build mode

In v1, build mode aliases resolved to the source directory. In v2, they resolve to the compiled output directory. This is automatic and you don't need to change anything in your config — but if you had workarounds for this, remove them.

```js
// bertui.config.js — this works the same in v2
export default {
  importhow: {
    ui: '../components/ui',
  }
}
```

```ts
// your page — no change needed
import Button from 'ui/Button'
```

The difference is internal: in dev, `ui` resolves to `.bertui/compiled/ui`. In build, it resolves to `.bertuibuild/ui`. The rewrite happens after `Bun.Transpiler.transform()` in both cases.

---

### 8. React version


v2 uses React 19. If your project is on React 18, update:

```bash
bun add react@^19.0.0 react-dom@^19.0.0
bun add -d @types/react@^19.0.0 @types/react-dom@^19.0.0
```

Check your components for React 19 breaking changes — mainly around `ref` as a prop (no more `forwardRef` needed), and `use()` hook support.

---

### 9. TypeScript — update your tsconfig

v2 ships with a strict `tsconfig.base.json`. Update your project config to extend it or match the key settings:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

`exactOptionalPropertyTypes` will surface new errors in v1 code. Most are legitimate bugs. Fix them.

---

## What Was Removed

These v1 internals are gone. If you used them, here's what replaced them.

| v1 | v2 replacement |
|---|---|
| `bertui/src/client/compiler.js` | `@bertui/compiler` |
| `bertui/src/build/compiler/index.js` | `@bertui/compiler` (same `compileProject`, `env: 'production'`) |
| `bertui/src/server/dev-server.js` | `@bertui/dev` + `@bertui/cli` |
| `bertui/src/css/processor.js` | `@bertui/css` |
| `bertui/src/images/index.js` | `@bertui/images` |
| `bertui/src/logger/logger.js` | Internal to `@bertui/cli`, not public API |
| `bertui/src/utils/cache.js` | `@bertui/core` (`BertuiCache`, `globalCache`) |
| `bertui/src/utils/importhow.js` | `@bertui/core` (`buildAliasMap`, `rewriteAliasImports`) |
| `bertui/src/utils/env.js` | `@bertui/core` (`loadEnvVariables`, `replaceEnvInCode`) |
| `bertui/src/hydration/index.js` | Rolled into `@bertui/ssg` analysis |
| `bertui/src/layouts/index.js` | Rolled into `@bertui/compiler` pipeline |
| `bertui/src/loading/index.js` | Rolled into `@bertui/compiler` pipeline |
| `bertui/src/middleware/index.js` | Public types moved to `@bertui/core` (`MiddlewareContext`) |
| `bertui/src/scaffolder/index.js` | `@bertui/cli` (`bertui create` command) |
| `bertui/src/analyzer/index.js` | `@bertui/cli` (`bertui analyze` command) |

---

## What Stayed the Same

- File-based routing conventions (`src/pages/`, `[slug].tsx`, `index.tsx`)
- Server Islands (`export const render = "static"` / `"server"`)
- `importhow` alias syntax in `bertui.config.js`
- All `bertui` CLI commands (`dev`, `build`, `serve`, `analyze`, `create`)
- The `bertui/router` import path
- CSS in `src/styles/`, compiled to `bertui.min.css`
- `public/` static assets
- HMR behavior

---

## Quick Upgrade Checklist

```
[ ] bun remove bertui && bun add bertui@^2.0.0
[ ] If using @bertui/elysia: bun add @bertui/elysia, add elysia: true to config
[ ] Update any direct imports from bertui/src/* to the public packages
[ ] Add await to .use(await bertui(...)) in Elysia setup
[ ] bun add react@^19.0.0 react-dom@^19.0.0 if on React 18
[ ] Run bun run typecheck and fix exactOptionalPropertyTypes errors
[ ] Delete .bertui/ and .bertuibuild/ cache dirs and do a fresh build
```

---

## New in v2 That Wasn't in v1

### `create-bertui` scaffolder

```bash
bunx create-bertui my-app
cd my-app
bun install
bun run dev
```

### Proper `bertui create` types

```bash
bertui create component Button
bertui create page blog/[slug]
bertui create layout default
bertui create loading blog
bertui create middleware
```

### Bundle analyzer

```bash
bertui analyze
bertui analyze --open   # opens in browser
```

### `bertui.config.js` — optional feature flags

```js
export default {
  elysia: true,       // enable fullstack
  forms: true,        // coming soon
  animations: true,   // coming soon
  icons: true,        // coming soon
}
```

---

## Why This Migration Is Hard

The v1 codebase had grown organically. The compiler had two diverging code paths. Utils were duplicated across files. Types were in comments. The `@bertui/elysia` plugin created a new `DevHandler` on every single HTTP request — in production.

v2 fixes all of that at the cost of being a structural rewrite. The public API for users (`bertui/router`, `bertui.config.js`, CLI commands, file conventions) is almost entirely unchanged. The internals are completely new.

If you only use BertUI as a user (pages, config, CLI), your migration is steps 1, 8, and the checklist. Fifteen minutes.

If you imported from internal paths, that's on you and the table above has everything you need.

---

## Getting Help

- GitHub: [BunElysiaReact/BERTUI](https://github.com/BunElysiaReact/BERTUI)
- Open an issue with the `v2-migration` label

---

*Made by Pease Ernest*