// packages/cli/src/scaffold.ts
// bertui create <type> <name>

import { join } from 'path'
import { existsSync, readdirSync, statSync, mkdirSync } from 'fs'
import { toPascalCase } from '@bertui/core'

export interface ScaffoldOptions {
  root: string
  ts?: boolean
}

export async function scaffold(
  type: string,
  name: string,
  options: ScaffoldOptions = { root: process.cwd() }
): Promise<string | false> {
  const { root, ts = true } = options
  const ext = ts ? '.tsx' : '.jsx'

  switch (type) {
    case 'component': return createComponent(name, root, ext)
    case 'page':      return createPage(name, root, ext)
    case 'layout':    return createLayout(name, root, ext)
    case 'loading':   return createLoading(name, root, ext)
    case 'middleware':return createMiddleware(root, ts)
    default:
      console.error(`Unknown type: ${type}. Use: component, page, layout, loading, middleware`)
      return false
  }
}

async function createComponent(name: string, root: string, ext: string): Promise<string | false> {
  const pascal  = toPascalCase(name)
  const dir     = join(root, 'src', 'components')
  const outPath = join(dir, `${pascal}${ext}`)

  mkdirSync(dir, { recursive: true })
  if (existsSync(outPath)) { console.warn(`Already exists: ${outPath}`); return false }

  const code = `import React from 'react'

interface ${pascal}Props {
  className?: string
  children?: React.ReactNode
}

export default function ${pascal}({ className = '', children }: ${pascal}Props) {
  return (
    <div className={className}>
      {children ?? <p>${pascal} component</p>}
    </div>
  )
}
`
  await Bun.write(outPath, code)
  console.log(`  \x1b[32m✓\x1b[0m  Created src/components/${pascal}${ext}`)
  return outPath
}

async function createPage(name: string, root: string, ext: string): Promise<string | false> {
  const parts    = name.split('/')
  const pageName = toPascalCase(parts[parts.length - 1]!)
  const dir      = join(root, 'src', 'pages', ...parts.slice(0, -1))
  const fileName = pageName.toLowerCase() === 'index' ? 'index' : pageName.toLowerCase()
  const outPath  = join(dir, `${fileName}${ext}`)
  const route    = `/${name.toLowerCase()}`

  mkdirSync(dir, { recursive: true })
  if (existsSync(outPath)) { console.warn(`Already exists: ${outPath}`); return false }

  const code = `// Route: ${route}
import React from 'react'
import { Link } from 'bertui/router'

export const title = '${pageName}'
export const description = '${pageName} page'

export default function ${pageName}Page() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>${pageName}</h1>
      <p>Welcome to ${pageName}</p>
      <Link to="/">← Back home</Link>
    </main>
  )
}
`
  await Bun.write(outPath, code)
  console.log(`  \x1b[32m✓\x1b[0m  Created src/pages/${name}${ext}  (route: ${route})`)
  return outPath
}

async function createLayout(name: string, root: string, ext: string): Promise<string | false> {
  const pascal  = toPascalCase(name)
  const dir     = join(root, 'src', 'layouts')
  const outPath = join(dir, `${name.toLowerCase()}${ext}`)

  mkdirSync(dir, { recursive: true })
  if (existsSync(outPath)) { console.warn(`Already exists: ${outPath}`); return false }

  const code = `import React from 'react'

interface ${pascal}LayoutProps {
  children: React.ReactNode
}

export default function ${pascal}Layout({ children }: ${pascal}LayoutProps) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
        <a href="/" style={{ fontWeight: 700, textDecoration: 'none', color: 'inherit' }}>
          My App
        </a>
      </header>
      <main style={{ padding: '2rem' }}>
        {children}
      </main>
      <footer style={{ padding: '1rem 2rem', borderTop: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '14px', textAlign: 'center' }}>
        Built with BertUI ⚡
      </footer>
    </div>
  )
}
`
  await Bun.write(outPath, code)
  const scope = name.toLowerCase() === 'default' ? 'ALL pages' : `/${name.toLowerCase()}/ pages`
  console.log(`  \x1b[32m✓\x1b[0m  Created src/layouts/${name.toLowerCase()}${ext}  (wraps ${scope})`)
  return outPath
}

async function createLoading(name: string, root: string, ext: string): Promise<string | false> {
  const pascal  = toPascalCase(name)
  const isRoot  = name.toLowerCase() === 'root' || name === '/'
  const dir     = isRoot ? join(root, 'src', 'pages') : join(root, 'src', 'pages', name.toLowerCase())
  const outPath = join(dir, `loading${ext}`)

  mkdirSync(dir, { recursive: true })
  if (existsSync(outPath)) { console.warn(`Already exists: ${outPath}`); return false }

  const code = `import React from 'react'

export default function ${pascal}Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', fontFamily: 'system-ui' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading ${pascal}...</p>
    </div>
  )
}
`
  await Bun.write(outPath, code)
  console.log(`  \x1b[32m✓\x1b[0m  Created loading state for ${isRoot ? '/' : `/${name.toLowerCase()}`}`)
  return outPath
}

async function createMiddleware(root: string, ts: boolean): Promise<string | false> {
  const ext     = ts ? '.ts' : '.js'
  const outPath = join(root, 'src', `middleware${ext}`)

  if (existsSync(outPath)) { console.warn(`Already exists: ${outPath}`); return false }

  const code = ts
    ? `import type { MiddlewareContext } from '@bertui/core'

// Runs before every page request
export async function onRequest(ctx: MiddlewareContext) {
  // Example: protect /dashboard
  // if (ctx.pathname.startsWith('/dashboard')) {
  //   const token = ctx.headers['authorization']
  //   if (!token) return ctx.redirect('/login')
  // }
  console.log('[Middleware]', ctx.method, ctx.pathname)
}

export async function onError(ctx: MiddlewareContext, error: Error) {
  console.error('[Middleware Error]', error.message)
}
`
    : `// Runs before every page request
export async function onRequest(ctx) {
  console.log('[Middleware]', ctx.method, ctx.pathname)
}
`

  await Bun.write(outPath, code)
  console.log(`  \x1b[32m✓\x1b[0m  Created src/middleware${ext}`)
  return outPath
}

export function parseCreateArgs(args: string[]): { type: string; name: string } | null {
  const [type, name] = args
  if (!type) { console.error('Usage: bertui create <type> [name]'); return null }
  if (type !== 'middleware' && !name) { console.error(`Usage: bertui create ${type} <name>`); return null }
  return { type, name: name ?? type }
}
