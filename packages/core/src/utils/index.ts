// packages/core/src/utils/index.ts

import { readFileSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import type { AliasMap } from '../types/index.js'

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      envVars[key] = value
    }
  } catch { }
  return envVars
}

export function replaceEnvInCode(code: string, envVars: Record<string, string>): string {
  let modified = code
  for (const [key, value] of Object.entries(envVars)) {
    modified = modified.replace(new RegExp(`process\\.env\\.${key}\\b`, 'g'), JSON.stringify(value))
  }
  return modified
}

export function generateEnvCode(envVars: Record<string, string>): string {
  return `// Auto-generated — do not edit\n${Object.entries(envVars).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join('\n')}\n`
}

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
  const extract = (key: string): string | undefined =>
    sourceCode.match(new RegExp(`export\\s+const\\s+${key}\\s*=\\s*['"]([^'"]+)['"]`)) ?.[1]

  const meta: PageMeta = {}
  const title         = extract('title');         if (title         !== undefined) meta.title         = title
  const description   = extract('description');   if (description   !== undefined) meta.description   = description
  const keywords      = extract('keywords');      if (keywords      !== undefined) meta.keywords      = keywords
  const author        = extract('author');        if (author        !== undefined) meta.author        = author
  const themeColor    = extract('themeColor');    if (themeColor    !== undefined) meta.themeColor    = themeColor
  const lang          = extract('lang');          if (lang          !== undefined) meta.lang          = lang
  const ogTitle       = extract('ogTitle');       if (ogTitle       !== undefined) meta.ogTitle       = ogTitle
  const ogDescription = extract('ogDescription'); if (ogDescription !== undefined) meta.ogDescription = ogDescription
  const ogImage       = extract('ogImage');       if (ogImage       !== undefined) meta.ogImage       = ogImage
  return meta
}

export function buildAliasMap(
  importhow: Record<string, string> = {},
  projectRoot: string,
  compiledDir: string | null = null
): AliasMap {
  const map: AliasMap = new Map()
  for (const [alias, relPath] of Object.entries(importhow)) {
    const safeName = alias.replace(/^@/, '')
    const abs = compiledDir ? join(compiledDir, safeName) : join(projectRoot, relPath)
    map.set(alias, abs)
  }
  return map
}

export function rewriteAliasImports(code: string, currentFile: string, aliasMap: AliasMap): string {
  if (!aliasMap || aliasMap.size === 0) return code
  const currentDir = dirname(currentFile)
  const importRe = /(?:import|export)(?:\s+[\w*{},\s]+\s+from)?\s+['"]([^'"]+)['"]/g
  return code.replace(importRe, (match, specifier: string) => {
    const slashIdx = specifier.indexOf('/')
    const alias = slashIdx === -1 ? specifier : specifier.slice(0, slashIdx)
    const rest  = slashIdx === -1 ? '' : specifier.slice(slashIdx)
    const absBase = aliasMap.get(alias)
    if (!absBase) return match
    let rel = relative(currentDir, absBase + rest).replace(/\\/g, '/')
    if (!rel.startsWith('.')) rel = './' + rel
    if (rest && !/\.\w+$/.test(rest)) rel += '.js'
    return match.replace(`'${specifier}'`, `'${rel}'`).replace(`"${specifier}"`, `"${rel}"`)
  })
}

export function getAliasDirs(aliasMap: AliasMap): Set<string> { return new Set(aliasMap.values()) }

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB'] as const
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i!)).toFixed(2))} ${sizes[i!]}`
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return String(text).replace(/[&<>"']/g, m => map[m] ?? m)
}

export function toPascalCase(str: string): string {
  return str.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, (c: string) => c.toUpperCase()).replace(/[\[\]]/g, '')
}
