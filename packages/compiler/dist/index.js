// @bun
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;
// ../core/src/config/index.ts
function mergeConfig(defaults, user) {
  return {
    ...defaults,
    ...user,
    meta: { ...defaults.meta, ...user.meta ?? {} },
    appShell: { ...defaults.appShell, ...user.appShell ?? {} },
    robots: { ...defaults.robots, ...user.robots ?? {} },
    importhow: { ...defaults.importhow, ...user.importhow ?? {} }
  };
}
async function loadConfig(root) {
  const { join } = await import("path");
  const { existsSync } = await import("fs");
  const configPath = join(root, "bertui.config.js");
  if (!existsSync(configPath))
    return defaultConfig;
  try {
    const source = await Bun.file(configPath).text();
    const transpiler = new Bun.Transpiler({ loader: "js", target: "bun" });
    let code = await transpiler.transform(source);
    code = code.replace(/export\s+default\s+/, "globalThis.__bertuiConfig = ");
    const fn = new Function("globalThis", code);
    fn(globalThis);
    const userConfig = globalThis.__bertuiConfig;
    delete globalThis.__bertuiConfig;
    if (!userConfig)
      return defaultConfig;
    return mergeConfig(defaultConfig, userConfig);
  } catch (err) {
    console.warn(`[bertui] Failed to load bertui.config.js: ${err.message}`);
    return defaultConfig;
  }
}
var defaultConfig;
var init_config = __esm(() => {
  defaultConfig = {
    siteName: "BertUI App",
    baseUrl: "http://localhost:3000",
    port: 3000,
    importhow: {},
    meta: {
      title: "BertUI \u2014 Lightning Fast React",
      description: "Build lightning-fast React applications with file-based routing powered by Bun",
      keywords: "react, bun, bertui, fast, file-based routing",
      author: "Pease Ernest",
      themeColor: "#667eea",
      lang: "en",
      ogTitle: "BertUI \u2014 Lightning Fast React Framework",
      ogDescription: "Build lightning-fast React apps with zero config",
      ogImage: "/og-image.png"
    },
    appShell: {
      loading: true,
      loadingText: "Loading...",
      backgroundColor: "#ffffff"
    },
    robots: {
      disallow: [],
      crawlDelay: null
    }
  };
});

// ../core/src/utils/index.ts
import { readFileSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
function loadEnvVariables(root) {
  const envPath = join(root, ".env");
  const envVars = {};
  if (!existsSync(envPath))
    return envVars;
  try {
    const lines = readFileSync(envPath, "utf-8").split(`
`);
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith("#"))
        continue;
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match)
        continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  } catch {}
  return envVars;
}
function replaceEnvInCode(code, envVars) {
  let modified = code;
  for (const [key, value] of Object.entries(envVars)) {
    const regex = new RegExp(`process\\.env\\.${key}\\b`, "g");
    modified = modified.replace(regex, JSON.stringify(value));
  }
  return modified;
}
function generateEnvCode(envVars) {
  const exports = Object.entries(envVars).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join(`
`);
  return `// Auto-generated \u2014 do not edit
${exports}
`;
}
function extractMetaFromSource(sourceCode) {
  const meta = {};
  const extract = (key) => {
    const m = sourceCode.match(new RegExp(`export\\s+const\\s+${key}\\s*=\\s*['"]([^'"]+)['"]`));
    return m?.[1];
  };
  meta.title = extract("title");
  meta.description = extract("description");
  meta.keywords = extract("keywords");
  meta.author = extract("author");
  meta.themeColor = extract("themeColor");
  meta.lang = extract("lang");
  meta.ogTitle = extract("ogTitle");
  meta.ogDescription = extract("ogDescription");
  meta.ogImage = extract("ogImage");
  return meta;
}
function buildAliasMap(importhow = {}, projectRoot, compiledDir = null) {
  const map = new Map;
  for (const [alias, relPath] of Object.entries(importhow)) {
    const abs = compiledDir ? join(compiledDir, alias) : join(projectRoot, relPath);
    map.set(alias, abs);
  }
  return map;
}
function rewriteAliasImports(code, currentFile, aliasMap) {
  if (!aliasMap || aliasMap.size === 0)
    return code;
  const currentDir = dirname(currentFile);
  const importRe = /(?:import|export)(?:\s+[\w*{},\s]+\s+from)?\s+['"]([^'"]+)['"]/g;
  return code.replace(importRe, (match, specifier) => {
    const slashIdx = specifier.indexOf("/");
    const alias = slashIdx === -1 ? specifier : specifier.slice(0, slashIdx);
    const rest = slashIdx === -1 ? "" : specifier.slice(slashIdx);
    const absBase = aliasMap.get(alias);
    if (!absBase)
      return match;
    let rel = relative(currentDir, absBase + rest).replace(/\\/g, "/");
    if (!rel.startsWith("."))
      rel = "./" + rel;
    if (rest && !/\.\w+$/.test(rest))
      rel += ".js";
    return match.replace(`'${specifier}'`, `'${rel}'`).replace(`"${specifier}"`, `"${rel}"`);
  });
}
function getAliasDirs(aliasMap) {
  return new Set(aliasMap.values());
}
function formatBytes(bytes) {
  if (bytes === 0)
    return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m] ?? m);
}
function toPascalCase(str) {
  return str.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (c) => c.toUpperCase()).replace(/[[\]]/g, "");
}
var init_utils = () => {};

