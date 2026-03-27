// packages/compiler/src/index.ts
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
    compiled = `import React from 'react';\n${compiled}`
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
    /import\s+(\w+)\s+from\s+['"][^'"]*\.module\.css['"];?\s*/g,
    (_, varName: string) => `const ${varName} = new Proxy({}, { get: (_, k) => k });\n`
  )
  code = code.replace(/import\s+['"][^'"]*\.css['"];?\s*/g, '')
  code = code.replace(/import\s+['"]bertui\/styles['"]\s*;?\s*/g, '')
  return code
}

export function stripDotenvImports(code: string): string {
  code = code.replace(/import\s+\w+\s+from\s+['"]dotenv['"]\s*;?\s*/g, '')
  code = code.replace(/import\s+\{[^}]+\}\s+from\s+['"]dotenv['"]\s*;?\s*/g, '')
  code = code.replace(/\w+\.config\(\s*\)\s*;?\s*/g, '')
  return code
}

export function fixRelativeImports(code: string): string {
  const importRegex = /from\s+['"](\.\.\/[^'"]+?)(?<!\.js|\.jsx|\.ts|\.tsx|\.json)['"]/g
  return code.replace(importRegex, (match, path: string) => {
    if (path.endsWith('/') || /\.\w+$/.test(path)) return match
    return `from '${path}.js'`
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
  const rel          = relative(dirname(outPath), routerPath).replace(/\\/g, '/')
  const routerImport = rel.startsWith('.') ? rel : './' + rel
  return code
    .replace(/from\s+['"]bertui\/router\.js['"]/g, `from '${routerImport}'`)
    .replace(/from\s+['"]bertui\/router['"]/g,     `from '${routerImport}'`)
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
    if (containsJSX(code) && !code.includes('import React')) code = `import React from 'react';\n${code}`
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

    const outPath = join(outDir, entry.replace(/\.(jsx|tsx|ts)$/, '.js'))
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
