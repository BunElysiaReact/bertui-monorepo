// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
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

// ../compiler/src/router.ts
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

// ../../node_modules/.bun/detect-libc@2.1.2/node_modules/detect-libc/lib/process.js
var require_process = __commonJS((exports, module) => {
  var isLinux = () => process.platform === "linux";
  var report = null;
  var getReport = () => {
    if (!report) {
      if (isLinux() && process.report) {
        const orig = process.report.excludeNetwork;
        process.report.excludeNetwork = true;
        report = process.report.getReport();
        process.report.excludeNetwork = orig;
      } else {
        report = {};
      }
    }
    return report;
  };
  module.exports = { isLinux, getReport };
});

// ../../node_modules/.bun/detect-libc@2.1.2/node_modules/detect-libc/lib/filesystem.js
var require_filesystem = __commonJS((exports, module) => {
  var fs = __require("fs");
  var LDD_PATH = "/usr/bin/ldd";
  var SELF_PATH = "/proc/self/exe";
  var MAX_LENGTH = 2048;
  var readFileSync2 = (path) => {
    const fd = fs.openSync(path, "r");
    const buffer = Buffer.alloc(MAX_LENGTH);
    const bytesRead = fs.readSync(fd, buffer, 0, MAX_LENGTH, 0);
    fs.close(fd, () => {});
    return buffer.subarray(0, bytesRead);
  };
  var readFile = (path) => new Promise((resolve, reject) => {
    fs.open(path, "r", (err, fd) => {
      if (err) {
        reject(err);
      } else {
        const buffer = Buffer.alloc(MAX_LENGTH);
        fs.read(fd, buffer, 0, MAX_LENGTH, 0, (_, bytesRead) => {
          resolve(buffer.subarray(0, bytesRead));
          fs.close(fd, () => {});
        });
      }
    });
  });
  module.exports = {
    LDD_PATH,
    SELF_PATH,
    readFileSync: readFileSync2,
    readFile
  };
});

// ../../node_modules/.bun/detect-libc@2.1.2/node_modules/detect-libc/lib/elf.js
var require_elf = __commonJS((exports, module) => {
  var interpreterPath = (elf) => {
    if (elf.length < 64) {
      return null;
    }
    if (elf.readUInt32BE(0) !== 2135247942) {
      return null;
    }
    if (elf.readUInt8(4) !== 2) {
      return null;
    }
    if (elf.readUInt8(5) !== 1) {
      return null;
    }
    const offset = elf.readUInt32LE(32);
    const size = elf.readUInt16LE(54);
    const count = elf.readUInt16LE(56);
    for (let i = 0;i < count; i++) {
      const headerOffset = offset + i * size;
      const type = elf.readUInt32LE(headerOffset);
      if (type === 3) {
        const fileOffset = elf.readUInt32LE(headerOffset + 8);
        const fileSize = elf.readUInt32LE(headerOffset + 32);
        return elf.subarray(fileOffset, fileOffset + fileSize).toString().replace(/\0.*$/g, "");
      }
    }
    return null;
  };
  module.exports = {
    interpreterPath
  };
});