// ../core/src/cache/index.ts
import { createHash } from "crypto";

class BertuiCache {
  maxSize;
  defaultTTL;
  store = new Map;
  fileCache = new Map;
  fileTimestamps = new Map;
  cssCache = new Map;
  cleanupInterval;
  stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  constructor(options = {}) {
    this.maxSize = options.maxSize ?? 5000;
    this.defaultTTL = options.ttl ?? 30000;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  get(key, options = {}) {
    const item = this.store.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }
    const ttl = options.ttl ?? item.ttl;
    if (Date.now() - item.timestamp > ttl) {
      this.store.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }
    this.stats.hits++;
    item.lastAccessed = Date.now();
    return item.value;
  }
  set(key, value, options = {}) {
    this.store.set(key, {
      value,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      ttl: options.ttl ?? this.defaultTTL,
      size: this.getSize(value)
    });
    this.stats.sets++;
    if (this.store.size > this.maxSize)
      this.evictLRU();
  }
  async getFile(filePath) {
    const cacheKey = `file:${filePath}`;
    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists)
        return null;
      const stats = await file.stat();
      const mtime = stats.mtimeMs;
      const cached = this.fileCache.get(cacheKey);
      const cachedT = this.fileTimestamps.get(cacheKey);
      if (cached && cachedT === mtime)
        return cached;
      const buf = Buffer.from(await file.arrayBuffer());
      this.fileCache.set(cacheKey, buf);
      this.fileTimestamps.set(cacheKey, mtime);
      return buf;
    } catch {
      return null;
    }
  }
  getCSS(css) {
    const hash = createHash("md5").update(css).digest("hex");
    return this.cssCache.get(hash) ?? null;
  }
  setCSS(css, result) {
    const hash = createHash("md5").update(css).digest("hex");
    this.cssCache.set(hash, result);
  }
  getSize(value) {
    if (typeof value === "string")
      return value.length;
    if (Buffer.isBuffer(value))
      return value.length;
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
  evictLRU() {
    const entries = [...this.store.entries()].sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    const removeCount = Math.floor(this.maxSize * 0.2);
    for (let i = 0;i < removeCount && i < entries.length; i++) {
      this.store.delete(entries[i][0]);
      this.stats.evictions++;
    }
  }
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.store.delete(key);
        this.stats.evictions++;
      }
    }
  }
  dispose() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
    this.fileCache.clear();
    this.fileTimestamps.clear();
    this.cssCache.clear();
  }
}
var globalCache;
var init_cache = __esm(() => {
  globalCache = new BertuiCache;
});

