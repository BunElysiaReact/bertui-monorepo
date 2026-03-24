// packages/css/src/index.ts
// @bertui/css — CSS processing with LightningCSS

import { transform } from 'lightningcss'
import { join } from 'path'
import { existsSync, readdirSync, mkdirSync } from 'fs' with { type: 'json' }
import type { CSSProcessOptions } from '@bertui/core'

const DEFAULT_TARGETS = {
  chrome:  90 << 16,
  firefox: 88 << 16,
  safari:  14 << 16,
  edge:    90 << 16,
}

// ─── Minify ───────────────────────────────────────────────────────────────────

export async function minifyCSS(css: string, options: CSSProcessOptions = {}): Promise<string> {
  const { filename = 'style.css', minify = true, sourceMap = false } = options
  if (!css.trim()) return '/* No CSS */'

  try {
    const { code } = transform({
      filename,
      code: Buffer.from(css),
      minify,
      sourceMap,
      targets: DEFAULT_TARGETS,
      drafts: { nesting: true },
    })
    return code.toString()
  } catch {
    return fallbackMinify(css)
  }
}

export function minifyCSSSync(css: string, options: CSSProcessOptions = {}): string {
  const { filename = 'style.css', minify = true, sourceMap = false } = options
  if (!css.trim()) return '/* No CSS */'

  try {
    const { code } = transform({
      filename,
      code: Buffer.from(css),
      minify,
      sourceMap,
      targets: DEFAULT_TARGETS,
      drafts: { nesting: true },
    })
    return code.toString()
  } catch {
    return fallbackMinify(css)
  }
}

function fallbackMinify(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()
}

// ─── Combine ──────────────────────────────────────────────────────────────────

export function combineCSS(files: Array<{ filename: string; content: string }>): string {
  return files.map(({ filename, content }) => `/* ${filename} */\n${content}`).join('\n\n')
}

// ─── CSS module scoping ───────────────────────────────────────────────────────

function hashClassName(filename: string, className: string): string {
  const str = filename + className
  let hash  = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36).slice(0, 5)
}

export function scopeCSSModule(
  cssText: string,
  filename: string
): { mapping: Record<string, string>; scopedCSS: string } {
  const classNames = new Set<string>()
  const classRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*[{,\s:]/g
  let match: RegExpExecArray | null

  while ((match = classRegex.exec(cssText)) !== null) {
    classNames.add(match[1]!)
  }

  const mapping: Record<string, string> = {}
  for (const cls of classNames) {
    mapping[cls] = `${cls}_${hashClassName(filename, cls)}`
  }

  let scopedCSS = cssText
  for (const [original, scoped] of Object.entries(mapping)) {
    scopedCSS = scopedCSS.replace(
      new RegExp(`\\.${original}(?=[\\s{,:\\[#.>+~)\\]])`, 'g'),
      `.${scoped}`
    )
  }

  return { mapping, scopedCSS }
}

// ─── Build all CSS for a project ─────────────────────────────────────────────

export async function buildAllCSS(root: string, outDir: string): Promise<void> {
  const srcStylesDir = join(root, 'src', 'styles')
  const stylesOutDir = join(outDir, 'styles')

  mkdirSync(stylesOutDir, { recursive: true })

  let combined = ''

  if (existsSync(srcStylesDir)) {
    const cssFiles = readdirSync(srcStylesDir).filter(
      f => f.endsWith('.css') && !f.endsWith('.module.css')
    )
    for (const file of cssFiles) {
      const content = await Bun.file(join(srcStylesDir, file)).text()
      combined += `/* ${file} */\n${content}\n\n`
    }
  }

  const minified = combined.trim()
    ? await minifyCSS(combined, { filename: 'bertui.min.css' })
    : '/* No CSS */'

  await Bun.write(join(stylesOutDir, 'bertui.min.css'), minified)
}

// ─── SCSS (optional) ─────────────────────────────────────────────────────────

export async function processSCSS(scssCode: string, options: CSSProcessOptions = {}): Promise<string> {
  const sass = await import('sass').catch(() => {
    throw new Error('sass not installed. Run: bun add sass')
  })
  const result = sass.compileString(scssCode, {
    style: 'expanded',
    sourceMap: false,
    loadPaths: options.loadPaths ?? [],
  })
  return result.css
}
