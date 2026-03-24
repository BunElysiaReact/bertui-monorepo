// packages/images/src/index.ts
// @bertui/images — image handling

import { join, extname } from 'path'
import { existsSync, readdirSync, statSync, mkdirSync, cpSync } from 'fs'
import type { ImageFile, ImageOptimizeResult } from '@bertui/core'
import { formatBytes } from '@bertui/core'

export const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
  '.avif', '.ico', '.bmp', '.tiff', '.tif',
])

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(filename).toLowerCase())
}

export function getImageContentType(ext: string): string {
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.avif': 'image/avif', '.ico': 'image/x-icon',
  }
  return types[ext.toLowerCase()] ?? 'application/octet-stream'
}

// ─── Copy ────────────────────────────────────────────────────────────────────

export function copyImagesSync(
  srcDir: string,
  destDir: string
): { copied: number; skipped: number } {
  let copied = 0
  let skipped = 0

  if (!existsSync(srcDir)) return { copied, skipped }
  mkdirSync(destDir, { recursive: true })

  function process(dir: string, targetDir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const src  = join(dir, entry.name)
      const dest = join(targetDir, entry.name)

      if (entry.isDirectory()) {
        mkdirSync(dest, { recursive: true })
        process(src, dest)
      } else if (entry.isFile() && isImageFile(entry.name)) {
        try { cpSync(src, dest); copied++ }
        catch { skipped++ }
      } else {
        skipped++
      }
    }
  }

  process(srcDir, destDir)
  return { copied, skipped }
}

// ─── Scan ────────────────────────────────────────────────────────────────────

export function getImageFiles(dir: string, baseDir = dir): ImageFile[] {
  const images: ImageFile[] = []
  if (!existsSync(dir)) return images

  function scan(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath     = join(directory, entry.name)
      const relativePath = fullPath.replace(baseDir, '').replace(/^[/\\]/, '')
      if (entry.isDirectory()) scan(fullPath)
      else if (entry.isFile() && isImageFile(entry.name)) {
        images.push({
          path: fullPath,
          relativePath,
          filename: entry.name,
          size: statSync(fullPath).size,
          ext:  extname(entry.name).toLowerCase(),
        })
      }
    }
  }

  scan(dir)
  return images
}

// ─── Optimize (WASM / oxipng fallback) ───────────────────────────────────────

export async function optimizeImage(
  buffer: ArrayBuffer,
  options: { format?: string; quality?: number } = {}
): Promise<ImageOptimizeResult> {
  const { format = 'auto', quality = 3 } = options
  const detected = format === 'auto' ? detectFormat(new Uint8Array(buffer)) : format
  const original_size = buffer.byteLength

  if (detected === 'png') {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const { writeFile, readFile, unlink } = await import('fs/promises')
      const { tmpdir } = await import('os')
      const execAsync = promisify(exec)

      const tmpIn  = join(tmpdir(), `bertui-${Date.now()}.png`)
      const tmpOut = join(tmpdir(), `bertui-${Date.now()}-opt.png`)

      await writeFile(tmpIn, Buffer.from(buffer))
      await execAsync(`oxipng -o ${quality} -s "${tmpIn}" -o "${tmpOut}"`)
      const optimized      = await readFile(tmpOut)
      const optimized_size = optimized.length

      await unlink(tmpIn).catch(() => {})
      await unlink(tmpOut).catch(() => {})

      return {
        data: optimized.buffer as ArrayBuffer,
        original_size,
        optimized_size,
        format: 'png',
        savings_percent: parseFloat(
          ((original_size - optimized_size) / original_size * 100).toFixed(1)
        ),
      }
    } catch { /* fall through to copy */ }
  }

  return { data: buffer, original_size, optimized_size: original_size, format: detected, savings_percent: 0 }
}

function detectFormat(buffer: Uint8Array): string {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length >= 8 && PNG_SIG.every((b, i) => buffer[i] === b)) return 'png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg'
  return 'unknown'
}

export const hasWasm = (): boolean => false
export { formatBytes }