// ../core/src/index.ts
var exports_src = {};
__export(exports_src, {
  toPascalCase: () => toPascalCase,
  rewriteAliasImports: () => rewriteAliasImports,
  replaceEnvInCode: () => replaceEnvInCode,
  loadEnvVariables: () => loadEnvVariables,
  loadConfig: () => loadConfig,
  globalCache: () => globalCache,
  getAliasDirs: () => getAliasDirs,
  generateEnvCode: () => generateEnvCode,
  formatBytes: () => formatBytes,
  extractMetaFromSource: () => extractMetaFromSource,
  escapeHtml: () => escapeHtml,
  defaultConfig: () => defaultConfig,
  buildAliasMap: () => buildAliasMap,
  VERSION: () => VERSION,
  BertuiCache: () => BertuiCache
});
var VERSION = "2.0.0";
var init_src = __esm(() => {
  init_config();
  init_utils();
  init_cache();
});

// src/router.ts
var exports_router = {};
__export(exports_router, {
  generateRouterCode: () => generateRouterCode,
  generateRouter: () => generateRouter,
  discoverRoutes: () => discoverRoutes
});
import { join as join2, extname } from "path";
import { readdirSync } from "fs";
async function discoverRoutes(pagesDir) {
  const routes = [];
  function scan(dir, basePath = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join2(dir, entry.name);
      const relativePath = join2(basePath, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath, relativePath);
        continue;
      }
      const ext = extname(entry.name);
      if (ext === ".css")
        continue;
      if (![".jsx", ".tsx", ".ts", ".js"].includes(ext))
        continue;
      const fileName = entry.name.replace(ext, "");
      if (fileName === "loading")
        continue;
      let route = "/" + relativePath.replace(/\\/g, "/").replace(ext, "");
      if (fileName === "index")
        route = route.replace("/index", "") || "/";
      routes.push({
        route: route === "" ? "/" : route,
        file: relativePath.replace(/\\/g, "/"),
        path: fullPath,
        type: fileName.includes("[") && fileName.includes("]") ? "dynamic" : "static"
      });
    }
  }
  scan(pagesDir);
  routes.sort((a, b) => a.type === b.type ? a.route.localeCompare(b.route) : a.type === "static" ? -1 : 1);
  return routes;
}
function generateRouterCode(routes) {
  const imports = routes.map((r, i) => `import Page${i} from './pages/${r.file.replace(/\.(jsx|tsx|ts)$/, ".js")}';`).join(`
`);
  const routeConfigs = routes.map((r, i) => `  { path: '${r.route}', component: Page${i}, type: '${r.type}' }`).join(`,
`);
  return `import React, { useState, useEffect, createContext, useContext } from 'react';

const RouterContext = createContext(null);

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (typeof window === 'undefined') return { pathname: '/', params: {}, navigate: () => {}, isSSR: true };
  if (!ctx) throw new Error('useRouter must be used within a Router');
  return ctx;
}

export function Router({ routes }) {
  const [currentRoute, setCurrentRoute] = useState(null);
  const [params, setParams] = useState({});

  useEffect(() => {
    matchAndSetRoute(window.location.pathname);
    const handler = () => matchAndSetRoute(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [routes]);

  function matchAndSetRoute(pathname) {
    for (const route of routes) {
      if (route.type === 'static' && route.path === pathname) {
        setCurrentRoute(route); setParams({}); return;
      }
    }
    for (const route of routes) {
      if (route.type === 'dynamic') {
        const pattern = route.path.replace(/\\[([^\\]]+)\\]/g, '([^/]+)');
        const match = pathname.match(new RegExp('^' + pattern + '$'));
        if (match) {
          const names = [...route.path.matchAll(/\\[([^\\]]+)\\]/g)].map(m => m[1]);
          const p = {}; names.forEach((n, i) => { p[n] = match[i + 1]; });
          setCurrentRoute(route); setParams(p); return;
        }
      }
    }
    setCurrentRoute(null); setParams({});
  }

  function navigate(path) {
    window.history.pushState({}, '', path);
    matchAndSetRoute(path);
  }

  const Component = currentRoute?.component;
  return React.createElement(
    RouterContext.Provider,
    { value: { currentRoute, params, navigate, pathname: window.location.pathname } },
    Component ? React.createElement(Component, { params }) : React.createElement(NotFound)
  );
}

export function Link({ to, children, ...props }) {
  const { navigate } = useRouter();
  return React.createElement('a', {
    href: to, onClick: (e) => { e.preventDefault(); navigate(to); }, ...props
  }, children);
}

function NotFound() {
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center',
             justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }
  },
    React.createElement('h1', { style: { fontSize: '6rem', margin: 0 } }, '404'),
    React.createElement('p',  { style: { fontSize: '1.5rem', color: '#666' } }, 'Page not found'),
    React.createElement('a',  { href: '/', style: { color: '#10b981', textDecoration: 'none' } }, 'Go home')
  );
}

${imports}

export const routes = [
${routeConfigs}
];
`;
}
async function generateRouter(routes, compiledDir) {
  await Bun.write(join2(compiledDir, "router.js"), generateRouterCode(routes));
}
var init_router = () => {};

