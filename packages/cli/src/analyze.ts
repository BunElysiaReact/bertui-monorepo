// packages/cli/src/analyze.ts
// Bundle size analyzer — generates dist/bundle-report.html

import { join, relative, existsSync, readdirSync, statSync } from 'path'
import { formatBytes } from '@bertui/core'

interface FileEntry {
  name: string
  path: string
  size: number
  type: 'javascript' | 'css' | 'image' | 'sourcemap' | 'other'
  ext: string
}

export async function analyzeBuild(
  outDir: string,
  options: { open?: boolean; outputFile?: string } = {}
): Promise<{ outputFile: string; files: FileEntry[] } | null> {
  const { open = false, outputFile = join(outDir, 'bundle-report.html') } = options

  const assetsDir = join(outDir, 'assets')
  if (!existsSync(assetsDir)) {
    console.error('  No assets/ directory — run: bertui build')
    return null
  }

  const files = collectFiles(assetsDir, outDir)
  const html  = generateReport(files, outDir)

  await Bun.write(outputFile, html)
  console.log(`  \x1b[32m✓\x1b[0m  Bundle report: ${outputFile}`)

  if (open) {
    const { exec } = await import('child_process')
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    exec(`${cmd} "${outputFile}"`)
  }

  return { outputFile, files }
}

function collectFiles(assetsDir: string, outDir: string): FileEntry[] {
  const files: FileEntry[] = []

  function scan(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { scan(full); continue }
      const stat = statSync(full)
      const ext  = entry.name.split('.').pop() ?? ''
      files.push({
        name: entry.name,
        path: relative(outDir, full),
        size: stat.size,
        type: getType(ext),
        ext,
      })
    }
  }

  scan(assetsDir)
  files.sort((a, b) => b.size - a.size)
  return files
}

function getType(ext: string): FileEntry['type'] {
  if (['js', 'mjs'].includes(ext))                              return 'javascript'
  if (ext === 'css')                                            return 'css'
  if (ext === 'map')                                            return 'sourcemap'
  if (['png','jpg','jpeg','gif','svg','webp','avif'].includes(ext)) return 'image'
  return 'other'
}

const COLOR: Record<FileEntry['type'], string> = {
  javascript: '#3b82f6',
  css:        '#8b5cf6',
  sourcemap:  '#6b7280',
  image:      '#f59e0b',
  other:      '#10b981',
}

function generateReport(files: FileEntry[], outDir: string): string {
  const total  = files.reduce((s, f) => s + f.size, 0)
  const jsSize = files.filter(f => f.type === 'javascript').reduce((s, f) => s + f.size, 0)
  const cssSize= files.filter(f => f.type === 'css').reduce((s, f) => s + f.size, 0)
  const imgSize= files.filter(f => f.type === 'image').reduce((s, f) => s + f.size, 0)

  const rows = files.map(f => {
    const pct      = total > 0 ? ((f.size / total) * 100).toFixed(1) : '0'
    const barWidth = Math.max(2, Math.round((f.size / (files[0]?.size ?? 1)) * 200))
    const color    = COLOR[f.type]
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
    </tr>`
  }).join('')

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
      <span style="background:#10b981;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">⚡ BertUI</span>
    </div>
    <p style="color:#64748b;font-size:13px;margin-top:4px">Generated ${new Date().toLocaleString()} · ${outDir}</p>
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
<p class="footer">BertUI v2 · bundle-report.html</p>
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
</html>`
}
