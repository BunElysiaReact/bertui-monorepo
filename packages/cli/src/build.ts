// packages/cli/src/build.ts
// Production build orchestrator

import { join, relative } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { compileProject } from '@bertui/compiler'
import { buildAllCSS } from '@bertui/css'
import { copyImagesSync } from '@bertui/images'
import { loadConfig, loadEnvVariables } from '@bertui/core'
import { getRenderMode, renderPageToHTML, validateAllServerIslands } from '@bertui/ssg'
import { extractMetaFromSource } from '@bertui/core'

const TOTAL_STEPS = 9

function step(n: number, label: string): void {
  process.stdout.write(`  \x1b[90m[${String(n).padStart(2,' ')}/${TOTAL_STEPS}]\x1b[0m \x1b[36m⠸\x1b[0m  ${label}\n`)
}
function done(label: string, detail = ''): void {
  process.stdout.write(`  \x1b[90m[  ]\x1b[0m \x1b[32m✓\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}\n`)
}
function fail(label: string, detail = ''): void {
  process.stdout.write(`  \x1b[90m[  ]\x1b[0m \x1b[31m✗\x1b[0m  ${label}  \x1b[31m${detail}\x1b[0m\n`)
}

export async function buildProduction(options: { root: string }): Promise<void> {
  const { root } = options
  const buildDir = join(root, '.bertuibuild')
  const outDir   = join(root, 'dist')
  const start    = Date.now()

  process.env['NODE_ENV'] = 'production'

  // Clean
  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true })
  if (existsSync(outDir))   rmSync(outDir,   { recursive: true, force: true })
  mkdirSync(buildDir, { recursive: true })
  mkdirSync(outDir,   { recursive: true })

  try {
    // 1: Config + env
    step(1, 'Loading config & env')
    const config  = await loadConfig(root)
    const envVars = loadEnvVariables(root)
    done('Loading config & env', `${Object.keys(envVars).length} env vars`)

    // 2: Compile
    step(2, 'Compiling')
    const { routes } = await compileProject(root, { env: 'production' })
    done('Compiling', `${routes.length} routes`)

    // 3: Validate server islands
    step(3, 'Validating server islands')
    const { serverIslands, validationResults } = await validateAllServerIslands(routes)
    const invalid = validationResults.filter(r => !r.valid)
    if (invalid.length > 0) {
      for (const r of invalid) {
        fail('Validation', `${r.route}: ${r.errors[0]}`)
      }
      throw new Error(`${invalid.length} server island(s) failed validation`)
    }
    done('Validating server islands', `${serverIslands.length} islands`)

    // 4: CSS
    step(4, 'Processing CSS')
    await buildAllCSS(root, outDir)
    done('Processing CSS')

    // 5: Static assets
    step(5, 'Static assets')
    const publicDir = join(root, 'public')
    if (existsSync(publicDir)) copyImagesSync(publicDir, outDir)
    done('Static assets')

    // 6: Bundle JS
    step(6, 'Bundling JS')
    const bundleResult = await bundleJS(root, buildDir, outDir, envVars)
    done('Bundling JS', `${bundleResult.sizeKB} KB`)

    // 7: Generate HTML
    step(7, 'Generating HTML')
    await generateAllHTML(root, outDir, bundleResult.bundlePath, routes, config, buildDir)
    done('Generating HTML', `${routes.length} pages`)

    // 8: Sitemap + robots
    step(8, 'Sitemap & robots')
    if (config.baseUrl && config.baseUrl !== 'http://localhost:3000') {
      await generateSitemap(routes, config.baseUrl, outDir)
      await generateRobots(config, outDir)
      done('Sitemap & robots')
    } else {
      done('Sitemap & robots', 'skipped (no baseUrl)')
    }

    // 9: Cleanup
    step(9, 'Cleanup')
    if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true })
    done('Cleanup')

    const duration = ((Date.now() - start) / 1000).toFixed(2)
    process.stdout.write(`\n  \x1b[32m\x1b[1m✓ Done  ${duration}s\x1b[0m\n`)
    process.stdout.write(`  \x1b[90mOutput\x1b[0m   dist/\n\n`)

    process.exit(0)

  } catch (err) {
    const msg = (err as Error).message
    fail('Build failed', msg)
    if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true })
    process.exit(1)
  }
}

