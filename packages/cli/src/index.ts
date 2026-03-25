import { loadConfig, validateOptionalFeatures } from '@bertui/core'
import { join } from 'path'

// ─── Program Entry Point ─────────────────────────────────────────────────────

export async function program(): Promise<void> {
  const args    = process.argv.slice(2)
  const command = args[0] ?? 'dev'

  switch (command) {

    case 'dev': {
      const port = parseInt(getArg('--port', '-p') ?? '3000')
      await runDev({ port, root: process.cwd() })
      break
    }

    case 'build': {
      await runBuild({ root: process.cwd() })
      break
    }

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

    case '--version':
    case '-v':
      console.log('bertui v2.0.0')
      break

    case '--help':
    case '-h':
      showHelp()
      break

    default:
      console.error(`Unknown command: ${command}`)
      showHelp()
  }
}

// ─── Dev ─────────────────────────────────────────────────────────────────────

async function runDev(options: { port: number; root: string }): Promise<void> {
  const { root, port } = options
  const { compileProject } = await import('@bertui/compiler')
  const { buildDevImportMap, setupFileWatcher } = await import('@bertui/dev')
  
  // Load config and validate optional features
  const config      = await loadConfig(root)
  await validateOptionalFeatures(config)  // Add this line
  
  const compiledDir = join(root, '.bertui', 'compiled')
  const clients     = new Set<{ send: (d: string) => void }>()

  function notifyClients(msg: object): void {
    for (const c of clients) {
      try { c.send(JSON.stringify(msg)) }
      catch { clients.delete(c) }
    }
  }

  printHeader('DEV')
  console.log('  [ 1/4 ] Compiling...')
  await compileProject(root, { env: 'development' })

  console.log('  [ 2/4 ] Building import map...')
  const importMap = await buildDevImportMap(root)

  console.log('  [ 3/4 ] Setting up file watcher...')
  const stopWatcher = setupFileWatcher({
    root,
    compiledDir,
    notifyClients: (msg) => notifyClients(msg),
  })

  console.log('  [ 4/4 ] Starting server...')

  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url)

      if (url.pathname === '/__hmr') {
        const ok = server.upgrade(req)
        if (ok) return undefined
        return new Response('WebSocket upgrade failed', { status: 500 })
      }

      // Page HTML
      if (url.pathname === '/' || (!url.pathname.includes('.') && !url.pathname.startsWith('/compiled'))) {
        const meta = config.meta
        const html = `<!DOCTYPE html>
<html lang="${meta.lang ?? 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title ?? 'BertUI App'}</title>
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    const ws = new WebSocket('ws://localhost:${port}/__hmr');
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
</html>`
        return new Response(html, { headers: { 'Content-Type': 'text/html' } })
      }

      // Compiled JS
      if (url.pathname.startsWith('/compiled/')) {
        const file = Bun.file(join(compiledDir, url.pathname.replace('/compiled/', '')))
        if (await file.exists()) {
          return new Response(file, {
            headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
          })
        }
      }

      // Styles
      if (url.pathname.startsWith('/styles/')) {
        const file = Bun.file(join(root, '.bertui', 'styles', url.pathname.replace('/styles/', '')))
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' } })
        }
      }

      // node_modules
      if (url.pathname.startsWith('/node_modules/')) {
        const file = Bun.file(join(root, 'node_modules', url.pathname.replace('/node_modules/', '')))
        if (await file.exists()) return new Response(file, { headers: { 'Cache-Control': 'no-cache' } })
      }

      // Public
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

  process.stdout.write(`\n  \x1b[1m\x1b[32m▶  Ready on http://localhost:${port}\x1b[0m\n\n`)

  process.on('SIGINT', () => {
    stopWatcher()
    server.stop()
    process.exit(0)
  })
}

// ─── Build ────────────────────────────────────────────────────────────────────

async function runBuild(options: { root: string }): Promise<void> {
  printHeader('BUILD')
  
  // Load config and validate optional features
  const config = await loadConfig(options.root)
  await validateOptionalFeatures(config)  // Add this line
  
  const { buildProduction } = await import('./build.js')
  await buildProduction(options)
}

// ─── Serve ────────────────────────────────────────────────────────────────────

async function runServe(options: { port: number; root: string }): Promise<void> {
  const { root, port } = options
  const distDir = join(root, 'dist')

  if (!Bun.file(join(distDir, 'index.html')).existsSync?.()) {
    console.error('  dist/ not found — run: bertui build')
    process.exit(1)
  }

  console.log(`\n  Preview running at http://localhost:${port}`)

  Bun.serve({
    port,
    async fetch(req) {
      const url      = new URL(req.url)
      let filePath   = join(distDir, url.pathname)
      if (url.pathname === '/') filePath = join(distDir, 'index.html')
      if (!filePath.includes('.')) {
        const idx = join(filePath, 'index.html')
        if (Bun.file(idx).existsSync?.()) filePath = idx
      }
      const file = Bun.file(filePath)
      if (await file.exists()) return new Response(file)
      const spa = Bun.file(join(distDir, 'index.html'))
      if (await spa.exists()) return new Response(spa, { headers: { 'Content-Type': 'text/html' } })
      return new Response('Not found', { status: 404 })
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getArg(long: string, short: string): string | null {
  const args  = process.argv.slice(2)
  const idx   = args.indexOf(long) !== -1 ? args.indexOf(long) : args.indexOf(short)
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
  process.stdout.write('\n\x1b[36m\x1b[1m')
  for (const row of BIG) process.stdout.write(row + '\n')
  process.stdout.write(`\x1b[0m\x1b[90m  by Pease Ernest  ·  \x1b[0m\x1b[1m${mode}\x1b[0m\n\n`)
}

function showHelp(): void {
  console.log(`
Commands:
  bertui dev [--port]     Start dev server (default: 3000)
  bertui build            Production build
  bertui serve [--port]   Preview build (default: 5000)
  bertui analyze          Bundle analyzer
  bertui create <type>    Scaffold component/page/layout/middleware
  `)
}