// ../../node_modules/.bun/detect-libc@2.1.2/node_modules/detect-libc/lib/detect-libc.js
var require_detect_libc = __commonJS((exports, module) => {
  var childProcess = __require("child_process");
  var { isLinux, getReport } = require_process();
  var { LDD_PATH, SELF_PATH, readFile, readFileSync: readFileSync2 } = require_filesystem();
  var { interpreterPath } = require_elf();
  var cachedFamilyInterpreter;
  var cachedFamilyFilesystem;
  var cachedVersionFilesystem;
  var command = "getconf GNU_LIBC_VERSION 2>&1 || true; ldd --version 2>&1 || true";
  var commandOut = "";
  var safeCommand = () => {
    if (!commandOut) {
      return new Promise((resolve) => {
        childProcess.exec(command, (err, out) => {
          commandOut = err ? " " : out;
          resolve(commandOut);
        });
      });
    }
    return commandOut;
  };
  var safeCommandSync = () => {
    if (!commandOut) {
      try {
        commandOut = childProcess.execSync(command, { encoding: "utf8" });
      } catch (_err) {
        commandOut = " ";
      }
    }
    return commandOut;
  };
  var GLIBC = "glibc";
  var RE_GLIBC_VERSION = /LIBC[a-z0-9 \-).]*?(\d+\.\d+)/i;
  var MUSL = "musl";
  var isFileMusl = (f) => f.includes("libc.musl-") || f.includes("ld-musl-");
  var familyFromReport = () => {
    const report = getReport();
    if (report.header && report.header.glibcVersionRuntime) {
      return GLIBC;
    }
    if (Array.isArray(report.sharedObjects)) {
      if (report.sharedObjects.some(isFileMusl)) {
        return MUSL;
      }
    }
    return null;
  };
  var familyFromCommand = (out) => {
    const [getconf, ldd1] = out.split(/[\r\n]+/);
    if (getconf && getconf.includes(GLIBC)) {
      return GLIBC;
    }
    if (ldd1 && ldd1.includes(MUSL)) {
      return MUSL;
    }
    return null;
  };
  var familyFromInterpreterPath = (path) => {
    if (path) {
      if (path.includes("/ld-musl-")) {
        return MUSL;
      } else if (path.includes("/ld-linux-")) {
        return GLIBC;
      }
    }
    return null;
  };
  var getFamilyFromLddContent = (content) => {
    content = content.toString();
    if (content.includes("musl")) {
      return MUSL;
    }
    if (content.includes("GNU C Library")) {
      return GLIBC;
    }
    return null;
  };
  var familyFromFilesystem = async () => {
    if (cachedFamilyFilesystem !== undefined) {
      return cachedFamilyFilesystem;
    }
    cachedFamilyFilesystem = null;
    try {
      const lddContent = await readFile(LDD_PATH);
      cachedFamilyFilesystem = getFamilyFromLddContent(lddContent);
    } catch (e) {}
    return cachedFamilyFilesystem;
  };
  var familyFromFilesystemSync = () => {
    if (cachedFamilyFilesystem !== undefined) {
      return cachedFamilyFilesystem;
    }
    cachedFamilyFilesystem = null;
    try {
      const lddContent = readFileSync2(LDD_PATH);
      cachedFamilyFilesystem = getFamilyFromLddContent(lddContent);
    } catch (e) {}
    return cachedFamilyFilesystem;
  };
  var familyFromInterpreter = async () => {
    if (cachedFamilyInterpreter !== undefined) {
      return cachedFamilyInterpreter;
    }
    cachedFamilyInterpreter = null;
    try {
      const selfContent = await readFile(SELF_PATH);
      const path = interpreterPath(selfContent);
      cachedFamilyInterpreter = familyFromInterpreterPath(path);
    } catch (e) {}
    return cachedFamilyInterpreter;
  };
  var familyFromInterpreterSync = () => {
    if (cachedFamilyInterpreter !== undefined) {
      return cachedFamilyInterpreter;
    }
    cachedFamilyInterpreter = null;
    try {
      const selfContent = readFileSync2(SELF_PATH);
      const path = interpreterPath(selfContent);
      cachedFamilyInterpreter = familyFromInterpreterPath(path);
    } catch (e) {}
    return cachedFamilyInterpreter;
  };
  var family = async () => {
    let family2 = null;
    if (isLinux()) {
      family2 = await familyFromInterpreter();
      if (!family2) {
        family2 = await familyFromFilesystem();
        if (!family2) {
          family2 = familyFromReport();
        }
        if (!family2) {
          const out = await safeCommand();
          family2 = familyFromCommand(out);
        }
      }
    }
    return family2;
  };
  var familySync = () => {
    let family2 = null;
    if (isLinux()) {
      family2 = familyFromInterpreterSync();
      if (!family2) {
        family2 = familyFromFilesystemSync();
        if (!family2) {
          family2 = familyFromReport();
        }
        if (!family2) {
          const out = safeCommandSync();
          family2 = familyFromCommand(out);
        }
      }
    }
    return family2;
  };
  var isNonGlibcLinux = async () => isLinux() && await family() !== GLIBC;
  var isNonGlibcLinuxSync = () => isLinux() && familySync() !== GLIBC;
  var versionFromFilesystem = async () => {
    if (cachedVersionFilesystem !== undefined) {
      return cachedVersionFilesystem;
    }
    cachedVersionFilesystem = null;
    try {
      const lddContent = await readFile(LDD_PATH);
      const versionMatch = lddContent.match(RE_GLIBC_VERSION);
      if (versionMatch) {
        cachedVersionFilesystem = versionMatch[1];
      }
    } catch (e) {}
    return cachedVersionFilesystem;
  };
  var versionFromFilesystemSync = () => {
    if (cachedVersionFilesystem !== undefined) {
      return cachedVersionFilesystem;
    }
    cachedVersionFilesystem = null;
    try {
      const lddContent = readFileSync2(LDD_PATH);
      const versionMatch = lddContent.match(RE_GLIBC_VERSION);
      if (versionMatch) {
        cachedVersionFilesystem = versionMatch[1];
      }
    } catch (e) {}
    return cachedVersionFilesystem;
  };
  var versionFromReport = () => {
    const report = getReport();
    if (report.header && report.header.glibcVersionRuntime) {
      return report.header.glibcVersionRuntime;
    }
    return null;
  };
  var versionSuffix = (s) => s.trim().split(/\s+/)[1];
  var versionFromCommand = (out) => {
    const [getconf, ldd1, ldd2] = out.split(/[\r\n]+/);
    if (getconf && getconf.includes(GLIBC)) {
      return versionSuffix(getconf);
    }
    if (ldd1 && ldd2 && ldd1.includes(MUSL)) {
      return versionSuffix(ldd2);
    }
    return null;
  };
  var version = async () => {
    let version2 = null;
    if (isLinux()) {
      version2 = await versionFromFilesystem();
      if (!version2) {
        version2 = versionFromReport();
      }
      if (!version2) {
        const out = await safeCommand();
        version2 = versionFromCommand(out);
      }
    }
    return version2;
  };
  var versionSync = () => {
    let version2 = null;
    if (isLinux()) {
      version2 = versionFromFilesystemSync();
      if (!version2) {
        version2 = versionFromReport();
      }
      if (!version2) {
        const out = safeCommandSync();
        version2 = versionFromCommand(out);
      }
    }
    return version2;
  };
  module.exports = {
    GLIBC,
    MUSL,
    family,
    familySync,
    isNonGlibcLinux,
    isNonGlibcLinuxSync,
    version,
    versionSync
  };
});

