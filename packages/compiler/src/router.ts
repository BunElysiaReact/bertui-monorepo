// packages/compiler/src/router.ts
// Route discovery + router code generation

import { join, extname } from 'path'
import { readdirSync, statSync } from 'fs'
import type { Route } from '@bertui/core'

export async function discoverRoutes(pagesDir: string): Promise<Route[]> {
  const routes: Route[] = []

  function scan(dir: string, basePath = ''): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath     = join(dir, entry.name)
      const relativePath = join(basePath, entry.name)

      if (entry.isDirectory()) { scan(fullPath, relativePath); continue }

      const ext      = extname(entry.name)
      if (ext === '.css') continue
      if (!['.jsx', '.tsx', '.ts', '.js'].includes(ext)) continue

      const fileName = entry.name.replace(ext, '')
      if (fileName === 'loading') continue

      let route = '/' + relativePath.replace(/\\/g, '/').replace(ext, '')
      if (fileName === 'index') route = route.replace('/index', '') || '/'

      routes.push({
        route: route === '' ? '/' : route,
        file:  relativePath.replace(/\\/g, '/'),
        path:  fullPath,
        type:  fileName.includes('[') && fileName.includes(']') ? 'dynamic' : 'static',
      })
    }
  }

  scan(pagesDir)
  routes.sort((a, b) =>
    a.type === b.type ? a.route.localeCompare(b.route) : a.type === 'static' ? -1 : 1
  )
  return routes
}

export function generateRouterCode(routes: Route[]): string {
  const imports = routes
    .map((r, i) => `import Page${i} from './pages/${r.file.replace(/\.(jsx|tsx|ts)$/, '.js')}';`)
    .join('\n')

  const routeConfigs = routes
    .map((r, i) => `  { path: '${r.route}', component: Page${i}, type: '${r.type}' }`)
    .join(',\n')

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
`
}

export async function generateRouter(routes: Route[], compiledDir: string): Promise<void> {
  await Bun.write(join(compiledDir, 'router.js'), generateRouterCode(routes))
}
