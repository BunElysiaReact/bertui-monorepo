#!/usr/bin/env bun
// Run this from the monorepo root:
//   bun run patch.ts
// It patches the source files, rebuilds affected packages, and re-registers bun links.

import { writeFile } from 'fs/promises'
import { execSync } from 'child_process'
import { join } from 'path'

const root = process.cwd()

function run(cmd: string, cwd = root) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

// ─── 1. packages/compiler/src/index.ts ───────────────────────────────────────

await writeFile(join(root, 'packages/compiler/src/index.ts'), `// packages/compiler/src/index.ts
// @bertui/compiler — single JSX/TSX transform pipeline for both dev and build

import { join, extname, relative, dirname } from 'path'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import type { CompileOptions, CompileResult, AliasMap, Route } from '@bertui/core'
import {
  loadEnvVariables,
  replaceEnvInCode,
  buildAliasMap,
  rewriteAliasImports,
} from '@bertui/core'

export interface TransformOptions {
  loader?: 'jsx' | 'tsx' | 'ts' | 'js'
  env?: 'development' | 'production'
  addReactImport?: boolean
}

export async function transform(
  sourceCode: string,
  options: TransformOptions = {}
): Promise<string> {
  const { loader = 'tsx', env = 'development', addReactImport = true } = options

  const transpiler = new Bun.Transpiler({
    loader,
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify(env) },
    tsconfig: {
      compilerOptions: {
        jsx: 'react',
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        module: 'ESNext',
      },
    },
  })

  let compiled = await transpiler.transform(sourceCode)
  if (addReactImport && !compiled.includes('import React') && containsJSX(compiled)) {
    compiled = \`import React from 'react';\\n\${compiled}\`
  }
  if (env === 'production') compiled = compiled.replace(/jsxDEV/g, 'jsx')
  return compiled
}

export function containsJSX(code: string): boolean {
  return (
    code.includes('React.createElement') ||
    code.includes('React.Fragment') ||
    /<[A-Z]/.test(code) ||
    code.includes('jsx(') ||
    code.includes('jsxs(')
  )
}

export function stripCSSImports(code: string): string {
  code = code.replace(
    /import\\s+(\\w+)\\s+from\\s+['"][^'"]*\\.module\\.css['"];?\\s*/g,
    (_, varName: string) => \`const \${varName} = new Proxy({}, { get: (_, k) => k });\\n\`
  )
  code = code.replace(/import\\s+['"][^'"]*\\.css['"];?\\s*/g, '')
  code = code.replace(/import\\s+['"]bertui\\/styles['"]\\s*;?\\s*/g, '')
  return code
}

export function stripDotenvImports(code: string): string {
  code = code.replace(/import\\s+\\w+\\s+from\\s+['"]dotenv['"]\\s*;?\\s*/g, '')
  code = code.replace(/import\\s+\\{[^}]+\\}\\s+from\\s+['"]dotenv['"]\\s*;?\\s*/g, '')
  code = code.replace(/\\w+\\.config\\(\\s*\\)\\s*;?\\s*/g, '')
  return code
}

export function fixRelativeImports(code: string): string {
  const importRegex = /from\\s+['"](\\.\\.\\/[^'"]+?)(?<!\\.js|\\.jsx|\\.ts|\\.tsx|\\.json)['"]/g
  return code.replace(importRegex, (match, path: string) => {
    if (path.endsWith('/') || /\\.\\w+$/.test(path)) return match
    return \`from '\${path}.js'\`
  })
}

// Runs AFTER transform — Bun.Transpiler rewrites imports so we patch the output.
// Handles both 'bertui/router' and 'bertui/router.js' variants.
// rootCompiledDir is always the ROOT .bertui/compiled, never a subdir.
export function fixRouterImports(
  code: string,
  outPath: string,
  rootCompiledDir: string
): string {
  const routerPath   = join(rootCompiledDir, 'router.js')
  const rel          = relative(dirname(outPath), routerPath).replace(/\\\\/g, '/')
  const routerImport = rel.startsWith('.') ? rel : './' + rel
  return code
    .replace(/from\\s+['"]bertui\\/router\\.js['"]/g, \`from '\${routerImport}'\`)
    .replace(/from\\s+['"]bertui\\/router['"]/g,     \`from '\${routerImport}'\`)
}

export interface CompileFileOptions {
  srcPath: string
  outPath: string
  rootCompiledDir: string
  envVars?: Record<string, string>
  aliasMap?: AliasMap
  env?: 'development' | 'production'
}

export async function compileFile(opts: CompileFileOptions): Promise<void> {
  const { srcPath, outPath, rootCompiledDir, envVars = {}, aliasMap = new Map(), env = 'development' } = opts
  const ext    = extname(srcPath)
  const loader = ext === '.tsx' ? 'tsx' : ext === '.ts' ? 'ts' : 'jsx' as const

  let code = await Bun.file(srcPath).text()
  code = stripCSSImports(code)
  code = stripDotenvImports(code)
  code = replaceEnvInCode(code, envVars)
  // DO NOT fix router imports before transform — transpiler undoes it

  let compiled: string
  if (ext === '.js') {
    if (containsJSX(code) && !code.includes('import React')) code = \`import React from 'react';\\n\${code}\`
    compiled = code
  } else {
    compiled = await transform(code, { loader, env, addReactImport: true })
  }

  // Post-transpile — order matters
  compiled = fixRouterImports(compiled, outPath, rootCompiledDir) // 1. router path
  compiled = fixRelativeImports(compiled)                         // 2. append .js
  compiled = rewriteAliasImports(compiled, outPath, aliasMap)    // 3. alias rewrites

  mkdirSync(dirname(outPath), { recursive: true })
  await Bun.write(outPath, compiled)
}

export interface CompileDirectoryOptions {
  srcDir: string
  outDir: string
  root: string
  rootCompiledDir: string
  envVars?: Record<string, string>
  aliasMap?: AliasMap
  env?: 'development' | 'production'
  skip?: string[]
}

export async function compileDirectory(opts: CompileDirectoryOptions): Promise<{ files: number }> {
  const { srcDir, outDir, root, rootCompiledDir, envVars = {}, aliasMap = new Map(), env = 'development', skip = ['api', 'templates'] } = opts
  let files = 0

  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry)
    const stat    = statSync(srcPath)

    if (stat.isDirectory()) {
      if (skip.includes(entry)) continue
      const subOut = join(outDir, entry)
      mkdirSync(subOut, { recursive: true })
      const sub = await compileDirectory({ ...opts, srcDir: srcPath, outDir: subOut })
      files += sub.files
      continue
    }

    const ext = extname(entry)
    if (ext === '.css') continue
    if (!['.jsx', '.tsx', '.ts', '.js'].includes(ext)) continue

    const outPath = join(outDir, entry.replace(/\\.(jsx|tsx|ts)$/, '.js'))
    try {
      await compileFile({ srcPath, outPath, rootCompiledDir, envVars, aliasMap, env })
      files++
    } catch (err) {
      const error = err as Error & { file?: string }
      error.file = relative(root, srcPath)
      throw error
    }
  }
  return { files }
}

export async function compileProject(root: string, opts: Partial<CompileOptions> = {}): Promise<CompileResult> {
  const { loadConfig } = await import('@bertui/core')
  const { discoverRoutes, generateRouter } = await import('./router.js')

  const config  = await loadConfig(root)
  const env     = (opts.env ?? (process.env['NODE_ENV'] as 'development' | 'production' | undefined) ?? 'development')
  const isProd  = env === 'production'

  const compiledDir = isProd ? join(root, '.bertuibuild') : join(root, '.bertui', 'compiled')
  mkdirSync(compiledDir, { recursive: true })

  const envVars   = loadEnvVariables(root)
  const importhow = config.importhow ?? {}
  const aliasMap  = buildAliasMap(importhow, root, compiledDir)
  const srcDir    = join(root, 'src')
  const pagesDir  = join(srcDir, 'pages')
  const start     = Date.now()

  const aliasSkip = Object.keys(importhow).map(a => a.replace(/^@/, ''))

  const stats = await compileDirectory({
    srcDir, outDir: compiledDir, root,
    rootCompiledDir: compiledDir,
    envVars, aliasMap, env,
    skip: ['api', 'templates', ...aliasSkip],
  })

  for (const [alias, relPath] of Object.entries(importhow)) {
    const absSrcDir = join(root, relPath)
    if (!existsSync(absSrcDir)) continue
    const safeName    = alias.replace(/^@/, '')
    const aliasOutDir = join(compiledDir, safeName)
    mkdirSync(aliasOutDir, { recursive: true })
    const s = await compileDirectory({
      srcDir: absSrcDir, outDir: aliasOutDir, root,
      rootCompiledDir: compiledDir,
      envVars, aliasMap, env,
    })
    stats.files += s.files
  }

  let routes: Route[] = []
  if (existsSync(pagesDir)) {
    routes = await discoverRoutes(pagesDir)
    await generateRouter(routes, compiledDir)
  }

  return { outDir: compiledDir, routes, stats: { files: stats.files, skipped: 0, duration: Date.now() - start } }
}
`)