// ../../node_modules/.bun/lightningcss@1.32.0/node_modules/lightningcss/node/browserslistToTargets.js
var require_browserslistToTargets = __commonJS((exports, module) => {
  var BROWSER_MAPPING = {
    and_chr: "chrome",
    and_ff: "firefox",
    ie_mob: "ie",
    op_mob: "opera",
    and_qq: null,
    and_uc: null,
    baidu: null,
    bb: null,
    kaios: null,
    op_mini: null
  };
  function browserslistToTargets(browserslist) {
    let targets = {};
    for (let browser of browserslist) {
      let [name, v] = browser.split(" ");
      if (BROWSER_MAPPING[name] === null) {
        continue;
      }
      let version = parseVersion(v);
      if (version == null) {
        continue;
      }
      if (targets[name] == null || version < targets[name]) {
        targets[name] = version;
      }
    }
    return targets;
  }
  function parseVersion(version) {
    let [major, minor = 0, patch = 0] = version.split("-")[0].split(".").map((v) => parseInt(v, 10));
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      return null;
    }
    return major << 16 | minor << 8 | patch;
  }
  module.exports = browserslistToTargets;
});

// ../../node_modules/.bun/lightningcss@1.32.0/node_modules/lightningcss/node/composeVisitors.js
var require_composeVisitors = __commonJS((exports, module) => {
  function composeVisitors(visitors) {
    if (visitors.length === 1) {
      return visitors[0];
    }
    if (visitors.some((v) => typeof v === "function")) {
      return (opts) => {
        let v = visitors.map((v2) => typeof v2 === "function" ? v2(opts) : v2);
        return composeVisitors(v);
      };
    }
    let res = {};
    composeSimpleVisitors(res, visitors, "StyleSheet");
    composeSimpleVisitors(res, visitors, "StyleSheetExit");
    composeObjectVisitors(res, visitors, "Rule", ruleVisitor, wrapCustomAndUnknownAtRule);
    composeObjectVisitors(res, visitors, "RuleExit", ruleVisitor, wrapCustomAndUnknownAtRule);
    composeObjectVisitors(res, visitors, "Declaration", declarationVisitor, wrapCustomProperty);
    composeObjectVisitors(res, visitors, "DeclarationExit", declarationVisitor, wrapCustomProperty);
    composeSimpleVisitors(res, visitors, "Url");
    composeSimpleVisitors(res, visitors, "Color");
    composeSimpleVisitors(res, visitors, "Image");
    composeSimpleVisitors(res, visitors, "ImageExit");
    composeSimpleVisitors(res, visitors, "Length");
    composeSimpleVisitors(res, visitors, "Angle");
    composeSimpleVisitors(res, visitors, "Ratio");
    composeSimpleVisitors(res, visitors, "Resolution");
    composeSimpleVisitors(res, visitors, "Time");
    composeSimpleVisitors(res, visitors, "CustomIdent");
    composeSimpleVisitors(res, visitors, "DashedIdent");
    composeArrayFunctions(res, visitors, "MediaQuery");
    composeArrayFunctions(res, visitors, "MediaQueryExit");
    composeSimpleVisitors(res, visitors, "SupportsCondition");
    composeSimpleVisitors(res, visitors, "SupportsConditionExit");
    composeArrayFunctions(res, visitors, "Selector");
    composeTokenVisitors(res, visitors, "Token", "token", false);
    composeTokenVisitors(res, visitors, "Function", "function", false);
    composeTokenVisitors(res, visitors, "FunctionExit", "function", true);
    composeTokenVisitors(res, visitors, "Variable", "var", false);
    composeTokenVisitors(res, visitors, "VariableExit", "var", true);
    composeTokenVisitors(res, visitors, "EnvironmentVariable", "env", false);
    composeTokenVisitors(res, visitors, "EnvironmentVariableExit", "env", true);
    return res;
  }
  module.exports = composeVisitors;
  function wrapCustomAndUnknownAtRule(k, f) {
    if (k === "unknown") {
      return (value) => f({ type: "unknown", value });
    }
    if (k === "custom") {
      return (value) => f({ type: "custom", value });
    }
    return f;
  }
  function wrapCustomProperty(k, f) {
    return k === "custom" ? (value) => f({ property: "custom", value }) : f;
  }
  function ruleVisitor(f, item) {
    if (typeof f === "object") {
      if (item.type === "unknown") {
        let v = f.unknown;
        if (typeof v === "object") {
          v = v[item.value.name];
        }
        return v?.(item.value);
      }
      if (item.type === "custom") {
        let v = f.custom;
        if (typeof v === "object") {
          v = v[item.value.name];
        }
        return v?.(item.value);
      }
      return f[item.type]?.(item);
    }
    return f?.(item);
  }
  function declarationVisitor(f, item) {
    if (typeof f === "object") {
      let name = item.property;
      if (item.property === "unparsed") {
        name = item.value.propertyId.property;
      } else if (item.property === "custom") {
        let v = f.custom;
        if (typeof v === "object") {
          v = v[item.value.name];
        }
        return v?.(item.value);
      }
      return f[name]?.(item);
    }
    return f?.(item);
  }
  function extractObjectsOrFunctions(visitors, key) {
    let values = [];
    let hasFunction = false;
    let allKeys = new Set;
    for (let visitor of visitors) {
      let v = visitor[key];
      if (v) {
        if (typeof v === "function") {
          hasFunction = true;
        } else {
          for (let key2 in v) {
            allKeys.add(key2);
          }
        }
        values.push(v);
      }
    }
    return [values, hasFunction, allKeys];
  }
  function composeObjectVisitors(res, visitors, key, apply, wrapKey) {
    let [values, hasFunction, allKeys] = extractObjectsOrFunctions(visitors, key);
    if (values.length === 0) {
      return;
    }
    if (values.length === 1) {
      res[key] = values[0];
      return;
    }
    let f = createArrayVisitor(visitors, (visitor, item) => apply(visitor[key], item));
    if (hasFunction) {
      res[key] = f;
    } else {
      let v = {};
      for (let k of allKeys) {
        v[k] = wrapKey(k, f);
      }
      res[key] = v;
    }
  }
  function composeTokenVisitors(res, visitors, key, type, isExit) {
    let [values, hasFunction, allKeys] = extractObjectsOrFunctions(visitors, key);
    if (values.length === 0) {
      return;
    }
    if (values.length === 1) {
      res[key] = values[0];
      return;
    }
    let f = createTokenVisitor(visitors, type, isExit);
    if (hasFunction) {
      res[key] = f;
    } else {
      let v = {};
      for (let key2 of allKeys) {
        v[key2] = f;
      }
      res[key] = v;
    }
  }
  function createTokenVisitor(visitors, type, isExit) {
    let v = createArrayVisitor(visitors, (visitor, item) => {
      let f;
      switch (item.type) {
        case "token":
          f = visitor.Token;
          if (typeof f === "object") {
            f = f[item.value.type];
          }
          break;
        case "function":
          f = isExit ? visitor.FunctionExit : visitor.Function;
          if (typeof f === "object") {
            f = f[item.value.name];
          }
          break;
        case "var":
          f = isExit ? visitor.VariableExit : visitor.Variable;
          break;
        case "env":
          f = isExit ? visitor.EnvironmentVariableExit : visitor.EnvironmentVariable;
          if (typeof f === "object") {
            let name;
            switch (item.value.name.type) {
              case "ua":
              case "unknown":
                name = item.value.name.value;
                break;
              case "custom":
                name = item.value.name.ident;
                break;
            }
            f = f[name];
          }
          break;
        case "color":
          f = visitor.Color;
          break;
        case "url":
          f = visitor.Url;
          break;
        case "length":
          f = visitor.Length;
          break;
        case "angle":
          f = visitor.Angle;
          break;
        case "time":
          f = visitor.Time;
          break;
        case "resolution":
          f = visitor.Resolution;
          break;
        case "dashed-ident":
          f = visitor.DashedIdent;
          break;
      }
      if (!f) {
        return;
      }
      let res = f(item.value);
      switch (item.type) {
        case "color":
        case "url":
        case "length":
        case "angle":
        case "time":
        case "resolution":
        case "dashed-ident":
          if (Array.isArray(res)) {
            res = res.map((value) => ({ type: item.type, value }));
          } else if (res) {
            res = { type: item.type, value: res };
          }
          break;
      }
      return res;
    });
    return (value) => v({ type, value });
  }
  function extractFunctions(visitors, key) {
    let functions = [];
    for (let visitor of visitors) {
      let f = visitor[key];
      if (f) {
        functions.push(f);
      }
    }
    return functions;
  }
  function composeSimpleVisitors(res, visitors, key) {
    let functions = extractFunctions(visitors, key);
    if (functions.length === 0) {
      return;
    }
    if (functions.length === 1) {
      res[key] = functions[0];
      return;
    }
    res[key] = (arg) => {
      let mutated = false;
      for (let f of functions) {
        let res2 = f(arg);
        if (res2) {
          arg = res2;
          mutated = true;
        }
      }
      return mutated ? arg : undefined;
    };
  }
  function composeArrayFunctions(res, visitors, key) {
    let functions = extractFunctions(visitors, key);
    if (functions.length === 0) {
      return;
    }
    if (functions.length === 1) {
      res[key] = functions[0];
      return;
    }
    res[key] = createArrayVisitor(functions, (f, item) => f(item));
  }
  function createArrayVisitor(visitors, apply) {
    let seen = new Bitset(visitors.length);
    return (arg) => {
      let arr = [arg];
      let mutated = false;
      seen.clear();
      for (let i = 0;i < arr.length; i++) {
        for (let v = 0;v < visitors.length && i < arr.length; ) {
          if (seen.get(v)) {
            v++;
            continue;
          }
          let item = arr[i];
          let visitor = visitors[v];
          let res = apply(visitor, item);
          if (Array.isArray(res)) {
            if (res.length === 0) {
              arr.splice(i, 1);
            } else if (res.length === 1) {
              arr[i] = res[0];
            } else {
              arr.splice(i, 1, ...res);
            }
            mutated = true;
            seen.set(v);
            v = 0;
          } else if (res) {
            arr[i] = res;
            mutated = true;
            seen.set(v);
            v = 0;
          } else {
            v++;
          }
        }
      }
      if (!mutated) {
        return;
      }
      return arr.length === 1 ? arr[0] : arr;
    };
  }

  class Bitset {
    constructor(maxBits = 32) {
      this.bits = 0;
      this.more = maxBits > 32 ? new Uint32Array(Math.ceil((maxBits - 32) / 32)) : null;
    }
    get(bit) {
      if (bit >= 32 && this.more) {
        let i = Math.floor((bit - 32) / 32);
        let b = bit % 32;
        return Boolean(this.more[i] & 1 << b);
      } else {
        return Boolean(this.bits & 1 << bit);
      }
    }
    set(bit) {
      if (bit >= 32 && this.more) {
        let i = Math.floor((bit - 32) / 32);
        let b = bit % 32;
        this.more[i] |= 1 << b;
      } else {
        this.bits |= 1 << bit;
      }
    }
    clear() {
      this.bits = 0;
      if (this.more) {
        this.more.fill(0);
      }
    }
  }
});

