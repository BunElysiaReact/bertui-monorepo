// packages/elysia/src/index.ts
// @bertui/elysia — Elysia plugin for BertUI
// Singleton lifecycle — no more recreating DevHandler per request

import { join, extname } from 'path'
import { existsSync } from 'fs'
import type { BertuiElysiaOptions } from '@bertui/core'
import { loadConfig } from '@bertui/core'

// ─── Elysia import (peer dep) ─────────────────────────────────────────────────

type ElysiaApp = {
  get: (path: string, handler: (ctx: { request: Request }) => unknown) => ElysiaApp
  use: (plugin: unknown) => ElysiaApp
}

// ─── Internal dev handler singleton ──────────────────────────────────────────

interface DevHandlerInstance {
  handleRequest(request: Request): Promise<Response | null>
  dispose(): void
}

let _singleton: DevHandlerInstance | null = null
let _root: string | null = null

async function getDevHandler(root: string): Promise<DevHandlerInstance> {
  // Return existing singleton if same root
  if (_singleton && _root === root) return _singleton

  // Dispose old one if root changed
  _singleton?.dispose()

  const { createDevHandler } = await import('./dev-handler.js')
  _singleton = await createDevHandler({ root })
  _root = root
  return _singleton
}

// ─── The plugin ───────────────────────────────────────────────────────────────

export function bertui(options: BertuiElysiaOptions = {}) {
  const root = options.root ?? process.cwd()

  // Return a plain Elysia plugin object
  // Users call: app.use(bertui({ root: './my-app' }))
  return {
    name: '@bertui/elysia',
    async setup(app: ElysiaApp) {
      const config = await loadConfig(root)
      const port   = options.port ?? config.port ?? 3000

      // Serve static dist if in production
      if (options.serveStatic) {
        const distDir = join(root, 'dist')
        if (existsSync(distDir)) {
          app.get('/assets/*', async ({ request }) => {
            const url      = new URL(request.url)
            const filePath = join(distDir, url.pathname)
            const file     = Bun.file(filePath)
            if (await file.exists()) {
              const ext = extname(filePath).toLowerCase()
              return new Response(file, {
                headers: {
                  'Content-Type': getMimeType(ext),
                  'Cache-Control': 'public, max-age=31536000, immutable',
                },
              })
            }
            return new Response('Not found', { status: 404 })
          })
        }
      }

      // Catch-all: delegate to BertUI dev handler
      app.get('/*', async ({ request }) => {
        const handler  = await getDevHandler(root)
        const response = await handler.handleRequest(request)
        if (response) return response
        return new Response('Not found', { status: 404 })
      })

      return app
    },
  }
}

// ─── Standalone middleware (for custom Elysia setups) ─────────────────────────

export async function bertuiMiddleware(
  request: Request,
  options: BertuiElysiaOptions = {}
): Promise<Response | null> {
  const root    = options.root ?? process.cwd()
  const handler = await getDevHandler(root)
  return handler.handleRequest(request)
}

// ─── Cleanup export ───────────────────────────────────────────────────────────

export function disposeBertui(): void {
  _singleton?.dispose()
  _singleton = null
  _root      = null
}

// ─── MIME helper ─────────────────────────────────────────────────────────────

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.webp': 'image/webp',
    '.ico':  'image/x-icon',
    '.woff2':'font/woff2',
    '.woff': 'font/woff',
    '.ttf':  'font/ttf',
  }
  return types[ext] ?? 'application/octet-stream'
}
