// packages/bertui/src/index.ts
// Main entry point for `bun add bertui`
// Re-exports everything a user needs from the core packages.
// Optional packages (@bertui/elysia, @bertui/forms etc) are NOT exported here —
// users install and import them separately.

// Core types + config + utils
export * from '@bertui/core'

// Compiler
export { transform, compileFile, compileProject } from '@bertui/compiler'

// SSG / server islands
export {
  getRenderMode,
  validateServerIsland,
  isServerIsland,
  renderPageToHTML,
  validateAllServerIslands,
} from '@bertui/ssg'

// CSS
export { minifyCSS, minifyCSSSync, buildAllCSS, scopeCSSModule } from '@bertui/css'

// Images
export { copyImagesSync, getImageFiles, isImageFile, optimizeImage } from '@bertui/images'

// Dev
export { buildDevImportMap, setupFileWatcher } from '@bertui/dev'

// Version
export const VERSION = '2.0.0'
