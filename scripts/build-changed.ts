#!/usr/bin/env bun
import { execSync } from 'child_process'
import { existsSync } from 'fs'

// Get changed packages since last commit
let since = 'HEAD~1'
const args = process.argv.slice(2)
if (args[0] === '--since' && args[1]) since = args[1]

const changed = execSync(`git diff --name-only ${since}`)
  .toString()
  .split('\n')
  .filter(f => f.startsWith('packages/'))
  .map(f => f.split('/')[1])
  .filter((v, i, a) => a.indexOf(v) === i)

if (changed.length === 0) {
  console.log('No packages changed, skipping build')
  process.exit(0)
}

console.log('Changed packages:', changed)

// Dependency order (packages that others depend on come first)
const order = ['core', 'compiler', 'dev', 'css', 'images', 'router', 'ssg', 'cli', 'bertui', 'elysia']

// Build in order
for (const pkg of order) {
  const needsBuild = changed.includes(pkg) || 
    (pkg === 'compiler' && changed.includes('core')) ||
    (pkg === 'dev' && changed.includes('core')) ||
    (pkg === 'cli' && (changed.includes('core') || changed.includes('compiler') || changed.includes('dev'))) ||
    (pkg === 'bertui' && changed.some(p => order.slice(0, order.indexOf('bertui')).includes(p)))
  
  if (needsBuild && existsSync(`packages/${pkg}`)) {
    console.log(`\n📦 Building ${pkg}...`)
    try {
      execSync(`cd packages/${pkg} && bun run build`, { stdio: 'inherit' })
    } catch (err) {
      console.error(`❌ Failed to build ${pkg}`)
      process.exit(1)
    }
  }
}

console.log('\n✅ Build complete')