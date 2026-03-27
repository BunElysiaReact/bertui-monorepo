Here's a clean README for contributors:

---

# Contributing to BertUI

Thank you for considering contributing! This guide will help you add new packages to the monorepo.

## 📦 Adding a New Package

### 1. Scaffold the package
```bash
bun new-package <name>
```
Replace `<name>` with your package name (e.g., `forms`, `animations`).

This creates:
```
packages/<name>/
├── src/index.ts      # Your code
├── package.json      # Package config
├── tsconfig.json     # TypeScript config
└── README.md         # Package docs
```

### 2. Write your code
Edit `packages/<name>/src/index.ts`:
```ts
import type { ReactNode } from 'react'

export interface Props {
  children?: ReactNode
}

export function MyComponent({ children }: Props) {
  return <div>{children}</div>
}
```

### 3. Update package.json
Make sure these fields exist:
```json
{
  "name": "@bertui/<name>",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "publishConfig": {
    "access": "public"
  }
}
```

### 4. Build and test
```bash
cd packages/<name>
bun run build
```

Test in a local app:
```bash
cd /path/to/test-app
bun add ../bertui-monorepo/packages/<name>
```

### 5. Make it optional (if needed)
If your package should be optional, add it to `packages/core/src/optional.ts`:
```ts
export const OPTIONAL_FEATURES = [
  // ... existing
  { name: 'Package Name', pkg: '@bertui/<name>', configKey: '<name>' },
]
```

And add to `packages/core/src/types/index.ts`:
```ts
export interface BertuiConfig {
  // ... existing
  <name>?: boolean
}
```

### 6. Commit and push
```bash
git add packages/<name>
git commit -m "feat: add @bertui/<name> package"
git push
```

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `bun new-package <name>` | Create a new package |
| `bun run build:changed` | Build only changed packages |
| `bun run watch` | Auto-rebuild on changes |
| `bun run typecheck` | Check types across all packages |

## 📋 Package Checklist

Before submitting:
- [ ] Code builds without errors (`bun run build`)
- [ ] Package has `files: ["dist", "README.md"]`
- [ ] Package has `publishConfig: { access: "public" }`
- [ ] README.md explains usage
- [ ] If optional, added to `optional.ts`
- [ ] Tested with a local app

## 🔗 Links

- [Main README](../README.md)
- [Package Template](./scripts/new-package.ts)
- [Optional Features Guide](./packages/core/src/optional.ts)

---

That's it! Your package will be ready for publishing after review.