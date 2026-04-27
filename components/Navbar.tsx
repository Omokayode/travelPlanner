'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Compass, Home, Settings } from 'lucide-react'
import clsx from 'clsx'

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-[#1e293b] bg-[#0b1121]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-[#f1f5f9] tracking-tight">
            Trip by <span className="text-emerald-500">JKBLabs</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" icon={<Home className="w-4 h-4" />} label="Trips" active={pathname === '/'} />
          <NavLink href="/trips/new" icon={<Plus className="w-4 h-4" />} label="New Trip" active={pathname === '/trips/new'} />
          <NavLink href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" active={pathname === '/settings'} />
        </nav>
      </div>
    </header>
  )
}

function NavLink({ href, icon, label, active }: {
  href: string; icon: React.ReactNode; label: string; active: boolean
}) {
  return (
    <Link href={href}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
        active
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1a2235]'
      )}>
      {icon}{label}
    </Link>
  )
}
