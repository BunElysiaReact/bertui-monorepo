// packages/elysia/src/dev-handler.ts
// Singleton dev handler — wraps all BertUI dev server logic

import { join, extname } from 'path'
import { existsSync } from 'fs'

export interface DevHandlerOptions {
  root: string
  port?: number
}

export interface DevHandlerInstance {
  handleRequest(request: Request): Promise<Response | null>
  dispose(): void
}

export async function createDevHandler(options: DevHandlerOptions): Promise<DevHandlerInstance> {
  const { root, port = 3000 } = options

  const { loadConfig }    = await import('@bertui/core')
  const { compileProject } = await import('@bertui/compiler')

  const config      = await loadConfig(root)
  const compiledDir = join(root, '.bertui', 'compiled')
  const srcDir      = join(root, 'src')
  const publicDir   = join(root, 'public')
  const stylesDir   = join(root, '.bertui', 'styles')

  // Initial compile
  await compileProject(root, { env: 'development' })

  const clients = new Set<{ send: (data: string) => void }>()

  function notifyClients(msg: object): void {
    for (const client of clients) {
      try { client.send(JSON.stringify(msg)) }
      catch { clients.delete(client) }
    }
  }

  async function handleRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url)
    const { pathname } = url

    // HMR websocket upgrade signal — caller handles upgrade
    if (pathname === '/__hmr') return null

    // Page HTML
    if (pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/compiled'))) {
      const html = await buildHTML(root, config, port, compiledDir)
      return new Response(html, { headers: { 'Content-Type': 'text/html' } })
    }

    // Compiled JS
    if (pathname.startsWith('/compiled/')) {
      const file = Bun.file(join(compiledDir, pathname.replace('/compiled/', '')))
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      }
    }

    // Styles
    if (pathname.startsWith('/styles/')) {
      const file = Bun.file(join(stylesDir, pathname.replace('/styles/', '')))
      if (await file.exists()) {
        return new Response(file, { headers: { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' } })
      }
    }

    // Public dir
    const publicFile = Bun.file(join(publicDir, pathname.slice(1)))
    if (await publicFile.exists()) {
      return new Response(publicFile, { headers: { 'Cache-Control': 'no-cache' } })
    }

    // node_modules
    if (pathname.startsWith('/node_modules/')) {
      const file = Bun.file(join(root, 'node_modules', pathname.replace('/node_modules/', '')))
      if (await file.exists()) {
        const ext = extname(pathname).toLowerCase()
        return new Response(file, {
          headers: { 'Content-Type': getMime(ext), 'Cache-Control': 'no-cache' },
        })
      }
    }

    return null
  }

  function dispose(): void {
    clients.clear()
  }

  return { handleRequest, dispose }
}

// ─── HTML shell ───────────────────────────────────────────────────────────────

async function buildHTML(
  root: string,
  config: Awaited<ReturnType<typeof import('@bertui/core').loadConfig>>,
  port: number,
  _compiledDir: string
): Promise<string> {
  const meta = config.meta

  const importMap = {
    'react':                 'https://esm.sh/react@19.0.0',
    'react-dom':             'https://esm.sh/react-dom@19.0.0',
    'react-dom/client':      'https://esm.sh/react-dom@19.0.0/client',
    'react/jsx-runtime':     'https://esm.sh/react@19.0.0/jsx-runtime',
    'react/jsx-dev-runtime': 'https://esm.sh/react@19.0.0/jsx-dev-runtime',
    '@bunnyx/api':           '/bunnyx-api/api-client.js',
  }

  return `<!DOCTYPE html>
<html lang="${meta.lang ?? 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title ?? 'BertUI App'}</title>
  ${meta.description ? `<meta name="description" content="${meta.description}">` : ''}
  ${meta.themeColor  ? `<meta name="theme-color" content="${meta.themeColor}">` : ''}
  <link rel="icon" type="image/svg+xml" href="/public/favicon.svg">
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    const ws = new WebSocket('ws://localhost:${port}/__hmr');
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'reload') location.reload();
      if (d.type === 'compilation-error' && window.__BERTUI_SHOW_ERROR__) {
        window.__BERTUI_SHOW_ERROR__(d);
      }
    };
  </script>
  <script src="/error-overlay.js"></script>
  <script type="module" src="/compiled/main.js"></script>
</body>
</html>`
}

function getMime(ext: string): string {
  const m: Record<string, string> = {
    '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png',
  }
  return m[ext] ?? 'application/octet-stream'
}
