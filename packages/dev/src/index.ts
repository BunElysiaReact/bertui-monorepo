// packages/dev/src/index.ts
// @bertui/dev — HMR server, file watcher, import map

import { join, extname, existsSync, readdirSync, statSync } from 'path'
import type { HMRMessage } from '@bertui/core'

export type { HMRMessage }

// ─── Import map ───────────────────────────────────────────────────────────────

let _cachedMap:    Record<string, string> | null = null
let _cachedMtime:  number | null = null

export async function buildDevImportMap(root: string): Promise<Record<string, string>> {
  const pkgJsonPath    = join(root, 'package.json')
  const nodeModulesDir = join(root, 'node_modules')

  let currentMtime: number | null = null
  try { currentMtime = statSync(pkgJsonPath).mtimeMs } catch { /* ignore */ }

  if (_cachedMap && currentMtime === _cachedMtime) return _cachedMap

  const importMap: Record<string, string> = {
    'react':                 'https://esm.sh/react@19.0.0',
    'react-dom':             'https://esm.sh/react-dom@19.0.0',
    'react-dom/client':      'https://esm.sh/react-dom@19.0.0/client',
    'react/jsx-runtime':     'https://esm.sh/react@19.0.0/jsx-runtime',
    'react/jsx-dev-runtime': 'https://esm.sh/react@19.0.0/jsx-dev-runtime',
    '@bunnyx/api':           '/bunnyx-api/api-client.js',
  }

  const SKIP = new Set(['react', 'react-dom', '.bin', '.cache'])

  if (existsSync(nodeModulesDir)) {
    for (const pkg of readdirSync(nodeModulesDir)) {
      if (SKIP.has(pkg) || pkg.startsWith('.')) continue

      const pkgDir      = join(nodeModulesDir, pkg)
      const pkgJsonFile = join(pkgDir, 'package.json')

      try {
        if (!statSync(pkgDir).isDirectory()) continue
        if (!existsSync(pkgJsonFile)) continue

        const pkgJson = JSON.parse(await Bun.file(pkgJsonFile).text()) as Record<string, unknown>
        const entries = [pkgJson['module'], pkgJson['browser'], pkgJson['main'], 'index.js']
          .filter((e): e is string => typeof e === 'string')

        for (const entry of entries) {
          if (existsSync(join(pkgDir, entry))) {
            importMap[pkg] = `/node_modules/${pkg}/${entry}`
            break
          }
        }
      } catch { /* ignore */ }
    }
  }

  _cachedMap   = importMap
  _cachedMtime = currentMtime
  return importMap
}

export function invalidateImportMap(): void {
  _cachedMap   = null
  _cachedMtime = null
}

// ─── File watcher ─────────────────────────────────────────────────────────────

export interface WatcherOptions {
  root: string
  compiledDir: string
  onRecompile?: () => Promise<void>
  notifyClients: (msg: HMRMessage) => void
}

export function setupFileWatcher(opts: WatcherOptions): () => void {
  const { root, compiledDir: _compiledDir, onRecompile, notifyClients } = opts
  const srcDir    = join(root, 'src')
  const pkgJson   = join(root, 'package.json')

  if (!existsSync(srcDir)) return () => {}

  const WATCHED_EXTS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.css',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  ])

  let isRecompiling = false
  let debounce:      ReturnType<typeof setTimeout> | null = null

  const { watch } = require('fs') as typeof import('fs')

  const srcWatcher = watch(srcDir, { recursive: true }, async (_evt: string, filename: string | null) => {
    if (!filename) return
    if (!WATCHED_EXTS.has(extname(filename))) return

    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(async () => {
      if (isRecompiling) return
      isRecompiling = true
      notifyClients({ type: 'recompiling' })

      try {
        const { compileProject } = await import('@bertui/compiler')
        await compileProject(root, { env: 'development' })
        if (onRecompile) await onRecompile()
        notifyClients({ type: 'compiled' })
        setTimeout(() => notifyClients({ type: 'reload' }), 100)
      } catch (err) {
        const error = err as Error & { file?: string; line?: number; column?: number }
        notifyClients({
          type: 'compilation-error',
          message: error.message,
          stack:   error.stack,
          file:    error.file,
          line:    error.line,
          column:  error.column,
        })
      } finally {
        isRecompiling = false
      }
    }, 150)
  })

  // package.json watcher for new installs
  let pkgWatcher: ReturnType<typeof watch> | null = null
  let lastMtime: number | null = null

  if (existsSync(pkgJson)) {
    try { lastMtime = statSync(pkgJson).mtimeMs } catch { /* ignore */ }

    pkgWatcher = watch(pkgJson, async () => {
      try {
        const newMtime = statSync(pkgJson).mtimeMs
        if (newMtime === lastMtime) return
        lastMtime = newMtime
        invalidateImportMap()
        await buildDevImportMap(root)
        notifyClients({ type: 'importmap-updated' })
      } catch { /* ignore */ }
    })
  }

  return () => {
    srcWatcher.close()
    pkgWatcher?.close()
    if (debounce) clearTimeout(debounce)
  }
}
