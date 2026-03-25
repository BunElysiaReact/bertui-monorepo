#!/usr/bin/env bun
import { join, mkdirSync, existsSync } from 'fs'
import { writeFile } from 'fs/promises'

const name = process.argv[2]
if (!name) {
  console.error('Usage: bun new-package <name>')
  process.exit(1)
}

const pkgDir = join(process.cwd(), 'packages', name)

if (existsSync(pkgDir)) {
  console.error(`❌ Package ${name} already exists`)
  process.exit(1)
}

mkdirSync(pkgDir, { recursive: true })
mkdirSync(join(pkgDir, 'src'), { recursive: true })

// package.json
await writeFile(join(pkgDir, 'package.json'), JSON.stringify({
  name: `@bertui/${name}`,
  version: '2.0.0',
  type: 'module',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  scripts: {
    build: 'bun build ./src/index.ts --outdir ./dist --target bun --format esm',
    typecheck: 'tsc --noEmit'
  },
  peerDependencies: {
    react: '^19.0.0'
  },
  devDependencies: {
    '@types/react': '^19.0.0',
    typescript: '^6.0.0'
  }
}, null, 2))

// src/index.ts
await writeFile(join(pkgDir, 'src', 'index.ts'), `// @bertui/${name}
import type { ReactNode } from 'react'

export interface ${name}Props {
  children?: ReactNode
  className?: string
}

export function ${name}({ children, className = '' }: ${name}Props) {
  return (
    <div className={className}>
      {children || <p>${name} component</p>}
    </div>
  )
}

export default ${name}
`)

// tsconfig.json
await writeFile(join(pkgDir, 'tsconfig.json'), JSON.stringify({
  extends: '../../tsconfig.base.json',
  compilerOptions: {
    outDir: './dist',
    rootDir: './src',
    declaration: true,
    declarationMap: true
  },
  include: ['src/**/*']
}, null, 2))

// README.md
await writeFile(join(pkgDir, 'README.md'), `# @bertui/${name}

## Installation

\`\`\`bash
bun add @bertui/${name}
\`\`\`

## Usage

\`\`\`tsx
import { ${name} } from '@bertui/${name}'

function App() {
  return <${name}>Hello</${name}>
}
\`\`\`
`)

console.log(`✅ Created packages/${name}`)
console.log(`\nNext steps:`)
console.log(`  1. cd packages/${name}`)
console.log(`  2. bun run build`)
console.log(`  3. Add to OPTIONAL_FEATURES in packages/bertui/src/optional.ts if needed`)