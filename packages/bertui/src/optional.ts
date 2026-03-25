// packages/bertui/src/optional.ts
// Graceful loader for optional @bertui/* packages.
// Called by bertui.config.js handlers when user enables a feature.

export interface OptionalFeature {
  name: string        // e.g. 'forms'
  pkg: string         // e.g. '@bertui/forms'
  configKey: string   // e.g. 'forms'
}

export const OPTIONAL_FEATURES: OptionalFeature[] = [
  { name: 'Elysia fullstack', pkg: '@bertui/elysia',    configKey: 'elysia'     },
  { name: 'Forms',            pkg: '@bertui/forms',     configKey: 'forms'      },
  { name: 'Animations',       pkg: '@bertui/animations',configKey: 'animations' },
  { name: 'Icons',            pkg: '@bertui/icons',     configKey: 'icons'      },
]

/**
 * Tries to import an optional package.
 * Throws a clear, actionable error if it isn't installed.
 *
 * Usage:
 *   const forms = await loadOptional('@bertui/forms', 'forms')
 */
export async function loadOptional<T = unknown>(pkg: string, configKey: string): Promise<T> {
  try {
    return await import(pkg) as T
  } catch {
    throw new Error(
      `\n\n  [@bertui] config.${configKey} is enabled but ${pkg} is not installed.\n` +
      `  Run:  bun add ${pkg}\n` +
      `  Then restart the dev server.\n`
    )
  }
}

/**
 * Checks all enabled optional features in bertui.config.js
 * and throws clear errors for any that aren't installed.
 */
export async function validateOptionalFeatures(
  config: Record<string, unknown>
): Promise<void> {
  for (const feature of OPTIONAL_FEATURES) {
    if (!config[feature.configKey]) continue
    await loadOptional(feature.pkg, feature.configKey)
  }
}