console.log('✓ patched packages/compiler/src/index.ts')

// ─── 2. packages/core/src/utils/index.ts ─────────────────────────────────────

await writeFile(join(root, 'packages/core/src/utils/index.ts'), `// packages/core/src/utils/index.ts

import { readFileSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import type { AliasMap } from '../types/index.js'

export function loadEnvVariables(root: string): Record<string, string> {
  const envPath = join(root, '.env')
  const envVars: Record<string, string> = {}
  if (!existsSync(envPath)) return envVars
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\\n')
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      const match = line.match(/^([^=]+)=(.*)$/)
      if (!match) continue
      const key = match[1]!.trim()
      let value = match[2]!.trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      envVars[key] = value
    }
  } catch { }
  return envVars
}

export function replaceEnvInCode(code: string, envVars: Record<string, string>): string {
  let modified = code
  for (const [key, value] of Object.entries(envVars)) {
    modified = modified.replace(new RegExp(\`process\\\\.env\\\\.\${key}\\\\b\`, 'g'), JSON.stringify(value))
  }
  return modified
}

export function generateEnvCode(envVars: Record<string, string>): string {
  return \`// Auto-generated — do not edit\\n\${Object.entries(envVars).map(([k, v]) => \`export const \${k} = \${JSON.stringify(v)};\`).join('\\n')}\\n\`
}

export interface PageMeta {
  title?: string
  description?: string
  keywords?: string
  author?: string
  themeColor?: string
  lang?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

export function extractMetaFromSource(sourceCode: string): PageMeta {
  const extract = (key: string): string | undefined =>
    sourceCode.match(new RegExp(\`export\\\\s+const\\\\s+\${key}\\\\s*=\\\\s*['"]([^'"]+)['"]\`)) ?.[1]

  const meta: PageMeta = {}
  const title         = extract('title');         if (title         !== undefined) meta.title         = title
  const description   = extract('description');   if (description   !== undefined) meta.description   = description
  const keywords      = extract('keywords');      if (keywords      !== undefined) meta.keywords      = keywords
  const author        = extract('author');        if (author        !== undefined) meta.author        = author
  const themeColor    = extract('themeColor');    if (themeColor    !== undefined) meta.themeColor    = themeColor
  const lang          = extract('lang');          if (lang          !== undefined) meta.lang          = lang
  const ogTitle       = extract('ogTitle');       if (ogTitle       !== undefined) meta.ogTitle       = ogTitle
  const ogDescription = extract('ogDescription'); if (ogDescription !== undefined) meta.ogDescription = ogDescription
  const ogImage       = extract('ogImage');       if (ogImage       !== undefined) meta.ogImage       = ogImage
  return meta
}

export function buildAliasMap(
  importhow: Record<string, string> = {},
  projectRoot: string,
  compiledDir: string | null = null
): AliasMap {
  const map: AliasMap = new Map()
  for (const [alias, relPath] of Object.entries(importhow)) {
    const safeName = alias.replace(/^@/, '')
    const abs = compiledDir ? join(compiledDir, safeName) : join(projectRoot, relPath)
    map.set(alias, abs)
  }
  return map
}

export function rewriteAliasImports(code: string, currentFile: string, aliasMap: AliasMap): string {
  if (!aliasMap || aliasMap.size === 0) return code
  const currentDir = dirname(currentFile)
  const importRe = /(?:import|export)(?:\\s+[\\w*{},\\s]+\\s+from)?\\s+['"]([^'"]+)['"]/g
  return code.replace(importRe, (match, specifier: string) => {
    const slashIdx = specifier.indexOf('/')
    const alias = slashIdx === -1 ? specifier : specifier.slice(0, slashIdx)
    const rest  = slashIdx === -1 ? '' : specifier.slice(slashIdx)
    const absBase = aliasMap.get(alias)
    if (!absBase) return match
    let rel = relative(currentDir, absBase + rest).replace(/\\\\/g, '/')
    if (!rel.startsWith('.')) rel = './' + rel
    if (rest && !/\\.\\w+$/.test(rest)) rel += '.js'
    return match.replace(\`'\${specifier}'\`, \`'\${rel}'\`).replace(\`"\${specifier}"\`, \`"\${rel}"\`)
  })
}

export function getAliasDirs(aliasMap: AliasMap): Set<string> { return new Set(aliasMap.values()) }

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB'] as const
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return \`\${parseFloat((bytes / Math.pow(k, i!)).toFixed(2))} \${sizes[i!]}\`
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return String(text).replace(/[&<>"']/g, m => map[m] ?? m)
}

export function toPascalCase(str: string): string {
  return str.replace(/[-_\\s]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, (c: string) => c.toUpperCase()).replace(/[\\[\\]]/g, '')
}
`)

