// @bun
var __require = import.meta.require;
// src/config/index.ts
var defaultConfig = {
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
// src/utils/index.ts
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
// src/cache/index.ts
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
var globalCache = new BertuiCache;

// src/index.ts
var VERSION = "2.0.0";
export {
  toPascalCase,
  rewriteAliasImports,
  replaceEnvInCode,
  loadEnvVariables,
  loadConfig,
  globalCache,
  getAliasDirs,
  generateEnvCode,
  formatBytes,
  extractMetaFromSource,
  escapeHtml,
  defaultConfig,
  buildAliasMap,
  VERSION,
  BertuiCache
};
