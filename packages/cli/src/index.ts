import { loadConfig, validateOptionalFeatures } from '@bertui/core'
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
    default: console.error(`Unknown command: ${command}`); showHelp()
  }
}

async function runDev(options: { port: number; root: string }): Promise<void> {
  const { root, port } = options
  const { compileProject } = await import('@bertui/compiler')
  const { buildDevImportMap, setupFileWatcher } = await import('@bertui/dev')
  const { buildAllCSS } = await import('@bertui/css')

  const config = await loadConfig(root)
  await validateOptionalFeatures(config)

  const compiledDir = join(root, '.bertui', 'compiled')
  const bertuiDir   = join(root, '.bertui')
  const clients     = new Set<{ send: (d: string) => void }>()

  // Find error-overlay.js — check several candidate locations
  const overlayPaths = [
    join(root, 'node_modules', '@bertui', 'dev', 'src', 'error-overlay.js'),
    join(root, 'node_modules', '@bertui', 'dev', 'dist', 'error-overlay.js'),
    // symlinked monorepo: node_modules/@bertui/dev is a symlink to packages/dev
    join(root, 'node_modules', '@bertui', 'dev', '..', '..', 'packages', 'dev', 'src', 'error-overlay.js'),
    // running directly from monorepo source (bun run dev inside packages/cli)
    join(import.meta.dir, '..', '..', 'dev', 'src', 'error-overlay.js'),
    // built monorepo: packages/cli/dist -> packages/dev/src
    join(import.meta.dir, '..', '..', '..', 'dev', 'src', 'error-overlay.js'),
  ]
  const overlayFile = overlayPaths.find(p => existsSync(p)) ?? null

  const cssDir = join(bertuiDir, 'styles')

  function notifyClients(msg: object): void {
    for (const c of clients) { try { c.send(JSON.stringify(msg)) } catch { clients.delete(c) } }
  }

  printHeader('DEV')
  console.log('  [ 1/5 ] Compiling...')
  await compileProject(root, { env: 'development' })

  console.log('  [ 2/5 ] Building CSS...')
  await buildAllCSS(root, bertuiDir)

  console.log('  [ 3/5 ] Building import map...')
  const importMap = await buildDevImportMap(root)

  console.log('  [ 4/5 ] Setting up file watcher...')
  const stopWatcher = setupFileWatcher({
    root,
    compiledDir,
    notifyClients: msg => notifyClients(msg),
    onCSSChange: async () => { await buildAllCSS(root, bertuiDir) },
  })

  console.log('  [ 5/5 ] Starting server...')

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

  process.stdout.write(`\n  \x1b[1m\x1b[32m▶  Ready on http://localhost:${port}\x1b[0m\n\n`)
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
  console.log(`\n  Preview running at http://localhost:${port}`)
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