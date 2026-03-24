// packages/ssg/src/index.ts
// @bertui/ssg — server islands, static HTML extraction, SSR renderer

import { join } from 'path'
import { existsSync } from 'fs'
import type { Route, ServerIsland, ValidationResult, RenderMode } from '@bertui/core'

// ─── Render mode detection ────────────────────────────────────────────────────

export async function getRenderMode(sourcePath: string): Promise<RenderMode> {
  try {
    const src = await Bun.file(sourcePath).text()
    if (/export\s+const\s+render\s*=\s*["']server["']/.test(src)) return 'server'
    if (/export\s+const\s+render\s*=\s*["']static["']/.test(src)) return 'static'
  } catch { /* ignore */ }
  return 'client'
}

// ─── Validator ────────────────────────────────────────────────────────────────

const BANNED_HOOKS = [
  'useState', 'useEffect', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useContext', 'useLayoutEffect', 'useId', 'useImperativeHandle',
  'useDebugValue', 'useDeferredValue', 'useTransition', 'useSyncExternalStore',
]

const BANNED_EVENTS = [
  'onClick', 'onChange', 'onSubmit', 'onInput', 'onFocus',
  'onBlur', 'onMouseEnter', 'onMouseLeave', 'onKeyDown', 'onKeyUp',
]

export function validateServerIsland(sourceCode: string, _filePath: string): ValidationResult {
  const errors: string[] = []

  for (const hook of BANNED_HOOKS) {
    if (new RegExp(`\\b${hook}\\s*\\(`).test(sourceCode)) {
      errors.push(`Cannot use React hook "${hook}" in a static/server page`)
    }
  }
  for (const event of BANNED_EVENTS) {
    if (sourceCode.includes(`${event}=`)) {
      errors.push(`Cannot use event handler "${event}" in a static/server page`)
    }
  }
  if (/window\.|document\.|localStorage\.|sessionStorage\./.test(sourceCode)) {
    errors.push('Cannot access browser APIs (window/document/localStorage) in a static/server page')
  }

  return { valid: errors.length === 0, errors }
}

export function isServerIsland(sourceCode: string): boolean {
  return /export\s+const\s+render\s*=\s*["'](server|static)["']/.test(sourceCode)
}

// ─── Static HTML extractor ────────────────────────────────────────────────────

export function extractStaticHTML(sourceCode: string, filePath = 'unknown'): string | null {
  try {
    const returnMatch = sourceCode.match(/return\s*\(/s)
    if (!returnMatch) return null

    const codeBeforeReturn = sourceCode.substring(0, returnMatch.index)

    // Hooks check
    for (const hook of BANNED_HOOKS) {
      if (new RegExp(`\\b${hook}\\s*\\(`).test(codeBeforeReturn)) return null
    }

    const fullReturnMatch = sourceCode.match(/return\s*\(([\s\S]*?)\);?\s*\}/s)
    if (!fullReturnMatch?.[1]) return null

    let html = fullReturnMatch[1].trim()
    html = html.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    html = html.replace(/className=/g, 'class=')
    html = convertStyleObjects(html)
    html = fixVoidElements(html)
    html = removeJSExpressions(html)
    html = html.replace(/\s+/g, ' ').trim()

    return html
  } catch {
    return null
  }
}

function convertStyleObjects(html: string): string {
  return html.replace(/style=\{\{([^}]+)\}\}/g, (_match, styleObj: string) => {
    try {
      const cssString = styleObj
        .split(',')
        .map(prop => {
          const colonIdx = prop.indexOf(':')
          if (colonIdx === -1) return ''
          const key   = prop.substring(0, colonIdx).trim()
          const value = prop.substring(colonIdx + 1).trim()
          if (!key || !value) return ''
          const cssKey   = key.replace(/([A-Z])/g, '-$1').toLowerCase()
          const cssValue = value.replace(/['"]/g, '')
          return `${cssKey}: ${cssValue}`
        })
        .filter(Boolean)
        .join('; ')
      return `style="${cssString}"`
    } catch {
      return 'style=""'
    }
  })
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

function fixVoidElements(html: string): string {
  return html.replace(/<(\w+)([^>]*)\s*\/>/g, (_match, tag: string, attrs: string) => {
    return VOID_ELEMENTS.has(tag.toLowerCase())
      ? `<${tag}${attrs}/>`
      : `<${tag}${attrs}></${tag}>`
  })
}

function removeJSExpressions(html: string): string {
  return html
    .replace(/\{`([^`]*)`\}/g, '$1')
    .replace(/\{(['"])(.*?)\1\}/g, '$2')
    .replace(/\{(\d+)\}/g, '$1')
    .replace(/\{[^}]+\}/g, '')
}

// ─── SSR renderer ────────────────────────────────────────────────────────────

export async function renderPageToHTML(
  compiledPagePath: string,
  _buildDir: string
): Promise<string | null> {
  try {
    const projectRoot        = compiledPagePath.split('.bertuibuild')[0]!
    const reactPath          = join(projectRoot, 'node_modules', 'react', 'index.js')
    const reactDomServerPath = join(projectRoot, 'node_modules', 'react-dom', 'server.js')

    if (!existsSync(reactPath) || !existsSync(reactDomServerPath)) return null

    const React            = await import(reactPath)
    const { renderToString } = await import(reactDomServerPath)
    const mod              = await import(`${compiledPagePath}?t=${Date.now()}`)
    const Component        = mod.default

    if (typeof Component !== 'function') return null
    return renderToString(React.createElement(Component))
  } catch {
    return null
  }
}

// ─── Batch validation ────────────────────────────────────────────────────────

export async function validateAllServerIslands(routes: Route[]): Promise<{
  serverIslands: Route[]
  validationResults: Array<ValidationResult & { route: string; path: string }>
}> {
  const serverIslands: Route[] = []
  const validationResults: Array<ValidationResult & { route: string; path: string }> = []

  for (const route of routes) {
    try {
      const src = await Bun.file(route.path).text()
      if (!isServerIsland(src)) continue
      const result = validateServerIsland(src, route.path)
      serverIslands.push(route)
      validationResults.push({ ...result, route: route.route, path: route.path })
    } catch { /* ignore */ }
  }

  return { serverIslands, validationResults }
}
