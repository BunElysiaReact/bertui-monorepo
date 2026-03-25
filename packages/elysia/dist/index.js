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

// ../compiler/dist/index.js
var exports_dist = {};
__export(exports_dist, {
  transform: () => transform,
  stripDotenvImports: () => stripDotenvImports,
  stripCSSImports: () => stripCSSImports,
  fixRouterImports: () => fixRouterImports,
  fixRelativeImports: () => fixRelativeImports,
  containsJSX: () => containsJSX,
  compileProject: () => compileProject,
  compileFile: () => compileFile,
  compileDirectory: () => compileDirectory
});
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "fs";
import { join as join2, dirname as dirname2, relative as relative2 } from "path";
import { createHash as createHash2 } from "crypto";
import { join as join22, extname } from "path";
import { readdirSync } from "fs";
import { join as join3, extname as extname2, relative as relative22, dirname as dirname22 } from "path";
import { existsSync as existsSync22, mkdirSync, readdirSync as readdirSync2, statSync as statSync2 } from "fs";
function __exportSetter2(name, newValue) {
  this[name] = __returnValue2.bind(null, newValue);
}
function mergeConfig2(defaults, user) {
  return {
    ...defaults,
    ...user,
    meta: { ...defaults.meta, ...user.meta ?? {} },
    appShell: { ...defaults.appShell, ...user.appShell ?? {} },
    robots: { ...defaults.robots, ...user.robots ?? {} },
    importhow: { ...defaults.importhow, ...user.importhow ?? {} }
  };
}
async function loadConfig2(root) {
  const { join: join4 } = await import("path");
  const { existsSync: existsSync3 } = await import("fs");
  const configPath = join4(root, "bertui.config.js");
  if (!existsSync3(configPath))
    return defaultConfig2;
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
      return defaultConfig2;
    return mergeConfig2(defaultConfig2, userConfig);
  } catch (err) {
    console.warn(`[bertui] Failed to load bertui.config.js: ${err.message}`);
    return defaultConfig2;
  }
}
function loadEnvVariables2(root) {
  const envPath = join2(root, ".env");
  const envVars = {};
  if (!existsSync2(envPath))
    return envVars;
  try {
    const lines = readFileSync2(envPath, "utf-8").split(`
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
function replaceEnvInCode2(code, envVars) {
  let modified = code;
  for (const [key, value] of Object.entries(envVars)) {
    const regex = new RegExp(`process\\.env\\.${key}\\b`, "g");
    modified = modified.replace(regex, JSON.stringify(value));
  }
  return modified;
}
function generateEnvCode2(envVars) {
  const exports = Object.entries(envVars).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join(`
`);
  return `// Auto-generated \u2014 do not edit
${exports}
`;
}
function extractMetaFromSource2(sourceCode) {
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
function buildAliasMap2(importhow = {}, projectRoot, compiledDir = null) {
  const map = new Map;
  for (const [alias, relPath] of Object.entries(importhow)) {
    const abs = compiledDir ? join2(compiledDir, alias) : join2(projectRoot, relPath);
    map.set(alias, abs);
  }
  return map;
}
function rewriteAliasImports2(code, currentFile, aliasMap) {
  if (!aliasMap || aliasMap.size === 0)
    return code;
  const currentDir = dirname2(currentFile);
  const importRe = /(?:import|export)(?:\s+[\w*{},\s]+\s+from)?\s+['"]([^'"]+)['"]/g;
  return code.replace(importRe, (match, specifier) => {
    const slashIdx = specifier.indexOf("/");
    const alias = slashIdx === -1 ? specifier : specifier.slice(0, slashIdx);
    const rest = slashIdx === -1 ? "" : specifier.slice(slashIdx);
    const absBase = aliasMap.get(alias);
    if (!absBase)
      return match;
    let rel = relative2(currentDir, absBase + rest).replace(/\\/g, "/");
    if (!rel.startsWith("."))
      rel = "./" + rel;
    if (rest && !/\.\w+$/.test(rest))
      rel += ".js";
    return match.replace(`'${specifier}'`, `'${rel}'`).replace(`"${specifier}"`, `"${rel}"`);
  });
}
function getAliasDirs2(aliasMap) {
  return new Set(aliasMap.values());
}
function formatBytes2(bytes) {
  if (bytes === 0)
    return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function escapeHtml2(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m] ?? m);
}
function toPascalCase2(str) {
  return str.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (c) => c.toUpperCase()).replace(/[[\]]/g, "");
}

class BertuiCache2 {
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
    const hash = createHash2("md5").update(css).digest("hex");
    return this.cssCache.get(hash) ?? null;
  }
  setCSS(css, result) {
    const hash = createHash2("md5").update(css).digest("hex");
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
async function discoverRoutes(pagesDir) {
  const routes = [];
  function scan(dir, basePath = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join22(dir, entry.name);
      const relativePath = join22(basePath, entry.name);
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
  await Bun.write(join22(compiledDir, "router.js"), generateRouterCode(routes));
}
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
  const rel = relative22(dirname22(outPath), routerPath).replace(/\\/g, "/");
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
  code = replaceEnvInCode2(code, envVars);
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
  compiled = rewriteAliasImports2(compiled, outPath, aliasMap);
  mkdirSync(dirname22(outPath), { recursive: true });
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
      error.file = relative22(root, srcPath);
      throw error;
    }
  }
  return { files };
}
async function compileProject(root, opts = {}) {
  const { loadConfig: loadConfig22 } = await Promise.resolve().then(() => (init_src2(), exports_src2));
  const { discoverRoutes: discoverRoutes2, generateRouter: generateRouter2 } = await Promise.resolve().then(() => (init_router(), exports_router));
  const config2 = await loadConfig22(root);
  const env = opts.env ?? process.env["NODE_ENV"] ?? "development";
  const isProd = env === "production";
  const compiledDir = isProd ? join3(root, ".bertuibuild") : join3(root, ".bertui", "compiled");
  mkdirSync(compiledDir, { recursive: true });
  const envVars = loadEnvVariables2(root);
  const importhow = config2.importhow ?? {};
  const aliasMap = buildAliasMap2(importhow, root, compiledDir);
  const srcDir = join3(root, "src");
  const pagesDir = join3(srcDir, "pages");
  const start = Date.now();
  const stats = await compileDirectory({ srcDir, outDir: compiledDir, root, envVars, aliasMap, env });
  for (const [alias, relPath] of Object.entries(importhow)) {
    const absSrcDir = join3(root, relPath);
    if (!existsSync22(absSrcDir))
      continue;
    const aliasOutDir = join3(compiledDir, alias);
    mkdirSync(aliasOutDir, { recursive: true });
    const s = await compileDirectory({ srcDir: absSrcDir, outDir: aliasOutDir, root, envVars, aliasMap, env });
    stats.files += s.files;
  }
  let routes = [];
  if (existsSync22(pagesDir)) {
    routes = await discoverRoutes2(pagesDir);
    await generateRouter2(routes, compiledDir);
  }
  return { outDir: compiledDir, routes, stats: { ...stats, duration: Date.now() - start } };
}
var __defProp2, __returnValue2 = (v) => v, __export2 = (target, all) => {
  for (var name in all)
    __defProp2(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter2.bind(all, name)
    });
}, __esm2 = (fn, res) => () => (fn && (res = fn(fn = 0)), res), defaultConfig2, init_config2, init_utils2 = () => {}, globalCache2, init_cache2, exports_src2, VERSION2 = "2.0.0", init_src2, exports_router, init_router = () => {};
var init_dist = __esm(() => {
  __defProp2 = Object.defineProperty;
  init_config2 = __esm2(() => {
    defaultConfig2 = {
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
  init_cache2 = __esm2(() => {
    globalCache2 = new BertuiCache2;
  });
  exports_src2 = {};
  __export2(exports_src2, {
    toPascalCase: () => toPascalCase2,
    rewriteAliasImports: () => rewriteAliasImports2,
    replaceEnvInCode: () => replaceEnvInCode2,
    loadEnvVariables: () => loadEnvVariables2,
    loadConfig: () => loadConfig2,
    globalCache: () => globalCache2,
    getAliasDirs: () => getAliasDirs2,
    generateEnvCode: () => generateEnvCode2,
    formatBytes: () => formatBytes2,
    extractMetaFromSource: () => extractMetaFromSource2,
    escapeHtml: () => escapeHtml2,
    defaultConfig: () => defaultConfig2,
    buildAliasMap: () => buildAliasMap2,
    VERSION: () => VERSION2,
    BertuiCache: () => BertuiCache2
  });
  init_src2 = __esm2(() => {
    init_config2();
    init_utils2();
    init_cache2();
  });
  exports_router = {};
  __export2(exports_router, {
    generateRouterCode: () => generateRouterCode,
    generateRouter: () => generateRouter,
    discoverRoutes: () => discoverRoutes
  });
  init_src2();
});

// src/dev-handler.ts
var exports_dev_handler = {};
__export(exports_dev_handler, {
  createDevHandler: () => createDevHandler
});
import { join as join4, extname as extname3 } from "path";
async function createDevHandler(options) {
  const { root, port = 3000 } = options;
  const { loadConfig: loadConfig3 } = await Promise.resolve().then(() => (init_src(), exports_src));
  const { compileProject: compileProject2 } = await Promise.resolve().then(() => (init_dist(), exports_dist));
  const config2 = await loadConfig3(root);
  const compiledDir = join4(root, ".bertui", "compiled");
  const srcDir = join4(root, "src");
  const publicDir = join4(root, "public");
  const stylesDir = join4(root, ".bertui", "styles");
  await compileProject2(root, { env: "development" });
  const clients = new Set;
  function notifyClients(msg) {
    for (const client of clients) {
      try {
        client.send(JSON.stringify(msg));
      } catch {
        clients.delete(client);
      }
    }
  }
  async function handleRequest(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === "/__hmr")
      return null;
    if (pathname === "/" || !pathname.includes(".") && !pathname.startsWith("/compiled")) {
      const html = await buildHTML(root, config2, port, compiledDir);
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    if (pathname.startsWith("/compiled/")) {
      const file = Bun.file(join4(compiledDir, pathname.replace("/compiled/", "")));
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
    }
    if (pathname.startsWith("/styles/")) {
      const file = Bun.file(join4(stylesDir, pathname.replace("/styles/", "")));
      if (await file.exists()) {
        return new Response(file, { headers: { "Content-Type": "text/css", "Cache-Control": "no-store" } });
      }
    }
    const publicFile = Bun.file(join4(publicDir, pathname.slice(1)));
    if (await publicFile.exists()) {
      return new Response(publicFile, { headers: { "Cache-Control": "no-cache" } });
    }
    if (pathname.startsWith("/node_modules/")) {
      const file = Bun.file(join4(root, "node_modules", pathname.replace("/node_modules/", "")));
      if (await file.exists()) {
        const ext = extname3(pathname).toLowerCase();
        return new Response(file, {
          headers: { "Content-Type": getMime(ext), "Cache-Control": "no-cache" }
        });
      }
    }
    return null;
  }
  function dispose() {
    clients.clear();
  }
  return { handleRequest, dispose };
}
async function buildHTML(root, config2, port, _compiledDir) {
  const meta = config2.meta;
  const importMap = {
    react: "https://esm.sh/react@19.0.0",
    "react-dom": "https://esm.sh/react-dom@19.0.0",
    "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
    "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@19.0.0/jsx-dev-runtime",
    "@bunnyx/api": "/bunnyx-api/api-client.js"
  };
  return `<!DOCTYPE html>
<html lang="${meta.lang ?? "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title ?? "BertUI App"}</title>
  ${meta.description ? `<meta name="description" content="${meta.description}">` : ""}
  ${meta.themeColor ? `<meta name="theme-color" content="${meta.themeColor}">` : ""}
  <link rel="icon" type="image/svg+xml" href="/public/favicon.svg">
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    const ws = new WebSocket('ws://localhost:${port}/__hmr');
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'reload') location.reload();
      if (d.type === 'compilation-error' && window.__BERTUI_SHOW_ERROR__) {
        window.__BERTUI_SHOW_ERROR__(d);
      }
    };
  </script>
  <script src="/error-overlay.js"></script>
  <script type="module" src="/compiled/main.js"></script>
