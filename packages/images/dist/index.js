// @bun
var __require = import.meta.require;

// src/index.ts
import { join, extname } from "path";
import { existsSync, readdirSync, statSync, mkdirSync, cpSync } from "fs";
// ../core/src/utils/index.ts
function formatBytes(bytes) {
  if (bytes === 0)
    return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
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
var globalCache = new BertuiCache;
// src/index.ts
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
  return IMAGE_EXTENSIONS.has(extname(filename).toLowerCase());
}
function getImageContentType(ext) {
  const types2 = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon"
  };
  return types2[ext.toLowerCase()] ?? "application/octet-stream";
}
function copyImagesSync(srcDir, destDir) {
  let copied = 0;
  let skipped = 0;
  if (!existsSync(srcDir))
    return { copied, skipped };
  mkdirSync(destDir, { recursive: true });
  function process(dir, targetDir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const src = join(dir, entry.name);
      const dest = join(targetDir, entry.name);
      if (entry.isDirectory()) {
        mkdirSync(dest, { recursive: true });
        process(src, dest);
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
  process(srcDir, destDir);
  return { copied, skipped };
}
function getImageFiles(dir, baseDir = dir) {
  const images = [];
  if (!existsSync(dir))
    return images;
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      const relativePath = fullPath.replace(baseDir, "").replace(/^[/\\]/, "");
      if (entry.isDirectory())
        scan(fullPath);
      else if (entry.isFile() && isImageFile(entry.name)) {
        images.push({
          path: fullPath,
          relativePath,
          filename: entry.name,
          size: statSync(fullPath).size,
          ext: extname(entry.name).toLowerCase()
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
      const tmpIn = join(tmpdir(), `bertui-${Date.now()}.png`);
      const tmpOut = join(tmpdir(), `bertui-${Date.now()}-opt.png`);
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
var hasWasm = () => false;
export {
  optimizeImage,
  isImageFile,
  hasWasm,
  getImageFiles,
  getImageContentType,
  formatBytes,
  copyImagesSync,
  IMAGE_EXTENSIONS
};
