// packages/router/src/index.ts
// @bertui/router — SSR-safe React router

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteDefinition {
  path: string
  component: React.ComponentType<{ params: Record<string, string> }>
  type: 'static' | 'dynamic'
}

export interface RouterContextValue {
  currentRoute: RouteDefinition | null
  params: Record<string, string>
  navigate: (path: string) => void
  pathname: string
  isSSR: boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RouterContext = createContext<RouterContextValue | null>(null)

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext)

  // SSR safe fallback
  if (typeof window === 'undefined') {
    return { currentRoute: null, params: {}, navigate: () => {}, pathname: '/', isSSR: true }
  }

  if (!ctx) throw new Error('useRouter must be used within a <Router>')
  return ctx
}

// ─── Router ───────────────────────────────────────────────────────────────────

interface RouterProps {
  routes: RouteDefinition[]
}

export function Router({ routes }: RouterProps): React.ReactElement {
  const [currentRoute, setCurrentRoute] = useState<RouteDefinition | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})

  useEffect(() => {
    matchAndSetRoute(window.location.pathname)
    const handler = () => matchAndSetRoute(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [routes])

  function matchRoute(pathname: string): { route: RouteDefinition; params: Record<string, string> } | null {
    for (const route of routes) {
      if (route.type === 'static' && route.path === pathname) {
        return { route, params: {} }
      }
    }
    for (const route of routes) {
      if (route.type === 'dynamic') {
        const pattern = route.path.replace(/\[([^\]]+)\]/g, '([^/]+)')
        const match   = pathname.match(new RegExp('^' + pattern + '$'))
        if (match) {
          const names   = [...route.path.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]!)
          const p: Record<string, string> = {}
          names.forEach((n, i) => { p[n] = match[i + 1]! })
          return { route, params: p }
        }
      }
    }
    return null
  }

  function matchAndSetRoute(pathname: string): void {
    const result = matchRoute(pathname)
    if (result) {
      setCurrentRoute(result.route)
      setParams(result.params)
    } else {
      setCurrentRoute(null)
      setParams({})
    }
  }

  function navigate(path: string): void {
    window.history.pushState({}, '', path)
    matchAndSetRoute(path)
  }

  const Component = currentRoute?.component ?? null

  return React.createElement(
    RouterContext.Provider,
    {
      value: {
        currentRoute,
        params,
        navigate,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
        isSSR: false,
      },
    },
    Component
      ? React.createElement(Component, { params })
      : React.createElement(NotFound, null)
  )
}

// ─── Link ─────────────────────────────────────────────────────────────────────

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  children: ReactNode
}

export function Link({ to, children, ...props }: LinkProps): React.ReactElement {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    if (typeof window === 'undefined') return
    e.preventDefault()
    try {
      const { navigate } = useRouter()
      navigate(to)
    } catch {
      window.location.href = to
    }
  }

  return React.createElement('a', { href: to, onClick: handleClick, ...props }, children)
}

// ─── SSR Router ───────────────────────────────────────────────────────────────

interface SSRRouterProps {
  routes: RouteDefinition[]
  initialPath?: string
}

export function SSRRouter({ routes, initialPath = '/' }: SSRRouterProps): React.ReactElement {
  const [isClient, setIsClient] = useState(false)
  const [currentRoute, setCurrentRoute] = useState<RouteDefinition | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})

  useEffect(() => {
    setIsClient(true)
    matchAndSet(window.location.pathname)
    const handler = () => matchAndSet(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function matchAndSet(pathname: string): void {
    for (const route of routes) {
      if (route.type === 'static' && route.path === pathname) {
        setCurrentRoute(route); setParams({}); return
      }
    }
    for (const route of routes) {
      if (route.type === 'dynamic') {
        const pattern = route.path.replace(/\[([^\]]+)\]/g, '([^/]+)')
        const match   = pathname.match(new RegExp('^' + pattern + '$'))
        if (match) {
          const names = [...route.path.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]!)
          const p: Record<string, string> = {}
          names.forEach((n, i) => { p[n] = match[i + 1]! })
          setCurrentRoute(route); setParams(p); return
        }
      }
    }
    setCurrentRoute(null); setParams({})
  }

  function navigate(path: string): void {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path)
      matchAndSet(path)
    }
  }

  // SSR: render with initial path
  if (!isClient) {
    for (const route of routes) {
      if (route.path === initialPath) {
        return React.createElement(
          RouterContext.Provider,
          { value: { currentRoute: route, params: {}, navigate: () => {}, pathname: initialPath, isSSR: true } },
          React.createElement(route.component, { params: {} })
        )
      }
    }
  }

  const Component = currentRoute?.component ?? null

  return React.createElement(
    RouterContext.Provider,
    {
      value: {
        currentRoute,
        params,
        navigate,
        pathname: isClient ? window.location.pathname : initialPath,
        isSSR: !isClient,
      },
    },
    Component
      ? React.createElement(Component, { params })
      : React.createElement(NotFound, null)
  )
}

// ─── 404 ─────────────────────────────────────────────────────────────────────

function NotFound(): React.ReactElement {
  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' } },
    React.createElement('h1', { style: { fontSize: '6rem', margin: 0 } }, '404'),
    React.createElement('p',  { style: { fontSize: '1.5rem', color: '#666' } }, 'Page not found'),
    React.createElement('a',  { href: '/', style: { color: '#10b981', textDecoration: 'none' } }, 'Go home')
  )
}