</body>
</html>`;
}
function getMime(ext) {
  const m = {
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png"
  };
  return m[ext] ?? "application/octet-stream";
}
var init_dev_handler = () => {};

// src/index.ts
init_src();
import { join as join6, extname as extname5 } from "path";
import { existsSync as existsSync3 } from "fs";
var _singleton = null;
var _root = null;
async function getDevHandler(root) {
  if (_singleton && _root === root)
    return _singleton;
  _singleton?.dispose();
  const { createDevHandler: createDevHandler2 } = await Promise.resolve().then(() => (init_dev_handler(), exports_dev_handler));
  _singleton = await createDevHandler2({ root });
  _root = root;
  return _singleton;
}
function bertui(options = {}) {
  const root = options.root ?? process.cwd();
  return {
    name: "@bertui/elysia",
    async setup(app) {
      const config2 = await loadConfig(root);
      const port = options.port ?? config2.port ?? 3000;
      if (options.serveStatic) {
        const distDir = join6(root, "dist");
        if (existsSync3(distDir)) {
          app.get("/assets/*", async ({ request }) => {
            const url = new URL(request.url);
            const filePath = join6(distDir, url.pathname);
            const file = Bun.file(filePath);
            if (await file.exists()) {
              const ext = extname5(filePath).toLowerCase();
              return new Response(file, {
                headers: {
                  "Content-Type": getMimeType(ext),
                  "Cache-Control": "public, max-age=31536000, immutable"
                }
              });
            }
            return new Response("Not found", { status: 404 });
          });
        }
      }
      app.get("/*", async ({ request }) => {
        const handler = await getDevHandler(root);
        const response = await handler.handleRequest(request);
        if (response)
          return response;
        return new Response("Not found", { status: 404 });
      });
      return app;
    }
  };
}
async function bertuiMiddleware(request, options = {}) {
  const root = options.root ?? process.cwd();
  const handler = await getDevHandler(root);
  return handler.handleRequest(request);
}
function disposeBertui() {
  _singleton?.dispose();
  _singleton = null;
  _root = null;
}
function getMimeType(ext) {
  const types2 = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf"
  };
  return types2[ext] ?? "application/octet-stream";
}
export {
  disposeBertui,
  bertuiMiddleware,
  bertui
};