// ../../node_modules/.bun/lightningcss@1.32.0/node_modules/lightningcss/node/flags.js
var require_flags = __commonJS((exports) => {
  exports.Features = {
    Nesting: 1,
    NotSelectorList: 2,
    DirSelector: 4,
    LangSelectorList: 8,
    IsSelector: 16,
    TextDecorationThicknessPercent: 32,
    MediaIntervalSyntax: 64,
    MediaRangeSyntax: 128,
    CustomMediaQueries: 256,
    ClampFunction: 512,
    ColorFunction: 1024,
    OklabColors: 2048,
    LabColors: 4096,
    P3Colors: 8192,
    HexAlphaColors: 16384,
    SpaceSeparatedColorNotation: 32768,
    FontFamilySystemUi: 65536,
    DoublePositionGradients: 131072,
    VendorPrefixes: 262144,
    LogicalProperties: 524288,
    LightDark: 1048576,
    Selectors: 31,
    MediaQueries: 448,
    Colors: 1113088
  };
});

// ../../node_modules/.bun/lightningcss@1.32.0/node_modules/lightningcss/node/index.js
var require_node = __commonJS((exports, module) => {
  var parts = [process.platform, process.arch];
  if (process.platform === "linux") {
    const { MUSL, familySync } = require_detect_libc();
    const family = familySync();
    if (family === MUSL) {
      parts.push("musl");
    } else if (process.arch === "arm") {
      parts.push("gnueabihf");
    } else {
      parts.push("gnu");
    }
  } else if (process.platform === "win32") {
    parts.push("msvc");
  }
  var native;
  try {
    native = __require(`lightningcss-${parts.join("-")}`);
  } catch (err) {
    native = __require(`../lightningcss.${parts.join("-")}.node`);
  }
  exports.transform = wrap(native.transform);
  exports.transformStyleAttribute = wrap(native.transformStyleAttribute);
  exports.bundle = wrap(native.bundle);
  exports.bundleAsync = wrap(native.bundleAsync);
  exports.browserslistToTargets = require_browserslistToTargets();
  exports.composeVisitors = require_composeVisitors();
  exports.Features = require_flags().Features;
  function wrap(call) {
    return (options) => {
      if (typeof options.visitor === "function") {
        let deps = [];
        options.visitor = options.visitor({
          addDependency(dep) {
            deps.push(dep);
          }
        });
        let result = call(options);
        if (result instanceof Promise) {
          result = result.then((res) => {
            if (deps.length) {
              res.dependencies ??= [];
              res.dependencies.push(...deps);
            }
            return res;
          });
        } else if (deps.length) {
          result.dependencies ??= [];
          result.dependencies.push(...deps);
        }
        return result;
      } else {
        return call(options);
      }
    };
  }
});

