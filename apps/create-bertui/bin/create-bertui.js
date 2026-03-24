#!/usr/bin/env bun
// apps/create-bertui/bin/create-bertui.js

import { join, existsSync, mkdirSync, cpSync } from 'path' with { type: 'json' }

const args    = process.argv.slice(2)
const appName = args[0]

if (!appName) {
  console.error('\n  Usage: bunx create-bertui <app-name>\n')
  process.exit(1)
}

const root = join(process.cwd(), appName)

if (existsSync(root)) {
  console.error(`\n  Directory "${appName}" already exists\n`)
  process.exit(1)
}

const BIG = [
  '  ██████╗ ███████╗██████╗ ████████╗██╗   ██╗██╗',
  '  ██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██║   ██║██║',
  '  ██████╔╝█████╗  ██████╔╝   ██║   ██║   ██║██║',
  '  ██╔══██╗██╔══╝  ██╔══██╗   ██║   ██║   ██║██║',
  '  ██████╔╝███████╗██║  ██║   ██║   ╚██████╔╝██║',
  '  ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝',
]

process.stdout.write('\n\x1b[36m\x1b[1m')
for (const row of BIG) process.stdout.write(row + '\n')
process.stdout.write(`\x1b[0m\x1b[90m  by Pease Ernest  ·  \x1b[0mcreating \x1b[1m${appName}\x1b[0m\n\n`)

// Create structure
const dirs = [
  'src/pages',
  'src/components',
  'src/styles',
  'public',
]
for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true })

// package.json
await Bun.write(join(root, 'package.json'), JSON.stringify({
  name: appName,
  version: '0.1.0',
  type: 'module',
  scripts: {
    dev:     'bertui dev',
    build:   'bertui build',
    preview: 'bertui serve',
  },
  dependencies: {
    bertui: '^2.0.0',
    react:      '^19.0.0',
    'react-dom': '^19.0.0',
  },
  devDependencies: {
    '@types/react':     '^19.0.0',
    '@types/react-dom': '^19.0.0',
    typescript: '^6.0.0',
  },
}, null, 2))

// bertui.config.js
await Bun.write(join(root, 'bertui.config.js'), `export default {
  siteName: '${appName}',
  baseUrl: 'https://example.com',
  meta: {
    title: '${appName}',
    description: 'Built with BertUI',
  },
}
`)

// tsconfig.json
await Bun.write(join(root, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ESNext',
    module: 'ESNext',
    moduleResolution: 'bundler',
    lib: ['ESNext', 'DOM'],
    jsx: 'react-jsx',
    strict: true,
    skipLibCheck: true,
  },
  include: ['src/**/*'],
}, null, 2))

// src/main.tsx
await Bun.write(join(root, 'src', 'main.tsx'), `import React from 'react'
import { createRoot } from 'react-dom/client'
import { Router, routes } from './router.js'

const root = document.getElementById('root')!
createRoot(root).render(<Router routes={routes} />)
`)

// src/pages/index.tsx
await Bun.write(join(root, 'src', 'pages', 'index.tsx'), `import React from 'react'

export const title = 'Home'
export const description = 'Welcome to ${appName}'

export default function HomePage() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡ ${appName}</h1>
      <p style={{ color: '#6b7280' }}>Built with BertUI v2</p>
      <a href="https://github.com/BunElysiaReact/BERTUI" target="_blank" style={{ marginTop: '2rem', color: '#10b981', textDecoration: 'none' }}>
        View docs →
      </a>
    </main>
  )
}
`)

// src/styles/global.css
await Bun.write(join(root, 'src', 'styles', 'global.css'), `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #ffffff;
  color: #111827;
}

@media (prefers-color-scheme: dark) {
  body {
    background: #0f172a;
    color: #f1f5f9;
  }
}
`)

// public/favicon.svg
await Bun.write(join(root, 'public', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text y=".9em" font-size="90">⚡</text>
</svg>
`)

// .gitignore
await Bun.write(join(root, '.gitignore'), `node_modules
dist
.bertui
.bertuibuild
.env.local
bun.lock
`)

// .env
await Bun.write(join(root, '.env'), `# Environment variables
# VITE_API_URL=https://api.example.com
`)

process.stdout.write(`  \x1b[32m✓\x1b[0m  Created ${appName}/\n`)
process.stdout.write(`\n  Next steps:\n\n`)
process.stdout.write(`  \x1b[90mcd\x1b[0m ${appName}\n`)
process.stdout.write(`  \x1b[90mbun install\x1b[0m\n`)
process.stdout.write(`  \x1b[90mbun run dev\x1b[0m\n\n`)
