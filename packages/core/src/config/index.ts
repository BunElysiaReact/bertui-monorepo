// packages/core/src/config/index.ts

import type { BertuiConfig } from '../types/index.js'

export const defaultConfig: BertuiConfig = {
  siteName: 'BertUI App',
  baseUrl: 'http://localhost:3000',
  port: 3000,
  importhow: {},
  meta: {
    title: 'BertUI — Lightning Fast React',
    description: 'Build lightning-fast React applications with file-based routing powered by Bun',
    keywords: 'react, bun, bertui, fast, file-based routing',
    author: 'Pease Ernest',
    themeColor: '#667eea',
    lang: 'en',
    ogTitle: 'BertUI — Lightning Fast React Framework',
    ogDescription: 'Build lightning-fast React apps with zero config',
    ogImage: '/og-image.png',
  },
  appShell: {
    loading: true,
    loadingText: 'Loading...',
    backgroundColor: '#ffffff',
  },
  robots: {
    disallow: [],
    crawlDelay: null,
  },
}

function mergeConfig(defaults: BertuiConfig, user: Partial<BertuiConfig>): BertuiConfig {
  return {
    ...defaults,
    ...user,
    meta:     { ...defaults.meta,     ...(user.meta     ?? {}) },
    appShell: { ...defaults.appShell, ...(user.appShell ?? {}) },
    robots:   { ...defaults.robots,   ...(user.robots   ?? {}) },
    importhow:{ ...defaults.importhow,...(user.importhow ?? {}) },
  }
}

export async function loadConfig(root: string): Promise<BertuiConfig> {
  const { join }      = await import('path')
  const { existsSync } = await import('fs')

  const configPath = join(root, 'bertui.config.js')
  if (!existsSync(configPath)) return defaultConfig

  try {
    const source = await Bun.file(configPath).text()

    const transpiler = new Bun.Transpiler({ loader: 'js', target: 'bun' })
    let code = await transpiler.transform(source)
    code = code.replace(/export\s+default\s+/, 'globalThis.__bertuiConfig = ')

    const fn = new Function('globalThis', code)
    fn(globalThis)

    const userConfig = (globalThis as Record<string, unknown>).__bertuiConfig as Partial<BertuiConfig> | undefined
    delete (globalThis as Record<string, unknown>).__bertuiConfig

    if (!userConfig) return defaultConfig
    return mergeConfig(defaultConfig, userConfig)
  } catch (err) {
    console.warn(`[bertui] Failed to load bertui.config.js: ${(err as Error).message}`)
    return defaultConfig
  }
}