console.log('✓ patched packages/core/src/utils/index.ts')

// ─── 3. packages/cli/src/index.ts ────────────────────────────────────────────

await writeFile(join(root, 'packages/cli/src/index.ts'), `import { loadConfig, validateOptionalFeatures } from '@bertui/core'
import { join } from 'path'
import { existsSync } from 'fs'

export async function program(): Promise<void> {
  const args    = process.argv.slice(2)
  const command = args[0] ?? 'dev'
  switch (command) {
    case 'dev': {
      const port = parseInt(getArg('--port', '-p') ?? '3000')
      await runDev({ port, root: process.cwd() })
      break
    }
    case 'build': { await runBuild({ root: process.cwd() }); break }
    case 'serve':
    case 'preview': {
      const port = parseInt(getArg('--port', '-p') ?? '5000')
      await runServe({ port, root: process.cwd() })
      break
    }
    case 'analyze': {
      const { analyzeBuild } = await import('./analyze.js')
      await analyzeBuild(join(process.cwd(), 'dist'), { open: args.includes('--open') })
      break
    }
    case 'create': {
      const { scaffold, parseCreateArgs } = await import('./scaffold.js')
      const parsed = parseCreateArgs(args.slice(1))
      if (parsed) await scaffold(parsed.type, parsed.name, { root: process.cwd() })
      break
    }
    case '--version': case '-v': console.log('bertui v2.0.0'); break
    case '--help': case '-h': showHelp(); break
    default: console.error(\`Unknown command: \${command}\`); showHelp()
  }
}

async function runDev(options: { port: number; root: string }): Promise<void> {
  const { root, port } = options
  const { compileProject } = await import('@bertui/compiler')
  const { buildDevImportMap, setupFileWatcher } = await import('@bertui/dev')

  const config = await loadConfig(root)
  await validateOptionalFeatures(config)

  const compiledDir = join(root, '.bertui', 'compiled')
  const clients     = new Set<{ send: (d: string) => void }>()

  // Find error-overlay.js — check several candidate locations
  const overlayPaths = [
    join(root, 'node_modules', '@bertui', 'dev', 'src', 'error-overlay.js'),
    join(root, 'node_modules', '@bertui', 'dev', 'dist', 'error-overlay.js'),
    // symlinked monorepo: node_modules/@bertui/dev is a symlink to packages/dev
    join(root, 'node_modules', '@bertui', 'dev', '..', '..', 'packages', 'dev', 'src', 'error-overlay.js'),
  ]
  const overlayFile = overlayPaths.find(p => existsSync(p)) ?? null

  const cssDir = join(root, '.bertui', 'styles')

  function notifyClients(msg: object): void {
    for (const c of clients) { try { c.send(JSON.stringify(msg)) } catch { clients.delete(c) } }
  }

  printHeader('DEV')
  console.log('  [ 1/4 ] Compiling...')
  await compileProject(root, { env: 'development' })
  console.log('  [ 2/4 ] Building import map...')
  const importMap = await buildDevImportMap(root)
  console.log('  [ 3/4 ] Setting up file watcher...')
  const stopWatcher = setupFileWatcher({ root, compiledDir, notifyClients: msg => notifyClients(msg) })
  console.log('  [ 4/4 ] Starting server...')

  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url)

      if (url.pathname === '/__hmr') {
        if (server.upgrade(req)) return undefined
        return new Response('WebSocket upgrade failed', { status: 500 })
      }

      if (url.pathname === '/error-overlay.js') {
        if (overlayFile) {
          const f = Bun.file(overlayFile)
          if (await f.exists()) return new Response(f, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } })
        }
        return new Response('(function(){})();', { headers: { 'Content-Type': 'application/javascript' } })
      }

      if (url.pathname.startsWith('/styles/')) {
        const f = Bun.file(join(cssDir, url.pathname.replace('/styles/', '')))
        if (await f.exists()) return new Response(f, { headers: { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' } })
        return new Response('', { headers: { 'Content-Type': 'text/css' } })
      }

      if (url.pathname === '/' || (!url.pathname.includes('.') && !url.pathname.startsWith('/compiled'))) {
        const meta = config.meta
        const html = \`<!DOCTYPE html>
<html lang="\${meta.lang ?? 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${meta.title ?? 'BertUI App'}</title>
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <script type="importmap">\${JSON.stringify({ imports: importMap }, null, 2)}</script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    const ws = new WebSocket('ws://localhost:\${port}/__hmr');
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'reload') location.reload();
      if (d.type === 'importmap-updated') location.reload();
      if (d.type === 'compilation-error' && window.__BERTUI_SHOW_ERROR__) window.__BERTUI_SHOW_ERROR__(d);
    };
  </script>
  <script src="/error-overlay.js"></script>
  <script type="module" src="/compiled/main.js"></script>
</body>
</html>\`
        return new Response(html, { headers: { 'Content-Type': 'text/html' } })
      }

      if (url.pathname.startsWith('/compiled/')) {
        const f = Bun.file(join(compiledDir, url.pathname.replace('/compiled/', '')))
        if (await f.exists()) return new Response(f, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } })
      }

      if (url.pathname.startsWith('/node_modules/')) {
        const f = Bun.file(join(root, 'node_modules', url.pathname.replace('/node_modules/', '')))
        if (await f.exists()) return new Response(f, { headers: { 'Cache-Control': 'no-cache' } })
      }

      const pubFile = Bun.file(join(root, 'public', url.pathname.slice(1)))
      if (await pubFile.exists()) return new Response(pubFile)

      return new Response('Not found', { status: 404 })
    },
    websocket: {
      open(ws) { clients.add(ws) },
      close(ws) { clients.delete(ws) },
      message() {},
    },
  })

  process.stdout.write(\`\\n  \\x1b[1m\\x1b[32m▶  Ready on http://localhost:\${port}\\x1b[0m\\n\\n\`)
  process.on('SIGINT', () => { stopWatcher(); server.stop(); process.exit(0) })
}

async function runBuild(options: { root: string }): Promise<void> {
  printHeader('BUILD')
  const config = await loadConfig(options.root)
  await validateOptionalFeatures(config)
  const { buildProduction } = await import('./build.js')
  await buildProduction(options)
}

async function runServe(options: { port: number; root: string }): Promise<void> {
  const { root, port } = options
  const distDir = join(root, 'dist')
  if (!Bun.file(join(distDir, 'index.html')).existsSync?.()) { console.error('  dist/ not found — run: bertui build'); process.exit(1) }
  console.log(\`\\n  Preview running at http://localhost:\${port}\`)
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      let fp = join(distDir, url.pathname)
      if (url.pathname === '/') fp = join(distDir, 'index.html')
      if (!fp.includes('.')) { const idx = join(fp, 'index.html'); if (Bun.file(idx).existsSync?.()) fp = idx }
      const f = Bun.file(fp)
      if (await f.exists()) return new Response(f)
      const spa = Bun.file(join(distDir, 'index.html'))
      if (await spa.exists()) return new Response(spa, { headers: { 'Content-Type': 'text/html' } })
      return new Response('Not found', { status: 404 })
    },
  })
}

function getArg(long: string, short: string): string | null {
  const args = process.argv.slice(2)
  const idx  = args.indexOf(long) !== -1 ? args.indexOf(long) : args.indexOf(short)
  return idx !== -1 && args[idx + 1] ? args[idx + 1]! : null
}

function printHeader(mode: string): void {
  const BIG = [
    '  ██████╗ ███████╗██████╗ ████████╗██╗   ██╗██╗',
    '  ██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██║   ██║██║',
    '  ██████╔╝█████╗  ██████╔╝   ██║   ██║   ██║██║',
    '  ██╔══██╗██╔══╝  ██╔══██╗   ██║   ██║   ██║██║',
    '  ██████╔╝███████╗██║  ██║   ██║   ╚██████╔╝██║',
    '  ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝',
  ]
  process.stdout.write('\\n\\x1b[36m\\x1b[1m')
  for (const row of BIG) process.stdout.write(row + '\\n')
  process.stdout.write(\`\\x1b[0m\\x1b[90m  by Pease Ernest  ·  \\x1b[0m\\x1b[1m\${mode}\\x1b[0m\\n\\n\`)
}

function showHelp(): void {
  console.log(\`
Commands:
  bertui dev [--port]     Start dev server (default: 3000)
  bertui build            Production build
  bertui serve [--port]   Preview build (default: 5000)
  bertui analyze          Bundle analyzer
  bertui create <type>    Scaffold component/page/layout/middleware
  \`)
}
`)

console.log('✓ patched packages/cli/src/index.ts')

// ─── 4. Build + link all affected packages ────────────────────────────────────

const packages = [
  { dir: 'packages/core',     link: '@bertui/core' },
  { dir: 'packages/compiler', link: '@bertui/compiler' },
  { dir: 'packages/dev',      link: '@bertui/dev' },
  { dir: 'packages/cli',      link: '@bertui/cli' },
]

for (const pkg of packages) {
  const pkgDir = join(root, pkg.dir)
  run('bun run build', pkgDir)
  run('bun link',      pkgDir)
}

console.log('\n✅ All done. Now run in your test project:\n')
console.log('  bun link @bertui/core @bertui/compiler @bertui/dev @bertui/cli')
console.log('  # delete .bertui/ to force clean recompile')
console.log('  rm -rf .bertui')
console.log('  bun run dev\n')