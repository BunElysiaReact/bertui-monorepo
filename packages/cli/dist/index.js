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

// src/analyze.ts
var exports_analyze = {};
__export(exports_analyze, {
  analyzeBuild: () => analyzeBuild
});
import { join as join2, relative as relative2 } from "path";
import { existsSync as existsSync2, readdirSync, statSync } from "fs";
async function analyzeBuild(outDir, options = {}) {
  const { open = false, outputFile = join2(outDir, "bundle-report.html") } = options;
  const assetsDir = join2(outDir, "assets");
  if (!existsSync2(assetsDir)) {
    console.error("  No assets/ directory \u2014 run: bertui build");
    return null;
  }
  const files = collectFiles(assetsDir, outDir);
  const html = generateReport(files, outDir);
  await Bun.write(outputFile, html);
  console.log(`  \x1B[32m\u2713\x1B[0m  Bundle report: ${outputFile}`);
  if (open) {
    const { exec } = await import("child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${outputFile}"`);
  }
  return { outputFile, files };
}
function collectFiles(assetsDir, outDir) {
  const files = [];
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join2(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
        continue;
      }
      const stat = statSync(full);
      const ext = entry.name.split(".").pop() ?? "";
      files.push({
        name: entry.name,
        path: relative2(outDir, full),
        size: stat.size,
        type: getType(ext),
        ext
      });
    }
  }
  scan(assetsDir);
  files.sort((a, b) => b.size - a.size);
  return files;
}
function getType(ext) {
  if (["js", "mjs"].includes(ext))
    return "javascript";
  if (ext === "css")
    return "css";
  if (ext === "map")
    return "sourcemap";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "avif"].includes(ext))
    return "image";
  return "other";
}
function generateReport(files, outDir) {
  const total = files.reduce((s, f) => s + f.size, 0);
  const jsSize = files.filter((f) => f.type === "javascript").reduce((s, f) => s + f.size, 0);
  const cssSize = files.filter((f) => f.type === "css").reduce((s, f) => s + f.size, 0);
  const imgSize = files.filter((f) => f.type === "image").reduce((s, f) => s + f.size, 0);
  const rows = files.map((f) => {
    const pct = total > 0 ? (f.size / total * 100).toFixed(1) : "0";
    const barWidth = Math.max(2, Math.round(f.size / (files[0]?.size ?? 1) * 200));
    const color = COLOR[f.type];
    return `<tr>
      <td style="font-weight:600;color:#f1f5f9;white-space:nowrap">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle"></span>${f.name}
      </td>
      <td style="color:#64748b;font-size:12px;font-family:monospace">${f.path}</td>
      <td style="color:#94a3b8;font-size:12px;text-transform:uppercase">${f.type}</td>
      <td style="font-weight:600;color:#10b981;white-space:nowrap">${formatBytes(f.size)}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div style="width:${barWidth}px;height:6px;border-radius:3px;background:${color};min-width:2px"></div>
        <span style="color:#64748b;font-size:12px">${pct}%</span>
      </div></td>
    </tr>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BertUI Bundle Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:32px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:28px}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px}
.card .label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
.card .value{font-size:26px;font-weight:700;margin-top:4px}
.card .sub{font-size:12px;color:#64748b;margin-top:2px}
.section{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:24px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:12px 20px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:1px solid #334155}
td{padding:11px 20px;font-size:13px;border-bottom:1px solid #1e293b;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#263348}
input[type=search]{background:#334155;border:1px solid #475569;color:#f1f5f9;padding:6px 14px;border-radius:8px;font-size:13px;outline:none;width:220px}
input[type=search]:focus{border-color:#10b981}
.filters{display:flex;gap:8px;padding:14px 20px;border-bottom:1px solid #334155;flex-wrap:wrap}
button{background:#334155;color:#94a3b8;border:none;padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer}
button:hover,button.active{background:#10b981;color:#fff}
.footer{color:#64748b;font-size:12px;text-align:center;margin-top:20px}
</style>
</head>
<body>
<div style="display:flex;align-items:center;gap:14px;margin-bottom:28px">
  <div>
    <div style="display:flex;align-items:center;gap:10px">
      <h1 style="font-size:26px;font-weight:700;color:#f8fafc">Bundle Report</h1>
      <span style="background:#10b981;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">\u26A1 BertUI</span>
    </div>
    <p style="color:#64748b;font-size:13px;margin-top:4px">Generated ${new Date().toLocaleString()} \xB7 ${outDir}</p>
  </div>
</div>
<div class="cards">
  <div class="card"><div class="label">Total</div><div class="value" style="color:#10b981">${formatBytes(total)}</div><div class="sub">${files.length} files</div></div>
  <div class="card"><div class="label">JavaScript</div><div class="value" style="color:#3b82f6">${formatBytes(jsSize)}</div></div>
  <div class="card"><div class="label">CSS</div><div class="value" style="color:#8b5cf6">${formatBytes(cssSize)}</div></div>
  <div class="card"><div class="label">Images</div><div class="value" style="color:#f59e0b">${formatBytes(imgSize)}</div></div>
</div>
<div class="section">
  <div class="filters">
    <button class="active" onclick="filter('all',this)">All</button>
    <button onclick="filter('javascript',this)">JS</button>
    <button onclick="filter('css',this)">CSS</button>
    <button onclick="filter('image',this)">Images</button>
    <input type="search" id="q" placeholder="Search files..." oninput="search(this.value)">
  </div>
  <table id="t">
    <thead><tr><th>File</th><th>Path</th><th>Type</th><th>Size</th><th>% of total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p class="footer">BertUI v2 \xB7 bundle-report.html</p>
<script>
let cur='all'
const rows=[...document.querySelectorAll('#t tbody tr')]
function filter(t,btn){cur=t;document.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');apply()}
function search(q){apply(q)}
function apply(q=document.getElementById('q').value){
  rows.forEach(r=>{
    const type=r.cells[2].textContent.trim()
    const name=r.cells[0].textContent.trim()
    r.style.display=(cur==='all'||type===cur)&&(!q||name.toLowerCase().includes(q.toLowerCase()))?'':'none'
  })
}
</script>
</body>
</html>`;
}
var COLOR;
var init_analyze = __esm(() => {
  init_src();
  COLOR = {
    javascript: "#3b82f6",
    css: "#8b5cf6",
    sourcemap: "#6b7280",
    image: "#f59e0b",
    other: "#10b981"
  };
});

// src/scaffold.ts
var exports_scaffold = {};
__export(exports_scaffold, {
  scaffold: () => scaffold,
  parseCreateArgs: () => parseCreateArgs
});
import { join as join3 } from "path";
import { existsSync as existsSync3, mkdirSync } from "fs";
async function scaffold(type, name, options = { root: process.cwd() }) {
  const { root, ts = true } = options;
  const ext = ts ? ".tsx" : ".jsx";
  switch (type) {
    case "component":
      return createComponent(name, root, ext);
    case "page":
      return createPage(name, root, ext);
    case "layout":
      return createLayout(name, root, ext);
    case "loading":
      return createLoading(name, root, ext);
    case "middleware":
      return createMiddleware(root, ts);
    default:
      console.error(`Unknown type: ${type}. Use: component, page, layout, loading, middleware`);
      return false;
  }
}
async function createComponent(name, root, ext) {
  const pascal = toPascalCase(name);
  const dir = join3(root, "src", "components");
  const outPath = join3(dir, `${pascal}${ext}`);
  mkdirSync(dir, { recursive: true });
  if (existsSync3(outPath)) {
    console.warn(`Already exists: ${outPath}`);
    return false;
  }
  const code = `import React from 'react'

interface ${pascal}Props {
  className?: string
  children?: React.ReactNode
}

export default function ${pascal}({ className = '', children }: ${pascal}Props) {
  return (
    <div className={className}>
      {children ?? <p>${pascal} component</p>}
    </div>
  )
}
`;
  await Bun.write(outPath, code);
  console.log(`  \x1B[32m\u2713\x1B[0m  Created src/components/${pascal}${ext}`);
  return outPath;
}
async function createPage(name, root, ext) {
  const parts = name.split("/");
  const pageName = toPascalCase(parts[parts.length - 1]);
  const dir = join3(root, "src", "pages", ...parts.slice(0, -1));
  const fileName = pageName.toLowerCase() === "index" ? "index" : pageName.toLowerCase();
  const outPath = join3(dir, `${fileName}${ext}`);
  const route = `/${name.toLowerCase()}`;
  mkdirSync(dir, { recursive: true });
  if (existsSync3(outPath)) {
    console.warn(`Already exists: ${outPath}`);
    return false;
  }
  const code = `// Route: ${route}
import React from 'react'
import { Link } from 'bertui/router'

export const title = '${pageName}'
export const description = '${pageName} page'

export default function ${pageName}Page() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>${pageName}</h1>
      <p>Welcome to ${pageName}</p>
      <Link to="/">\u2190 Back home</Link>
    </main>
  )
}
`;
  await Bun.write(outPath, code);
  console.log(`  \x1B[32m\u2713\x1B[0m  Created src/pages/${name}${ext}  (route: ${route})`);
  return outPath;
}
async function createLayout(name, root, ext) {
  const pascal = toPascalCase(name);
  const dir = join3(root, "src", "layouts");
  const outPath = join3(dir, `${name.toLowerCase()}${ext}`);
  mkdirSync(dir, { recursive: true });
  if (existsSync3(outPath)) {
    console.warn(`Already exists: ${outPath}`);
    return false;
  }
  const code = `import React from 'react'

interface ${pascal}LayoutProps {
  children: React.ReactNode
}

export default function ${pascal}Layout({ children }: ${pascal}LayoutProps) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
        <a href="/" style={{ fontWeight: 700, textDecoration: 'none', color: 'inherit' }}>
          My App
        </a>
      </header>
      <main style={{ padding: '2rem' }}>
        {children}
      </main>
      <footer style={{ padding: '1rem 2rem', borderTop: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '14px', textAlign: 'center' }}>
        Built with BertUI \u26A1
      </footer>
    </div>
  )
}
`;
  await Bun.write(outPath, code);
  const scope = name.toLowerCase() === "default" ? "ALL pages" : `/${name.toLowerCase()}/ pages`;
  console.log(`  \x1B[32m\u2713\x1B[0m  Created src/layouts/${name.toLowerCase()}${ext}  (wraps ${scope})`);
  return outPath;
}
async function createLoading(name, root, ext) {
  const pascal = toPascalCase(name);
  const isRoot = name.toLowerCase() === "root" || name === "/";
  const dir = isRoot ? join3(root, "src", "pages") : join3(root, "src", "pages", name.toLowerCase());
  const outPath = join3(dir, `loading${ext}`);
  mkdirSync(dir, { recursive: true });
  if (existsSync3(outPath)) {
    console.warn(`Already exists: ${outPath}`);
    return false;
  }
  const code = `import React from 'react'

export default function ${pascal}Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', fontFamily: 'system-ui' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading ${pascal}...</p>
    </div>
  )
}
`;
  await Bun.write(outPath, code);
  console.log(`  \x1B[32m\u2713\x1B[0m  Created loading state for ${isRoot ? "/" : `/${name.toLowerCase()}`}`);
  return outPath;
}
async function createMiddleware(root, ts) {
  const ext = ts ? ".ts" : ".js";
  const outPath = join3(root, "src", `middleware${ext}`);
  if (existsSync3(outPath)) {
    console.warn(`Already exists: ${outPath}`);
    return false;
  }
  const code = ts ? `import type { MiddlewareContext } from '@bertui/core'

// Runs before every page request
export async function onRequest(ctx: MiddlewareContext) {
  // Example: protect /dashboard
  // if (ctx.pathname.startsWith('/dashboard')) {
  //   const token = ctx.headers['authorization']
  //   if (!token) return ctx.redirect('/login')
  // }
  console.log('[Middleware]', ctx.method, ctx.pathname)
}

export async function onError(ctx: MiddlewareContext, error: Error) {
  console.error('[Middleware Error]', error.message)
}
` : `// Runs before every page request
export async function onRequest(ctx) {
  console.log('[Middleware]', ctx.method, ctx.pathname)
}
`;
  await Bun.write(outPath, code);
  console.log(`  \x1B[32m\u2713\x1B[0m  Created src/middleware${ext}`);
  return outPath;
}
function parseCreateArgs(args) {
  const [type, name] = args;
  if (!type) {
    console.error("Usage: bertui create <type> [name]");
    return null;
  }
  if (type !== "middleware" && !name) {
    console.error(`Usage: bertui create ${type} <name>`);
    return null;
  }
  return { type, name: name ?? type };
}
var init_scaffold = __esm(() => {
  init_src();
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
import { readFileSync as readFileSync2, existsSync as existsSync4 } from "fs";
import { join as join4, dirname as dirname2, relative as relative3 } from "path";
import { createHash as createHash2 } from "crypto";
import { join as join22, extname } from "path";
import { readdirSync as readdirSync3 } from "fs";
import { join as join32, extname as extname2, relative as relative22, dirname as dirname22 } from "path";
import { existsSync as existsSync22, mkdirSync as mkdirSync2, readdirSync as readdirSync22, statSync as statSync22 } from "fs";
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
  const { join: join5 } = await import("path");
  const { existsSync: existsSync5 } = await import("fs");
  const configPath = join5(root, "bertui.config.js");
  if (!existsSync5(configPath))
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
  const envPath = join4(root, ".env");
  const envVars = {};
  if (!existsSync4(envPath))
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
    const abs = compiledDir ? join4(compiledDir, alias) : join4(projectRoot, relPath);
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
    let rel = relative3(currentDir, absBase + rest).replace(/\\/g, "/");
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
    for (const entry of readdirSync3(dir, { withFileTypes: true })) {
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
  const routerPath = join32(compiledDir, "router.js");
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
  mkdirSync2(dirname22(outPath), { recursive: true });
  await Bun.write(outPath, compiled);
}
async function compileDirectory(opts) {
  const { srcDir, outDir, root, envVars = {}, aliasMap = new Map, env = "development", skip = ["api", "templates"] } = opts;
  let files = 0;
  for (const entry of readdirSync22(srcDir)) {
    const srcPath = join32(srcDir, entry);
    const stat = statSync22(srcPath);
    if (stat.isDirectory()) {
      if (skip.includes(entry))
        continue;
      const subOut = join32(outDir, entry);
      mkdirSync2(subOut, { recursive: true });
      const sub = await compileDirectory({ ...opts, srcDir: srcPath, outDir: subOut });
      files += sub.files;
      continue;
    }
    const ext = extname2(entry);
    if (ext === ".css")
      continue;
    if (![".jsx", ".tsx", ".ts", ".js"].includes(ext))
      continue;
    const outPath = join32(outDir, entry.replace(/\.(jsx|tsx|ts)$/, ".js"));
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
  const compiledDir = isProd ? join32(root, ".bertuibuild") : join32(root, ".bertui", "compiled");
  mkdirSync2(compiledDir, { recursive: true });
  const envVars = loadEnvVariables2(root);
  const importhow = config2.importhow ?? {};
  const aliasMap = buildAliasMap2(importhow, root, compiledDir);
  const srcDir = join32(root, "src");
  const pagesDir = join32(srcDir, "pages");
  const start = Date.now();
  const stats = await compileDirectory({ srcDir, outDir: compiledDir, root, envVars, aliasMap, env });
  for (const [alias, relPath] of Object.entries(importhow)) {
    const absSrcDir = join32(root, relPath);
    if (!existsSync22(absSrcDir))
      continue;
    const aliasOutDir = join32(compiledDir, alias);
    mkdirSync2(aliasOutDir, { recursive: true });
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

// ../dev/dist/index.js
var exports_dist2 = {};
__export(exports_dist2, {
  setupFileWatcher: () => setupFileWatcher,
  invalidateImportMap: () => invalidateImportMap,
  buildDevImportMap: () => buildDevImportMap
});
import { join as join5, extname as extname3 } from "path";
import { existsSync as existsSync5, readdirSync as readdirSync4, statSync as statSync3 } from "fs";
async function buildDevImportMap(root) {
  const pkgJsonPath = join5(root, "package.json");
  const nodeModulesDir = join5(root, "node_modules");
  let currentMtime = null;
  try {
    currentMtime = statSync3(pkgJsonPath).mtimeMs;
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
  if (existsSync5(nodeModulesDir)) {
    for (const pkg of readdirSync4(nodeModulesDir)) {
      if (SKIP.has(pkg) || pkg.startsWith("."))
        continue;
      const pkgDir = join5(nodeModulesDir, pkg);
      const pkgJsonFile = join5(pkgDir, "package.json");
      try {
        if (!statSync3(pkgDir).isDirectory())
          continue;
        if (!existsSync5(pkgJsonFile))
          continue;
        const pkgJson = JSON.parse(await Bun.file(pkgJsonFile).text());
        const entries = [pkgJson["module"], pkgJson["browser"], pkgJson["main"], "index.js"].filter((e) => typeof e === "string");
        for (const entry of entries) {
          if (existsSync5(join5(pkgDir, entry))) {
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
  const srcDir = join5(root, "src");
  const pkgJson = join5(root, "package.json");
  if (!existsSync5(srcDir))
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
  const { watch } = __require2("fs");
  const srcWatcher = watch(srcDir, { recursive: true }, async (_evt, filename) => {
    if (!filename)
      return;
    if (!WATCHED_EXTS.has(extname3(filename)))
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
  if (existsSync5(pkgJson)) {
    try {
      lastMtime = statSync3(pkgJson).mtimeMs;
    } catch {}
    pkgWatcher = watch(pkgJson, async () => {
      try {
        const newMtime = statSync3(pkgJson).mtimeMs;
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
var __require2, _cachedMap = null, _cachedMtime = null;
var init_dist2 = __esm(() => {
  __require2 = import.meta.require;
});

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
  var readFileSync3 = (path) => {
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
    readFileSync: readFileSync3,
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
  var { LDD_PATH, SELF_PATH, readFile, readFileSync: readFileSync3 } = require_filesystem();
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
      const lddContent = readFileSync3(LDD_PATH);
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
      const selfContent = readFileSync3(SELF_PATH);
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
      const lddContent = readFileSync3(LDD_PATH);
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

// ../../node_modules/.bun/lightningcss@1.32.0/node_modules/lightningcss/node/index.mjs
var import__, transform2, transformStyleAttribute, bundle, bundleAsync, browserslistToTargets, composeVisitors, Features;
var init_node = __esm(() => {
  import__ = __toESM(require_node(), 1);
  ({ transform: transform2, transformStyleAttribute, bundle, bundleAsync, browserslistToTargets, composeVisitors, Features } = import__.default);
});

// ../css/dist/index.js
import { join as join6 } from "path";
import { existsSync as existsSync6, readdirSync as readdirSync5, mkdirSync as mkdirSync3 } from "fs" with { type: "json" };
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
function fallbackMinify(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").replace(/;}/g, "}").trim();
}
async function buildAllCSS(root, outDir) {
  const srcStylesDir = join6(root, "src", "styles");
  const stylesOutDir = join6(outDir, "styles");
  mkdirSync3(stylesOutDir, { recursive: true });
  let combined = "";
  if (existsSync6(srcStylesDir)) {
    const cssFiles = readdirSync5(srcStylesDir).filter((f) => f.endsWith(".css") && !f.endsWith(".module.css"));
    for (const file of cssFiles) {
      const content = await Bun.file(join6(srcStylesDir, file)).text();
      combined += `/* ${file} */
${content}

`;
    }
  }
  const minified = combined.trim() ? await minifyCSS(combined, { filename: "bertui.min.css" }) : "/* No CSS */";
  await Bun.write(join6(stylesOutDir, "bertui.min.css"), minified);
}
var DEFAULT_TARGETS;
var init_dist3 = __esm(() => {
  init_node();
  DEFAULT_TARGETS = {
    chrome: 90 << 16,
    firefox: 88 << 16,
    safari: 14 << 16,
    edge: 90 << 16
  };
});

// ../images/dist/index.js
import { join as join7, extname as extname5 } from "path";
import { existsSync as existsSync7, readdirSync as readdirSync6, statSync as statSync4, mkdirSync as mkdirSync4, cpSync } from "fs";
import { createHash as createHash3 } from "crypto";

class BertuiCache3 {
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
    const hash = createHash3("md5").update(css).digest("hex");
    return this.cssCache.get(hash) ?? null;
  }
  setCSS(css, result) {
    const hash = createHash3("md5").update(css).digest("hex");
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
function isImageFile(filename) {
  return IMAGE_EXTENSIONS.has(extname5(filename).toLowerCase());
}
function copyImagesSync(srcDir, destDir) {
  let copied = 0;
  let skipped = 0;
  if (!existsSync7(srcDir))
    return { copied, skipped };
  mkdirSync4(destDir, { recursive: true });
  function process2(dir, targetDir) {
    for (const entry of readdirSync6(dir, { withFileTypes: true })) {
      const src = join7(dir, entry.name);
      const dest = join7(targetDir, entry.name);
      if (entry.isDirectory()) {
        mkdirSync4(dest, { recursive: true });
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
var globalCache3, IMAGE_EXTENSIONS;
var init_dist4 = __esm(() => {
  globalCache3 = new BertuiCache3;
  IMAGE_EXTENSIONS = new Set([
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
});

// ../ssg/dist/index.js
import { join as join8 } from "path";
import { existsSync as existsSync8 } from "fs";
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
async function renderPageToHTML(compiledPagePath, _buildDir) {
  try {
    const projectRoot = compiledPagePath.split(".bertuibuild")[0];
    const reactPath = join8(projectRoot, "node_modules", "react", "index.js");
    const reactDomServerPath = join8(projectRoot, "node_modules", "react-dom", "server.js");
    if (!existsSync8(reactPath) || !existsSync8(reactDomServerPath))
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
var BANNED_HOOKS, BANNED_EVENTS, VOID_ELEMENTS;
var init_dist5 = __esm(() => {
  BANNED_HOOKS = [
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
  BANNED_EVENTS = [
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
  VOID_ELEMENTS = new Set([
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
});

// src/build.ts
var exports_build = {};
__export(exports_build, {
  buildProduction: () => buildProduction
});
import { join as join9, relative as relative4 } from "path";
import { existsSync as existsSync9, mkdirSync as mkdirSync5, rmSync } from "fs";
function step(n, label) {
  process.stdout.write(`  \x1B[90m[${String(n).padStart(2, " ")}/${TOTAL_STEPS}]\x1B[0m \x1B[36m\u2838\x1B[0m  ${label}
`);
}
function done(label, detail = "") {
  process.stdout.write(`  \x1B[90m[  ]\x1B[0m \x1B[32m\u2713\x1B[0m  ${label}${detail ? `  \x1B[90m${detail}\x1B[0m` : ""}
`);
}
function fail(label, detail = "") {
  process.stdout.write(`  \x1B[90m[  ]\x1B[0m \x1B[31m\u2717\x1B[0m  ${label}  \x1B[31m${detail}\x1B[0m
`);
}
async function buildProduction(options) {
  const { root } = options;
  const buildDir = join9(root, ".bertuibuild");
  const outDir = join9(root, "dist");
  const start = Date.now();
  process.env["NODE_ENV"] = "production";
  if (existsSync9(buildDir))
    rmSync(buildDir, { recursive: true, force: true });
  if (existsSync9(outDir))
    rmSync(outDir, { recursive: true, force: true });
  mkdirSync5(buildDir, { recursive: true });
  mkdirSync5(outDir, { recursive: true });
  try {
    step(1, "Loading config & env");
    const config2 = await loadConfig(root);
    const envVars = loadEnvVariables(root);
    done("Loading config & env", `${Object.keys(envVars).length} env vars`);
    step(2, "Compiling");
    const { routes } = await compileProject(root, { env: "production" });
    done("Compiling", `${routes.length} routes`);
    step(3, "Validating server islands");
    const { serverIslands, validationResults } = await validateAllServerIslands(routes);
    const invalid = validationResults.filter((r) => !r.valid);
    if (invalid.length > 0) {
      for (const r of invalid) {
        fail("Validation", `${r.route}: ${r.errors[0]}`);
      }
      throw new Error(`${invalid.length} server island(s) failed validation`);
    }
    done("Validating server islands", `${serverIslands.length} islands`);
    step(4, "Processing CSS");
    await buildAllCSS(root, outDir);
    done("Processing CSS");
    step(5, "Static assets");
    const publicDir = join9(root, "public");
    if (existsSync9(publicDir))
      copyImagesSync(publicDir, outDir);
    done("Static assets");
    step(6, "Bundling JS");
    const bundleResult = await bundleJS(root, buildDir, outDir, envVars);
    done("Bundling JS", `${bundleResult.sizeKB} KB`);
    step(7, "Generating HTML");
    await generateAllHTML(root, outDir, bundleResult.bundlePath, routes, config2, buildDir);
    done("Generating HTML", `${routes.length} pages`);
    step(8, "Sitemap & robots");
    if (config2.baseUrl && config2.baseUrl !== "http://localhost:3000") {
      await generateSitemap(routes, config2.baseUrl, outDir);
      await generateRobots(config2, outDir);
      done("Sitemap & robots");
    } else {
      done("Sitemap & robots", "skipped (no baseUrl)");
    }
    step(9, "Cleanup");
    if (existsSync9(buildDir))
      rmSync(buildDir, { recursive: true, force: true });
    done("Cleanup");
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    process.stdout.write(`
  \x1B[32m\x1B[1m\u2713 Done  ${duration}s\x1B[0m
`);
    process.stdout.write(`  \x1B[90mOutput\x1B[0m   dist/

`);
    process.exit(0);
  } catch (err) {
    const msg = err.message;
    fail("Build failed", msg);
    if (existsSync9(buildDir))
      rmSync(buildDir, { recursive: true, force: true });
    process.exit(1);
  }
}
async function bundleJS(root, buildDir, outDir, envVars) {
  const buildEntry = join9(buildDir, "main.js");
  if (!existsSync9(buildEntry)) {
    throw new Error("main.js not found in build dir \u2014 ensure src/main.jsx exists");
  }
  const cssModulePlugin = {
    name: "css-modules",
    setup(build) {
      build.onLoad({ filter: /\.module\.css$/ }, () => ({
        contents: "export default new Proxy({}, { get: (_, k) => k });",
        loader: "js"
      }));
      build.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
    }
  };
  const originalCwd = process.cwd();
  process.chdir(buildDir);
  try {
    const result = await Bun.build({
      entrypoints: [buildEntry],
      outdir: join9(outDir, "assets"),
      target: "browser",
      format: "esm",
      plugins: [cssModulePlugin],
      minify: { whitespace: true, syntax: true, identifiers: true },
      splitting: true,
      sourcemap: "external",
      naming: {
        entry: "js/[name]-[hash].js",
        chunk: "js/chunks/[name]-[hash].js"
      },
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "@bunnyx/api"],
      define: {
        "process.env.NODE_ENV": '"production"',
        ...Object.fromEntries(Object.entries(envVars).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)]))
      }
    });
    if (!result.success) {
      const msgs = (result.logs ?? []).map((l) => l?.message ?? l?.text ?? "").join(`
`);
      throw new Error(`Bundle failed
${msgs}`);
    }
    const mainOutput = result.outputs.find((o) => o.path.includes("main") && o.kind === "entry-point");
    const totalSize = result.outputs.reduce((a, o) => a + (o.size ?? 0), 0);
    const bundlePath = mainOutput ? relative4(outDir, mainOutput.path).replace(/\\/g, "/") : "assets/js/main.js";
    return { bundlePath, sizeKB: (totalSize / 1024).toFixed(1) };
  } finally {
    process.chdir(originalCwd);
  }
}
async function generateAllHTML(root, outDir, bundlePath, routes, config2, buildDir) {
  const { mkdirSync: mkdirSync6 } = await import("fs");
  const importMapScript = `<script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19.0.0",
      "react-dom": "https://esm.sh/react-dom@19.0.0",
      "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
      "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
      "@bunnyx/api": "/bunnyx-api/api-client.js"
    }
  }
  </script>`;
  for (const route of routes) {
    try {
      const sourceCode = await Bun.file(route.path).text();
      const pageMeta = extractMetaFromSource(sourceCode);
      const meta = { ...config2.meta, ...pageMeta };
      const renderMode = await getRenderMode(route.path);
      let bodyContent = '<div id="root"></div>';
      let includeBundle = true;
      if (renderMode === "static" || renderMode === "server") {
        const compiledPath = join9(buildDir, "pages", route.file.replace(/\.(jsx|tsx|ts)$/, ".js"));
        if (existsSync9(compiledPath)) {
          const ssrHTML = await renderPageToHTML(compiledPath, buildDir);
          if (ssrHTML) {
            bodyContent = renderMode === "static" ? ssrHTML : `<div id="root">${ssrHTML}</div>`;
            includeBundle = renderMode === "server";
          }
        }
      }
      const html = `<!DOCTYPE html>
<html lang="${meta.lang ?? "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title ?? "BertUI App"}</title>
  <meta name="description" content="${meta.description ?? ""}">
  ${meta.keywords ? `<meta name="keywords" content="${meta.keywords}">` : ""}
  ${meta.author ? `<meta name="author" content="${meta.author}">` : ""}
  ${meta.themeColor ? `<meta name="theme-color" content="${meta.themeColor}">` : ""}
  ${meta.ogTitle ? `<meta property="og:title" content="${meta.ogTitle}">` : ""}
  ${meta.ogImage ? `<meta property="og:image" content="${meta.ogImage}">` : ""}
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${includeBundle ? importMapScript : ""}
</head>
<body>
  ${bodyContent}
  ${includeBundle ? `<script type="module" src="/${bundlePath}"></script>` : ""}
</body>
</html>`;
      let htmlPath;
      if (route.route === "/") {
        htmlPath = join9(outDir, "index.html");
      } else {
        const routeDir = join9(outDir, route.route.replace(/^\//, ""));
        mkdirSync6(routeDir, { recursive: true });
        htmlPath = join9(routeDir, "index.html");
      }
      await Bun.write(htmlPath, html);
    } catch (err) {
      process.stdout.write(`  \x1B[33m\u26A0\x1B[0m  HTML failed for ${route.route}: ${err.message}
`);
    }
  }
}
async function generateSitemap(routes, baseUrl, outDir) {
  const base = baseUrl.replace(/\/$/, "");
  const date = new Date().toISOString().split("T")[0];
  const staticR = routes.filter((r) => r.type === "static");
  const urls = staticR.map((r) => {
    const priority = r.route === "/" ? "1.0" : r.route.split("/").filter(Boolean).length === 1 ? "0.8" : "0.6";
    return `  <url>
    <loc>${base}${r.route}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join(`
`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  await Bun.write(join9(outDir, "sitemap.xml"), xml);
}
async function generateRobots(config2, outDir) {
  const base = config2.baseUrl.replace(/\/$/, "");
  let txt = `# BertUI Generated robots.txt
User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
  if (config2.robots?.disallow?.length) {
    txt += `
`;
    for (const path of config2.robots.disallow)
      txt += `Disallow: ${path}
`;
  }
  if (config2.robots?.crawlDelay) {
    txt += `
Crawl-delay: ${config2.robots.crawlDelay}
`;
  }
  await Bun.write(join9(outDir, "robots.txt"), txt);
}
var TOTAL_STEPS = 9;
var init_build = __esm(() => {
  init_dist();
  init_dist3();
  init_dist4();
  init_src();
  init_dist5();
  init_src();
});

// src/index.ts
import { join as join10 } from "path";
async function program() {
  const args = process.argv.slice(2);
  const command = args[0] ?? "dev";
  switch (command) {
    case "dev": {
      const port = parseInt(getArg("--port", "-p") ?? "3000");
      await runDev({ port, root: process.cwd() });
      break;
    }
    case "build": {
      await runBuild({ root: process.cwd() });
      break;
    }
    case "serve":
    case "preview": {
      const port = parseInt(getArg("--port", "-p") ?? "5000");
      await runServe({ port, root: process.cwd() });
      break;
    }
    case "analyze": {
      const { analyzeBuild: analyzeBuild2 } = await Promise.resolve().then(() => (init_analyze(), exports_analyze));
      await analyzeBuild2(join10(process.cwd(), "dist"), { open: args.includes("--open") });
      break;
    }
    case "create": {
      const { scaffold: scaffold2, parseCreateArgs: parseCreateArgs2 } = await Promise.resolve().then(() => (init_scaffold(), exports_scaffold));
      const parsed = parseCreateArgs2(args.slice(1));
      if (parsed)
        await scaffold2(parsed.type, parsed.name, { root: process.cwd() });
      break;
    }
    case "--version":
    case "-v":
      console.log("bertui v2.0.0");
      break;
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
  }
}
async function runDev(options) {
  const { root, port } = options;
  const { compileProject: compileProject2 } = await Promise.resolve().then(() => (init_dist(), exports_dist));
  const { buildDevImportMap: buildDevImportMap2, setupFileWatcher: setupFileWatcher2 } = await Promise.resolve().then(() => (init_dist2(), exports_dist2));
  const { loadConfig: loadConfig3 } = await Promise.resolve().then(() => (init_src(), exports_src));
  const config2 = await loadConfig3(root);
  const compiledDir = join10(root, ".bertui", "compiled");
  const clients = new Set;
  function notifyClients(msg) {
    for (const c of clients) {
      try {
        c.send(JSON.stringify(msg));
      } catch {
        clients.delete(c);
      }
    }
  }
  printHeader("DEV");
  console.log("  [ 1/4 ] Compiling...");
  await compileProject2(root, { env: "development" });
  console.log("  [ 2/4 ] Building import map...");
  const importMap = await buildDevImportMap2(root);
  console.log("  [ 3/4 ] Setting up file watcher...");
  const stopWatcher = setupFileWatcher2({
    root,
    compiledDir,
    notifyClients: (msg) => notifyClients(msg)
  });
  console.log("  [ 4/4 ] Starting server...");
  const server = Bun.serve({
    port,
    async fetch(req, server2) {
      const url = new URL(req.url);
      if (url.pathname === "/__hmr") {
        const ok = server2.upgrade(req);
        if (ok)
          return;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      if (url.pathname === "/" || !url.pathname.includes(".") && !url.pathname.startsWith("/compiled")) {
        const meta = config2.meta;
        const html = `<!DOCTYPE html>
<html lang="${meta.lang ?? "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title ?? "BertUI App"}</title>
  <link rel="stylesheet" href="/styles/bertui.min.css">
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    const ws = new WebSocket('ws://localhost:${port}/__hmr');
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'reload') location.reload();
      if (d.type === 'importmap-updated') location.reload();
      if (d.type === 'compilation-error' && window.__BERTUI_SHOW_ERROR__) window.__BERTUI_SHOW_ERROR__(d);
    };
  </script>
  <script src="/error-overlay.js"></script>
  <script type="module" src="/compiled/main.js"></script>
</body>
</html>`;
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }
      if (url.pathname.startsWith("/compiled/")) {
        const file = Bun.file(join10(compiledDir, url.pathname.replace("/compiled/", "")));
        if (await file.exists()) {
          return new Response(file, {
            headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" }
          });
        }
      }
      if (url.pathname.startsWith("/styles/")) {
        const file = Bun.file(join10(root, ".bertui", "styles", url.pathname.replace("/styles/", "")));
        if (await file.exists()) {
          return new Response(file, { headers: { "Content-Type": "text/css", "Cache-Control": "no-store" } });
        }
      }
      if (url.pathname.startsWith("/node_modules/")) {
        const file = Bun.file(join10(root, "node_modules", url.pathname.replace("/node_modules/", "")));
        if (await file.exists())
          return new Response(file, { headers: { "Cache-Control": "no-cache" } });
      }
      const pubFile = Bun.file(join10(root, "public", url.pathname.slice(1)));
      if (await pubFile.exists())
        return new Response(pubFile);
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      message() {}
    }
  });
  process.stdout.write(`
  \x1B[1m\x1B[32m\u25B6  Ready on http://localhost:${port}\x1B[0m

`);
  process.on("SIGINT", () => {
    stopWatcher();
    server.stop();
    process.exit(0);
  });
}
async function runBuild(options) {
  printHeader("BUILD");
  const { buildProduction: buildProduction2 } = await Promise.resolve().then(() => (init_build(), exports_build));
  await buildProduction2(options);
}
async function runServe(options) {
  const { root, port } = options;
  const distDir = join10(root, "dist");
  if (!Bun.file(join10(distDir, "index.html")).existsSync?.()) {
    console.error("  dist/ not found \u2014 run: bertui build");
    process.exit(1);
  }
  console.log(`
  Preview running at http://localhost:${port}`);
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      let filePath = join10(distDir, url.pathname);
      if (url.pathname === "/")
        filePath = join10(distDir, "index.html");
      if (!filePath.includes(".")) {
        const idx = join10(filePath, "index.html");
        if (Bun.file(idx).existsSync?.())
          filePath = idx;
      }
      const file = Bun.file(filePath);
      if (await file.exists())
        return new Response(file);
      const spa = Bun.file(join10(distDir, "index.html"));
      if (await spa.exists())
        return new Response(spa, { headers: { "Content-Type": "text/html" } });
      return new Response("Not found", { status: 404 });
    }
  });
}
function getArg(long, short) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(long) !== -1 ? args.indexOf(long) : args.indexOf(short);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
function printHeader(mode) {
  const BIG = [
    "  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2557",
    "  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551",
    "  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D   \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551",
    "  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551",
    "  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551   \u2588\u2588\u2551   \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551",
    "  \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D   \u255A\u2550\u255D    \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D"
  ];
  process.stdout.write(`
\x1B[36m\x1B[1m`);
  for (const row of BIG)
    process.stdout.write(row + `
`);
  process.stdout.write(`\x1B[0m\x1B[90m  by Pease Ernest  \xB7  \x1B[0m\x1B[1m${mode}\x1B[0m

`);
}
function showHelp() {
  console.log(`
Commands:
  bertui dev [--port]     Start dev server (default: 3000)
  bertui build            Production build
  bertui serve [--port]   Preview build (default: 5000)
  bertui analyze          Bundle analyzer
  bertui create <type>    Scaffold component/page/layout/middleware
  `);
}
export {
  program
};
