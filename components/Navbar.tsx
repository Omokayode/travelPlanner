'use client'

// Top bar on larger screens; on phones only the logo stays up top and the links move to a tab
// bar at the bottom (thumb reach), which also gets the safe-area inset on iPhones.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Compass, Home, Settings, LogOut, Map } from 'lucide-react'
import clsx from 'clsx'

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

const LINKS = [
  { href: '/', label: 'Trips', icon: Home, match: (p: string) => p === '/' || (p.startsWith('/trips/') && p !== '/trips/new') },
  { href: '/map', label: 'Map', icon: Map, match: (p: string) => p === '/map' },
  { href: '/trips/new', label: 'New trip', icon: Plus, match: (p: string) => p === '/trips/new' },
  { href: '/settings', label: 'Settings', icon: Settings, match: (p: string) => p === '/settings' },
]

export default function Navbar() {
  const pathname = usePathname() || '/'

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-base/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-lg font-semibold text-ink tracking-tight">
              Trip by <span className="text-accent">JKBLabs</span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={l.match(pathname) ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  l.match(pathname)
                    ? 'bg-emerald-500/15 text-accent border border-emerald-500/20'
                    : 'text-ink-2 hover:text-ink hover:bg-card',
                )}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              title="Sign out"
              aria-label="Sign out"
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-ink-2 hover:text-ink hover:bg-card transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="tabbar md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-base/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4">
          {LINKS.map((l) => {
            const active = l.match(pathname)
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={clsx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active ? 'text-accent' : 'text-ink-3')}
              >
                <l.icon className={clsx('w-5 h-5', active && 'stroke-[2.25]')} />
                {l.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
