// packages/core/src/optional.ts
import type { BertuiConfig } from './types/index.js'

export interface OptionalFeature {
  name: string
  pkg: string
  configKey: string
}

export const OPTIONAL_FEATURES: OptionalFeature[] = [
  { name: 'SSG / Static Site Generation', pkg: '@bertui/ssg', configKey: 'ssg' },
  { name: 'Elysia Fullstack', pkg: '@bertui/elysia', configKey: 'elysia' },
  { name: 'Animations', pkg: '@bertui/animations', configKey: 'animations' },
]

export async function validateOptionalFeatures(config: BertuiConfig): Promise<void> {
  const missing: Array<{ name: string; pkg: string; configKey: string }> = []

  for (const feature of OPTIONAL_FEATURES) {
    if (!config[feature.configKey as keyof BertuiConfig]) continue
    
    try {
      await import(feature.pkg)
    } catch {
      missing.push({ name: feature.name, pkg: feature.pkg, configKey: feature.configKey })
    }
  }

  if (missing.length) {
    const installCmd = missing.map(m => m.pkg).join(' ')
    console.error(`
╔══════════════════════════════════════════════════╗
║  [@bertui] Missing optional packages            ║
╚══════════════════════════════════════════════════╝

${missing.map(m => `  • ${m.name} (config.${m.configKey} = true)\n    → bun add ${m.pkg}`).join('\n\n')}

  Install them all at once:

      bun add ${installCmd}
`)
    process.exit(1)
  }
}