// src/index.ts
init_src();

// ../compiler/src/index.ts
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
// ../ssg/src/index.ts
import { join as join4 } from "path";
import { existsSync as existsSync3 } from "fs";
async function getRenderMode(sourcePath) {
  try {
    const src = await Bun.file(sourcePath).text();
    if (/export\s+const\s+render\s*=\s*["']server["']/.test(src))
      return "server";
    if (/export\s+const\s+render\s*=\s*["']static["']/.test(src))
      return "static";
  } catch {}
  return "client";
}
var BANNED_HOOKS = [
  "useState",
  "useEffect",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useContext",
  "useLayoutEffect",
  "useId",
  "useImperativeHandle",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useSyncExternalStore"
];
var BANNED_EVENTS = [
  "onClick",
  "onChange",
  "onSubmit",
  "onInput",
  "onFocus",
  "onBlur",
  "onMouseEnter",
  "onMouseLeave",
  "onKeyDown",
  "onKeyUp"
];
function validateServerIsland(sourceCode, _filePath) {
  const errors = [];
  for (const hook of BANNED_HOOKS) {
    if (new RegExp(`\\b${hook}\\s*\\(`).test(sourceCode)) {
      errors.push(`Cannot use React hook "${hook}" in a static/server page`);
    }
  }
  for (const event of BANNED_EVENTS) {
    if (sourceCode.includes(`${event}=`)) {
      errors.push(`Cannot use event handler "${event}" in a static/server page`);
    }
  }
  if (/window\.|document\.|localStorage\.|sessionStorage\./.test(sourceCode)) {
    errors.push("Cannot access browser APIs (window/document/localStorage) in a static/server page");
  }
  return { valid: errors.length === 0, errors };
}
function isServerIsland(sourceCode) {
  return /export\s+const\s+render\s*=\s*["'](server|static)["']/.test(sourceCode);
}
var VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
async function renderPageToHTML(compiledPagePath, _buildDir) {
  try {
    const projectRoot = compiledPagePath.split(".bertuibuild")[0];
    const reactPath = join4(projectRoot, "node_modules", "react", "index.js");
    const reactDomServerPath = join4(projectRoot, "node_modules", "react-dom", "server.js");
    if (!existsSync3(reactPath) || !existsSync3(reactDomServerPath))
      return null;
    const React = await import(reactPath);
    const { renderToString } = await import(reactDomServerPath);
    const mod = await import(`${compiledPagePath}?t=${Date.now()}`);
    const Component = mod.default;
    if (typeof Component !== "function")
      return null;
    return renderToString(React.createElement(Component));
  } catch {
    return null;
  }
}
async function validateAllServerIslands(routes) {
  const serverIslands = [];
  const validationResults = [];
  for (const route of routes) {
    try {
      const src = await Bun.file(route.path).text();
      if (!isServerIsland(src))
        continue;
      const result = validateServerIsland(src, route.path);
      serverIslands.push(route);
      validationResults.push({ ...result, route: route.route, path: route.path });
    } catch {}
  }
  return { serverIslands, validationResults };
}
// ../../node_modules/.bun/lightningcss@1.32.0/node_modules/lightningcss/node/index.mjs
var import__ = __toESM(require_node(), 1);
var { transform: transform2, transformStyleAttribute, bundle, bundleAsync, browserslistToTargets, composeVisitors, Features } = import__.default;

// ../css/src/index.ts
import { join as join5 } from "path";
import { existsSync as existsSync4, readdirSync as readdirSync3, mkdirSync as mkdirSync2 } from "fs" with { type: "json" };
var DEFAULT_TARGETS = {
  chrome: 90 << 16,
  firefox: 88 << 16,
  safari: 14 << 16,
  edge: 90 << 16
};
async function minifyCSS(css, options = {}) {
  const { filename = "style.css", minify = true, sourceMap = false } = options;
  if (!css.trim())
    return "/* No CSS */";
  try {
    const { code } = transform2({
      filename,
      code: Buffer.from(css),
      minify,
      sourceMap,
      targets: DEFAULT_TARGETS,
      drafts: { nesting: true }
    });
    return code.toString();
  } catch {
    return fallbackMinify(css);
  }
}
function minifyCSSSync(css, options = {}) {
  const { filename = "style.css", minify = true, sourceMap = false } = options;
  if (!css.trim())
    return "/* No CSS */";
  try {
    const { code } = transform2({
      filename,
      code: Buffer.from(css),
      minify,
      sourceMap,
      targets: DEFAULT_TARGETS,
      drafts: { nesting: true }
    });
    return code.toString();
  } catch {
    return fallbackMinify(css);
  }
}
function fallbackMinify(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").replace(/;}/g, "}").trim();
}
function hashClassName(filename, className) {
  const str = filename + className;
  let hash = 0;
  for (let i = 0;i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 5);
}
function scopeCSSModule(cssText, filename) {
  const classNames = new Set;
  const classRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*[{,\s:]/g;
  let match;
  while ((match = classRegex.exec(cssText)) !== null) {
    classNames.add(match[1]);
  }
  const mapping = {};
  for (const cls of classNames) {
    mapping[cls] = `${cls}_${hashClassName(filename, cls)}`;
  }
  let scopedCSS = cssText;
  for (const [original, scoped] of Object.entries(mapping)) {
    scopedCSS = scopedCSS.replace(new RegExp(`\\.${original}(?=[\\s{,:\\[#.>+~)\\]])`, "g"), `.${scoped}`);
  }
  return { mapping, scopedCSS };
}
async function buildAllCSS(root, outDir) {
  const srcStylesDir = join5(root, "src", "styles");
  const stylesOutDir = join5(outDir, "styles");
  mkdirSync2(stylesOutDir, { recursive: true });
  let combined = "";
  if (existsSync4(srcStylesDir)) {
    const cssFiles = readdirSync3(srcStylesDir).filter((f) => f.endsWith(".css") && !f.endsWith(".module.css"));
    for (const file of cssFiles) {
      const content = await Bun.file(join5(srcStylesDir, file)).text();
      combined += `/* ${file} */
${content}

`;
    }
  }
  const minified = combined.trim() ? await minifyCSS(combined, { filename: "bertui.min.css" }) : "/* No CSS */";
  await Bun.write(join5(stylesOutDir, "bertui.min.css"), minified);
}
// ../images/src/index.ts
init_src();
import { join as join6, extname as extname3 } from "path";
import { existsSync as existsSync5, readdirSync as readdirSync4, statSync as statSync3, mkdirSync as mkdirSync3, cpSync } from "fs";
var IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".ico",
  ".bmp",
  ".tiff",
  ".tif"
]);
function isImageFile(filename) {
  return IMAGE_EXTENSIONS.has(extname3(filename).toLowerCase());
}
function copyImagesSync(srcDir, destDir) {
  let copied = 0;
  let skipped = 0;
  if (!existsSync5(srcDir))
    return { copied, skipped };
  mkdirSync3(destDir, { recursive: true });
  function process2(dir, targetDir) {
    for (const entry of readdirSync4(dir, { withFileTypes: true })) {
      const src = join6(dir, entry.name);
      const dest = join6(targetDir, entry.name);
      if (entry.isDirectory()) {
        mkdirSync3(dest, { recursive: true });
        process2(src, dest);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        try {
          cpSync(src, dest);
          copied++;
        } catch {
          skipped++;
        }
      } else {
        skipped++;
      }
    }
  }
  process2(srcDir, destDir);
  return { copied, skipped };
}
function getImageFiles(dir, baseDir = dir) {
  const images = [];
  if (!existsSync5(dir))
    return images;
  function scan(directory) {
    for (const entry of readdirSync4(directory, { withFileTypes: true })) {
      const fullPath = join6(directory, entry.name);
      const relativePath = fullPath.replace(baseDir, "").replace(/^[/\\]/, "");
      if (entry.isDirectory())
        scan(fullPath);
      else if (entry.isFile() && isImageFile(entry.name)) {
        images.push({
          path: fullPath,
          relativePath,
          filename: entry.name,
          size: statSync3(fullPath).size,
          ext: extname3(entry.name).toLowerCase()
        });
      }
    }
  }
  scan(dir);
  return images;
}
async function optimizeImage(buffer, options = {}) {
  const { format = "auto", quality = 3 } = options;
  const detected = format === "auto" ? detectFormat(new Uint8Array(buffer)) : format;
  const original_size = buffer.byteLength;
  if (detected === "png") {
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const { writeFile, readFile, unlink } = await import("fs/promises");
      const { tmpdir } = await import("os");
      const execAsync = promisify(exec);
      const tmpIn = join6(tmpdir(), `bertui-${Date.now()}.png`);
      const tmpOut = join6(tmpdir(), `bertui-${Date.now()}-opt.png`);
      await writeFile(tmpIn, Buffer.from(buffer));
      await execAsync(`oxipng -o ${quality} -s "${tmpIn}" -o "${tmpOut}"`);
      const optimized = await readFile(tmpOut);
      const optimized_size = optimized.length;
      await unlink(tmpIn).catch(() => {});
      await unlink(tmpOut).catch(() => {});
      return {
        data: optimized.buffer,
        original_size,
        optimized_size,
        format: "png",
        savings_percent: parseFloat(((original_size - optimized_size) / original_size * 100).toFixed(1))
      };
    } catch {}
  }
  return { data: buffer, original_size, optimized_size: original_size, format: detected, savings_percent: 0 };
}
function detectFormat(buffer) {
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buffer.length >= 8 && PNG_SIG.every((b, i) => buffer[i] === b))
    return "png";
  if (buffer[0] === 255 && buffer[1] === 216)
    return "jpg";
  return "unknown";
}
// ../dev/src/index.ts
import { join as join7, extname as extname4 } from "path";
import { existsSync as existsSync6, readdirSync as readdirSync5, statSync as statSync4 } from "fs";
var _cachedMap = null;
var _cachedMtime = null;
async function buildDevImportMap(root) {
  const pkgJsonPath = join7(root, "package.json");
  const nodeModulesDir = join7(root, "node_modules");
  let currentMtime = null;
  try {
    currentMtime = statSync4(pkgJsonPath).mtimeMs;
  } catch {}
  if (_cachedMap && currentMtime === _cachedMtime)
    return _cachedMap;
  const importMap = {
    react: "https://esm.sh/react@19.0.0",
    "react-dom": "https://esm.sh/react-dom@19.0.0",
    "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
    "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@19.0.0/jsx-dev-runtime",
    "@bunnyx/api": "/bunnyx-api/api-client.js"
  };
  const SKIP = new Set(["react", "react-dom", ".bin", ".cache"]);
  if (existsSync6(nodeModulesDir)) {
    for (const pkg of readdirSync5(nodeModulesDir)) {
      if (SKIP.has(pkg) || pkg.startsWith("."))
        continue;
      const pkgDir = join7(nodeModulesDir, pkg);
      const pkgJsonFile = join7(pkgDir, "package.json");
      try {
        if (!statSync4(pkgDir).isDirectory())
          continue;
        if (!existsSync6(pkgJsonFile))
          continue;
        const pkgJson = JSON.parse(await Bun.file(pkgJsonFile).text());
        const entries = [pkgJson["module"], pkgJson["browser"], pkgJson["main"], "index.js"].filter((e) => typeof e === "string");
        for (const entry of entries) {
          if (existsSync6(join7(pkgDir, entry))) {
            importMap[pkg] = `/node_modules/${pkg}/${entry}`;
            break;
          }
        }
      } catch {}
    }
  }
  _cachedMap = importMap;
  _cachedMtime = currentMtime;
  return importMap;
}
function invalidateImportMap() {
  _cachedMap = null;
  _cachedMtime = null;
}
function setupFileWatcher(opts) {
  const { root, compiledDir: _compiledDir, onRecompile, notifyClients } = opts;
  const srcDir = join7(root, "src");
  const pkgJson = join7(root, "package.json");
  if (!existsSync6(srcDir))
    return () => {};
  const WATCHED_EXTS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp"
  ]);
  let isRecompiling = false;
  let debounce = null;
  const { watch } = __require("fs");
  const srcWatcher = watch(srcDir, { recursive: true }, async (_evt, filename) => {
    if (!filename)
      return;
    if (!WATCHED_EXTS.has(extname4(filename)))
      return;
    if (debounce)
      clearTimeout(debounce);
    debounce = setTimeout(async () => {
      if (isRecompiling)
        return;
      isRecompiling = true;
      notifyClients({ type: "recompiling" });
      try {
        const { compileProject: compileProject2 } = await import("@bertui/compiler");
        await compileProject2(root, { env: "development" });
        if (onRecompile)
          await onRecompile();
        notifyClients({ type: "compiled" });
        setTimeout(() => notifyClients({ type: "reload" }), 100);
      } catch (err) {
        const error = err;
        notifyClients({
          type: "compilation-error",
          message: error.message,
          stack: error.stack,
          file: error.file,
          line: error.line,
          column: error.column
        });
      } finally {
        isRecompiling = false;
      }
    }, 150);
  });
  let pkgWatcher = null;
  let lastMtime = null;
  if (existsSync6(pkgJson)) {
    try {
      lastMtime = statSync4(pkgJson).mtimeMs;
    } catch {}
    pkgWatcher = watch(pkgJson, async () => {
      try {
        const newMtime = statSync4(pkgJson).mtimeMs;
        if (newMtime === lastMtime)
          return;
        lastMtime = newMtime;
        invalidateImportMap();
        await buildDevImportMap(root);
        notifyClients({ type: "importmap-updated" });
      } catch {}
    });
  }
  return () => {
    srcWatcher.close();
    pkgWatcher?.close();
    if (debounce)
      clearTimeout(debounce);
  };
}

// src/index.ts
var VERSION2 = "2.0.0";
export {
  validateServerIsland,
  validateAllServerIslands,
  transform,
  toPascalCase,
  setupFileWatcher,
  scopeCSSModule,
  rewriteAliasImports,
  replaceEnvInCode,
  renderPageToHTML,
  optimizeImage,
  minifyCSSSync,
  minifyCSS,
  loadEnvVariables,
  loadConfig,
  isServerIsland,
  isImageFile,
  globalCache,
  getRenderMode,
  getImageFiles,
  getAliasDirs,
  generateEnvCode,
  formatBytes,
  extractMetaFromSource,
  escapeHtml,
  defaultConfig,
  copyImagesSync,
  compileProject,
  compileFile,
  buildDevImportMap,
  buildAllCSS,
  buildAliasMap,
  VERSION2 as VERSION,
  BertuiCache
};
