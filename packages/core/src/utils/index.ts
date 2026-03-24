// packages/core/src/utils/index.ts

import { readFileSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import type { AliasMap } from '../types/index.js'

// ─── Env ─────────────────────────────────────────────────────────────────────

export function loadEnvVariables(root: string): Record<string, string> {
  const envPath = join(root, '.env')
  const envVars: Record<string, string> = {}

  if (!existsSync(envPath)) return envVars

  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      const match = line.match(/^([^=]+)=(.*)$/)
      if (!match) continue
      const key = match[1]!.trim()
      let value = match[2]!.trim()
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      envVars[key] = value
    }
  } catch {
    // silently ignore
  }

  return envVars
}

export function replaceEnvInCode(code: string, envVars: Record<string, string>): string {
  let modified = code
  for (const [key, value] of Object.entries(envVars)) {
    const regex = new RegExp(`process\\.env\\.${key}\\b`, 'g')
    modified = modified.replace(regex, JSON.stringify(value))
  }
  return modified
}

export function generateEnvCode(envVars: Record<string, string>): string {
  const exports = Object.entries(envVars)
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`)
    .join('\n')
  return `// Auto-generated — do not edit\n${exports}\n`
}

// ─── Meta extractor ──────────────────────────────────────────────────────────

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
  const meta: PageMeta = {}
  const extract = (key: string): string | undefined => {
    const m = sourceCode.match(
      new RegExp(`export\\s+const\\s+${key}\\s*=\\s*['"]([^'"]+)['"]`)
    )
    return m?.[1]
  }
  meta.title         = extract('title')
  meta.description   = extract('description')
  meta.keywords      = extract('keywords')
  meta.author        = extract('author')
  meta.themeColor    = extract('themeColor')
  meta.lang          = extract('lang')
  meta.ogTitle       = extract('ogTitle')
  meta.ogDescription = extract('ogDescription')
  meta.ogImage       = extract('ogImage')
  return meta
}

// ─── Importhow (alias system) ─────────────────────────────────────────────────

export function buildAliasMap(
  importhow: Record<string, string> = {},
  projectRoot: string,
  compiledDir: string | null = null
): AliasMap {
  const map: AliasMap = new Map()
  for (const [alias, relPath] of Object.entries(importhow)) {
    const abs = compiledDir
      ? join(compiledDir, alias)
      : join(projectRoot, relPath)
    map.set(alias, abs)
  }
  return map
}

export function rewriteAliasImports(
  code: string,
  currentFile: string,
  aliasMap: AliasMap
): string {
  if (!aliasMap || aliasMap.size === 0) return code

  const currentDir = dirname(currentFile)
  const importRe = /(?:import|export)(?:\s+[\w*{},\s]+\s+from)?\s+['"]([^'"]+)['"]/g

  return code.replace(importRe, (match, specifier: string) => {
    const slashIdx = specifier.indexOf('/')
    const alias = slashIdx === -1 ? specifier : specifier.slice(0, slashIdx)
    const rest  = slashIdx === -1 ? ''        : specifier.slice(slashIdx)

    const absBase = aliasMap.get(alias)
    if (!absBase) return match

    let rel = relative(currentDir, absBase + rest).replace(/\\/g, '/')
    if (!rel.startsWith('.')) rel = './' + rel
    if (rest && !/\.\w+$/.test(rest)) rel += '.js'

    return match
      .replace(`'${specifier}'`, `'${rel}'`)
      .replace(`"${specifier}"`, `"${rel}"`)
  })
}

export function getAliasDirs(aliasMap: AliasMap): Set<string> {
  return new Set(aliasMap.values())
}

// ─── General helpers ─────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB'] as const
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i!)).toFixed(2))} ${sizes[i!]}`
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }
  return String(text).replace(/[&<>"']/g, m => map[m] ?? m)
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase())
    .replace(/[[\]]/g, '')
}
