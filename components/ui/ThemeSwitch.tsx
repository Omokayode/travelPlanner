'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { applyTheme, readTheme, type ThemeChoice } from '@/lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'Device', icon: <Monitor className="w-4 h-4" /> },
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
]

export default function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  useEffect(() => setChoice(readTheme()), [])

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-line bg-surface p-1 gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => {
            applyTheme(o.value)
            setChoice(o.value)
          }}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
            choice === o.value ? 'bg-emerald-500 text-white' : 'text-ink-2 hover:text-ink hover:bg-ink/5',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
