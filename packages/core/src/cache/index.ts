// packages/core/src/cache/index.ts

import { createHash } from 'crypto'

interface CacheItem<T> {
  value: T
  timestamp: number
  lastAccessed: number
  ttl: number
  size: number
}

interface CacheOptions {
  ttl?: number
  logSpeed?: boolean
}

export class BertuiCache {
  private maxSize: number
  private defaultTTL: number
  private store = new Map<string, CacheItem<unknown>>()
  private fileCache = new Map<string, Buffer>()
  private fileTimestamps = new Map<string, number>()
  private cssCache = new Map<string, string>()
  private cleanupInterval: ReturnType<typeof setInterval>

  readonly stats = { hits: 0, misses: 0, sets: 0, evictions: 0 }

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize    = options.maxSize ?? 5000
    this.defaultTTL = options.ttl    ?? 30_000
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
  }

  get<T>(key: string, options: CacheOptions = {}): T | null {
    const item = this.store.get(key)
    if (!item) { this.stats.misses++; return null }

    const ttl = options.ttl ?? item.ttl
    if (Date.now() - item.timestamp > ttl) {
      this.store.delete(key)
      this.stats.misses++
      this.stats.evictions++
      return null
    }

    this.stats.hits++
    item.lastAccessed = Date.now()
    return item.value as T
  }

  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    this.store.set(key, {
      value,
      timestamp:    Date.now(),
      lastAccessed: Date.now(),
      ttl:  options.ttl ?? this.defaultTTL,
      size: this.getSize(value),
    })
    this.stats.sets++
    if (this.store.size > this.maxSize) this.evictLRU()
  }

  async getFile(filePath: string): Promise<Buffer | null> {
    const cacheKey = `file:${filePath}`
    try {
      const file   = Bun.file(filePath)
      const exists = await file.exists()
      if (!exists) return null

      const stats   = await file.stat()
      const mtime   = stats.mtimeMs
      const cached  = this.fileCache.get(cacheKey)
      const cachedT = this.fileTimestamps.get(cacheKey)

      if (cached && cachedT === mtime) return cached

      const buf = Buffer.from(await file.arrayBuffer())
      this.fileCache.set(cacheKey, buf)
      this.fileTimestamps.set(cacheKey, mtime)
      return buf
    } catch {
      return null
    }
  }

  getCSS(css: string): string | null {
    const hash = createHash('md5').update(css).digest('hex')
    return this.cssCache.get(hash) ?? null
  }

  setCSS(css: string, result: string): void {
    const hash = createHash('md5').update(css).digest('hex')
    this.cssCache.set(hash, result)
  }

  private getSize(value: unknown): number {
    if (typeof value === 'string') return value.length
    if (Buffer.isBuffer(value)) return value.length
    try { return JSON.stringify(value).length } catch { return 0 }
  }

  private evictLRU(): void {
    const entries = [...this.store.entries()]
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    const removeCount = Math.floor(this.maxSize * 0.2)
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      this.store.delete(entries[i]![0])
      this.stats.evictions++
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.store.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.store.delete(key)
        this.stats.evictions++
      }
    }
  }

  dispose(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
    this.fileCache.clear()
    this.fileTimestamps.clear()
    this.cssCache.clear()
  }
}

export const globalCache = new BertuiCache()
