// packages/core/src/types/index.ts
// Hand-written types — the source of truth for the entire BertUI monorepo

// ─── Config ──────────────────────────────────────────────────────────────────

export interface BertuiConfig {
  siteName: string
  baseUrl: string
  port?: number
  importhow: Record<string, string>
  meta: MetaConfig
  appShell: AppShellConfig
  robots: RobotsConfig
  elysia?:     boolean
  forms?:      boolean
  animations?: boolean
  icons?:      boolean
}

export interface MetaConfig {
  title: string
  description: string
  keywords?: string
  author?: string
  themeColor?: string
  lang: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

export interface AppShellConfig {
  loading: boolean
  loadingText: string
  backgroundColor: string
}

export interface RobotsConfig {
  disallow: string[]
  crawlDelay: number | null
}

// ─── Routing ─────────────────────────────────────────────────────────────────

export type RouteType = 'static' | 'dynamic'
export type RenderMode = 'static' | 'server' | 'client'

export interface Route {
  /** URL path e.g. /blog/:slug */
  route: string
  /** Relative file path from pages/ e.g. blog/[slug].tsx */
  file: string
  /** Absolute path on disk */
  path: string
  type: RouteType
  renderMode?: RenderMode
}

export interface AnalyzedRoute extends Route {
  interactive: boolean
  isServerIsland: boolean
  features: HydrationFeature[]
  hydrationMode: 'none' | 'full'
}

export interface HydrationFeature {
  type: 'hook' | 'event' | 'api'
  name: string
}

// ─── Build ───────────────────────────────────────────────────────────────────

export interface BuildOptions {
  root: string
  outDir?: string
  buildDir?: string
  sourcemap?: boolean
  minify?: boolean | MinifyOptions
}

export interface MinifyOptions {
  whitespace: boolean
  syntax: boolean
  identifiers: boolean
}

export interface BuildResult {
  success: boolean
  routes: Route[]
  jsSize: string
  cssSize?: string
  duration: number
  errors: BuildError[]
  warnings: BuildWarning[]
}

export interface BuildError {
  message: string
  file?: string
  line?: number
  column?: number
}

export interface BuildWarning extends BuildError {}

// ─── Compiler ────────────────────────────────────────────────────────────────

export interface CompileOptions {
  root: string
  loader?: 'jsx' | 'tsx' | 'ts' | 'js'
  env?: 'development' | 'production'
  addReactImport?: boolean
  envVars?: Record<string, string>
  importhow?: Record<string, string>
}

export interface CompileResult {
  outDir: string
  routes: Route[]
  stats: CompileStats
}

export interface CompileStats {
  files: number
  skipped: number
  duration: number
}

export type AliasMap = Map<string, string>

// ─── Server Islands ──────────────────────────────────────────────────────────

export interface ServerIsland {
  route: string
  path: string
  renderMode: 'static' | 'server'
  html: string | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ─── Dev Server ──────────────────────────────────────────────────────────────

export interface DevServerOptions {
  root: string
  port: number
  middleware?: MiddlewareModule | null
  layouts?: LayoutMap
  loadingComponents?: LoadingComponentMap
}

export interface HMRMessage {
  type:
    | 'reload'
    | 'recompiling'
    | 'compiled'
    | 'compilation-error'
    | 'importmap-updated'
  message?: string
  stack?: string
  file?: string
  line?: number
  column?: number
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export interface MiddlewareModule {
  onRequest?: (ctx: MiddlewareContext) => Promise<void> | void
  onResponse?: (ctx: MiddlewareContext) => Promise<void> | void
  onError?: (ctx: MiddlewareContext, error: Error) => Promise<void> | void
  default?: (ctx: MiddlewareContext) => Promise<void> | void
}

export interface MiddlewareContext {
  request: Request
  url: URL
  pathname: string
  method: string
  headers: Record<string, string>
  params: Record<string, string>
  route: string | null
  locals: Record<string, unknown>
  respond(body: string, init?: ResponseInit): void
  redirect(url: string, status?: number): void
  setHeader(key: string, value: string): void
  readonly stopped: boolean
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

export interface Layout {
  name: string
  path: string
  route: string
}

export type LayoutMap = Record<string, Layout>

// ─── Loading ─────────────────────────────────────────────────────────────────

export interface LoadingComponent {
  path: string
  route: string
  compiledPath?: string
  compiledName?: string
}

export type LoadingComponentMap = Record<string, LoadingComponent>

// ─── Images ──────────────────────────────────────────────────────────────────

export interface ImageOptimizeResult {
  data: ArrayBuffer
  original_size: number
  optimized_size: number
  format: string
  savings_percent: number
}

export interface ImageFile {
  path: string
  relativePath: string
  filename: string
  size: number
  ext: string
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

export interface CSSProcessOptions {
  filename?: string
  minify?: boolean
  sourceMap?: boolean
  loadPaths?: string[]
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export interface LoggerSummary {
  routes?: number | string
  serverIslands?: number | string
  interactive?: number | string
  staticRoutes?: number | string
  jsSize?: string
  cssSize?: string
  outDir?: string
  duration?: string
}

// ─── Elysia plugin ───────────────────────────────────────────────────────────

export interface BertuiElysiaOptions {
  root?: string
  port?: number
  serveStatic?: boolean
}