async function bundleJS(
  root: string,
  buildDir: string,
  outDir: string,
  envVars: Record<string, string>
): Promise<{ bundlePath: string; sizeKB: string }> {
  const buildEntry = join(buildDir, 'main.js')

  if (!existsSync(buildEntry)) {
    throw new Error('main.js not found in build dir — ensure src/main.jsx exists')
  }

  const cssModulePlugin = {
    name: 'css-modules',
    setup(build: { onLoad: (filter: { filter: RegExp }, cb: () => { contents: string; loader: string }) => void }) {
      build.onLoad({ filter: /\.module\.css$/ }, () => ({
        contents: 'export default new Proxy({}, { get: (_, k) => k });',
        loader: 'js',
      }))
      build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }))
    },
  }

  const originalCwd = process.cwd()
  process.chdir(buildDir)

  try {
    const result = await Bun.build({
      entrypoints: [buildEntry],
      outdir:  join(outDir, 'assets'),
      target:  'browser',
      format:  'esm',
      plugins: [cssModulePlugin],
      minify:  { whitespace: true, syntax: true, identifiers: true },
      splitting: true,
      sourcemap: 'external',
      naming: {
        entry: 'js/[name]-[hash].js',
        chunk: 'js/chunks/[name]-[hash].js',
      },
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', '@bunnyx/api'],
      define: {
        'process.env.NODE_ENV': '"production"',
        ...Object.fromEntries(
          Object.entries(envVars).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
        ),
      },
    })

    if (!result.success) {
      const msgs = (result.logs ?? []).map((l: { message?: string; text?: string }) => l?.message ?? l?.text ?? '').join('\n')
      throw new Error(`Bundle failed\n${msgs}`)
    }

    const mainOutput = result.outputs.find(
      (o: { path: string; kind: string }) => o.path.includes('main') && o.kind === 'entry-point'
    )
    const totalSize = result.outputs.reduce((a: number, o: { size?: number }) => a + (o.size ?? 0), 0)
    const bundlePath = mainOutput ? relative(outDir, mainOutput.path).replace(/\\/g, '/') : 'assets/js/main.js'

    return { bundlePath, sizeKB: (totalSize / 1024).toFixed(1) }
  } finally {
    process.chdir(originalCwd)
  }
}

async function generateAllHTML(
  root: string,
  outDir: string,
  bundlePath: string,
  routes: Awaited<ReturnType<typeof import('@bertui/compiler').compileProject>>['routes'],
  config: Awaited<ReturnType<typeof loadConfig>>,
  buildDir: string
): Promise<void> {
  const { mkdirSync } = await import('fs')
  const importMapScript = `<script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19.0.0",
      "react-dom": "https://esm.sh/react-dom@19.0.0",
      "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
      "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
      "@bunnyx/api": "/bunnyx-api/api-client.js"
    }
  }
  </script>`

  for (const route of routes) {
    try {
      const sourceCode  = await Bun.file(route.path).text()
      const pageMeta    = extractMetaFromSource(sourceCode)
      const meta        = { ...config.meta, ...pageMeta }
      const renderMode  = await getRenderMode(route.path)

      let bodyContent   = '<div id="root"></div>'
      let includeBundle = true

      if (renderMode === 'static' || renderMode === 'server') {
        const compiledPath = join(buildDir, 'pages', route.file.replace(/\.(jsx|tsx|ts)$/, '.js'))
        if (existsSync(compiledPath)) {
          const ssrHTML = await renderPageToHTML(compiledPath, buildDir)
          if (ssrHTML) {
            bodyContent   = renderMode === 'static'
              ? ssrHTML
              : `<div id="root">${ssrHTML}</div>`
            includeBundle = renderMode === 'server'
          }
        }
      }

      const html = `<!DOCTYPE html>
<html lang="${meta.lang ?? 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title ?? 'BertUI App'}</title>
  <meta name="description" content="${meta.description ?? ''}">
  ${meta.keywords   ? `<meta name="keywords" content="${meta.keywords}">` : ''}
  ${meta.author     ? `<meta name="author" content="${meta.author}">` : ''}
  ${meta.themeColor ? `<meta name="theme-color" content="${meta.themeColor}">` : ''}
  ${meta.ogTitle    ? `<meta property="og:title" content="${meta.ogTitle}">` : ''}
  ${meta.ogImage    ? `<meta property="og:image" content="${meta.ogImage}">` : ''}
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${includeBundle ? importMapScript : ''}
</head>
<body>
  ${bodyContent}
  ${includeBundle ? `<script type="module" src="/${bundlePath}"></script>` : ''}
</body>
</html>`

      let htmlPath: string
      if (route.route === '/') {
        htmlPath = join(outDir, 'index.html')
      } else {
        const routeDir = join(outDir, route.route.replace(/^\//, ''))
        mkdirSync(routeDir, { recursive: true })
        htmlPath = join(routeDir, 'index.html')
      }

      await Bun.write(htmlPath, html)
    } catch (err) {
      process.stdout.write(`  \x1b[33m⚠\x1b[0m  HTML failed for ${route.route}: ${(err as Error).message}\n`)
    }
  }
}

async function generateSitemap(
  routes: { route: string; type: string }[],
  baseUrl: string,
  outDir: string
): Promise<void> {
  const base    = baseUrl.replace(/\/$/, '')
  const date    = new Date().toISOString().split('T')[0]!
  const staticR = routes.filter(r => r.type === 'static')

  const urls = staticR.map(r => {
    const priority = r.route === '/' ? '1.0' : r.route.split('/').filter(Boolean).length === 1 ? '0.8' : '0.6'
    return `  <url>
    <loc>${base}${r.route}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  await Bun.write(join(outDir, 'sitemap.xml'), xml)
}

async function generateRobots(
  config: { baseUrl: string; robots?: { disallow?: string[]; crawlDelay?: number | null } },
  outDir: string
): Promise<void> {
  const base = config.baseUrl.replace(/\/$/, '')
  let txt = `# BertUI Generated robots.txt\nUser-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`

  if (config.robots?.disallow?.length) {
    txt += '\n'
    for (const path of config.robots.disallow) txt += `Disallow: ${path}\n`
  }
  if (config.robots?.crawlDelay) {
    txt += `\nCrawl-delay: ${config.robots.crawlDelay}\n`
  }

  await Bun.write(join(outDir, 'robots.txt'), txt)
}
