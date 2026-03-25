// @bun
var __require = import.meta.require;

// src/index.ts
import { join, extname } from "path";
import { existsSync, readdirSync, statSync } from "fs";
var _cachedMap = null;
var _cachedMtime = null;
async function buildDevImportMap(root) {
  const pkgJsonPath = join(root, "package.json");
  const nodeModulesDir = join(root, "node_modules");
  let currentMtime = null;
  try {
    currentMtime = statSync(pkgJsonPath).mtimeMs;
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
  if (existsSync(nodeModulesDir)) {
    for (const pkg of readdirSync(nodeModulesDir)) {
      if (SKIP.has(pkg) || pkg.startsWith("."))
        continue;
      const pkgDir = join(nodeModulesDir, pkg);
      const pkgJsonFile = join(pkgDir, "package.json");
      try {
        if (!statSync(pkgDir).isDirectory())
          continue;
        if (!existsSync(pkgJsonFile))
          continue;
        const pkgJson = JSON.parse(await Bun.file(pkgJsonFile).text());
        const entries = [pkgJson["module"], pkgJson["browser"], pkgJson["main"], "index.js"].filter((e) => typeof e === "string");
        for (const entry of entries) {
          if (existsSync(join(pkgDir, entry))) {
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
  const srcDir = join(root, "src");
  const pkgJson = join(root, "package.json");
  if (!existsSync(srcDir))
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
    if (!WATCHED_EXTS.has(extname(filename)))
      return;
    if (debounce)
      clearTimeout(debounce);
    debounce = setTimeout(async () => {
      if (isRecompiling)
        return;
      isRecompiling = true;
      notifyClients({ type: "recompiling" });
      try {
        const { compileProject } = await import("@bertui/compiler");
        await compileProject(root, { env: "development" });
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
  if (existsSync(pkgJson)) {
    try {
      lastMtime = statSync(pkgJson).mtimeMs;
    } catch {}
    pkgWatcher = watch(pkgJson, async () => {
      try {
        const newMtime = statSync(pkgJson).mtimeMs;
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
export {
  setupFileWatcher,
  invalidateImportMap,
  buildDevImportMap
};