// src/index.ts
init_src();
import { join as join3, extname as extname2, relative as relative2, dirname as dirname2 } from "path";
import { existsSync as existsSync2, mkdirSync, readdirSync as readdirSync2, statSync as statSync2 } from "fs";
async function transform(sourceCode, options = {}) {
  const { loader = "tsx", env = "development", addReactImport = true } = options;
  const transpiler = new Bun.Transpiler({
    loader,
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify(env) },
    tsconfig: {
      compilerOptions: {
        jsx: "react",
        jsxFactory: "React.createElement",
        jsxFragmentFactory: "React.Fragment",
        target: "ES2020",
        module: "ESNext"
      }
    }
  });
  let compiled = await transpiler.transform(sourceCode);
  if (addReactImport && !compiled.includes("import React") && containsJSX(compiled)) {
    compiled = `import React from 'react';
${compiled}`;
  }
  if (env === "production")
    compiled = compiled.replace(/jsxDEV/g, "jsx");
  return compiled;
}
function containsJSX(code) {
  return code.includes("React.createElement") || code.includes("React.Fragment") || /<[A-Z]/.test(code) || code.includes("jsx(") || code.includes("jsxs(");
}
function stripCSSImports(code) {
  code = code.replace(/import\s+(\w+)\s+from\s+['"][^'"]*\.module\.css['"];?\s*/g, (_, varName) => `const ${varName} = new Proxy({}, { get: (_, k) => k });
`);
  code = code.replace(/import\s+['"][^'"]*\.css['"];?\s*/g, "");
  code = code.replace(/import\s+['"]bertui\/styles['"]\s*;?\s*/g, "");
  return code;
}
function stripDotenvImports(code) {
  code = code.replace(/import\s+\w+\s+from\s+['"]dotenv['"]\s*;?\s*/g, "");
  code = code.replace(/import\s+\{[^}]+\}\s+from\s+['"]dotenv['"]\s*;?\s*/g, "");
  code = code.replace(/\w+\.config\(\s*\)\s*;?\s*/g, "");
  return code;
}
function fixRelativeImports(code) {
  const importRegex = /from\s+['"](\.\.?\/[^'"]+?)(?<!\.js|\.jsx|\.ts|\.tsx|\.json)['"]/g;
  return code.replace(importRegex, (match, path) => {
    if (path.endsWith("/") || /\.\w+$/.test(path))
      return match;
    return `from '${path}.js'`;
  });
}
function fixRouterImports(code, outPath, compiledDir) {
  const routerPath = join3(compiledDir, "router.js");
  const rel = relative2(dirname2(outPath), routerPath).replace(/\\/g, "/");
  const routerImport = rel.startsWith(".") ? rel : "./" + rel;
  return code.replace(/from\s+['"]bertui\/router['"]/g, `from '${routerImport}'`);
}
async function compileFile(opts) {
  const { srcPath, outPath, compiledDir, envVars = {}, aliasMap = new Map, env = "development" } = opts;
  const ext = extname2(srcPath);
  const loader = ext === ".tsx" ? "tsx" : ext === ".ts" ? "ts" : "jsx";
  let code = await Bun.file(srcPath).text();
  code = stripCSSImports(code);
  code = stripDotenvImports(code);
  code = replaceEnvInCode(code, envVars);
  code = fixRouterImports(code, outPath, compiledDir);
  let compiled;
  if (ext === ".js") {
    if (containsJSX(code) && !code.includes("import React")) {
      code = `import React from 'react';
${code}`;
    }
    compiled = code;
  } else {
    compiled = await transform(code, { loader, env, addReactImport: true });
  }
  compiled = fixRelativeImports(compiled);
  compiled = rewriteAliasImports(compiled, outPath, aliasMap);
  mkdirSync(dirname2(outPath), { recursive: true });
  await Bun.write(outPath, compiled);
}
async function compileDirectory(opts) {
  const { srcDir, outDir, root, envVars = {}, aliasMap = new Map, env = "development", skip = ["api", "templates"] } = opts;
  let files = 0;
  for (const entry of readdirSync2(srcDir)) {
    const srcPath = join3(srcDir, entry);
    const stat = statSync2(srcPath);
    if (stat.isDirectory()) {
      if (skip.includes(entry))
        continue;
      const subOut = join3(outDir, entry);
      mkdirSync(subOut, { recursive: true });
      const sub = await compileDirectory({ ...opts, srcDir: srcPath, outDir: subOut });
      files += sub.files;
      continue;
    }
    const ext = extname2(entry);
    if (ext === ".css")
      continue;
    if (![".jsx", ".tsx", ".ts", ".js"].includes(ext))
      continue;
    const outPath = join3(outDir, entry.replace(/\.(jsx|tsx|ts)$/, ".js"));
    try {
      await compileFile({ srcPath, outPath, compiledDir: outDir, envVars, aliasMap, env });
      files++;
    } catch (err) {
      const error = err;
      error.file = relative2(root, srcPath);
      throw error;
    }
  }
  return { files };
}
async function compileProject(root, opts = {}) {
  const { loadConfig: loadConfig2 } = await Promise.resolve().then(() => (init_src(), exports_src));
  const { discoverRoutes: discoverRoutes2, generateRouter: generateRouter2 } = await Promise.resolve().then(() => (init_router(), exports_router));
  const config2 = await loadConfig2(root);
  const env = opts.env ?? process.env["NODE_ENV"] ?? "development";
  const isProd = env === "production";
  const compiledDir = isProd ? join3(root, ".bertuibuild") : join3(root, ".bertui", "compiled");
  mkdirSync(compiledDir, { recursive: true });
  const envVars = loadEnvVariables(root);
  const importhow = config2.importhow ?? {};
  const aliasMap = buildAliasMap(importhow, root, compiledDir);
  const srcDir = join3(root, "src");
  const pagesDir = join3(srcDir, "pages");
  const start = Date.now();
  const stats = await compileDirectory({ srcDir, outDir: compiledDir, root, envVars, aliasMap, env });
  for (const [alias, relPath] of Object.entries(importhow)) {
    const absSrcDir = join3(root, relPath);
    if (!existsSync2(absSrcDir))
      continue;
    const aliasOutDir = join3(compiledDir, alias);
    mkdirSync(aliasOutDir, { recursive: true });
    const s = await compileDirectory({ srcDir: absSrcDir, outDir: aliasOutDir, root, envVars, aliasMap, env });
    stats.files += s.files;
  }
  let routes = [];
  if (existsSync2(pagesDir)) {
    routes = await discoverRoutes2(pagesDir);
    await generateRouter2(routes, compiledDir);
  }
  return { outDir: compiledDir, routes, stats: { ...stats, duration: Date.now() - start } };
}
export {
  transform,
  stripDotenvImports,
  stripCSSImports,
  fixRouterImports,
  fixRelativeImports,
  containsJSX,
  compileProject,
  compileFile,
  compileDirectory
};
