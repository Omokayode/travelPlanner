'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Info, X } from 'lucide-react'
import { onToast, ToastMessage } from '@/lib/client'

/** Bottom-right messages for failed saves etc. Mounted once in the root layout. */
export default function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(
    () =>
      onToast((t) => {
        setItems((list) => [...list.slice(-3), t])
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 6000)
      }),
    [],
  )

  if (!items.length) return null
  return (
    <div className="toasts fixed bottom-4 right-4 left-4 sm:left-auto z-[2000] flex flex-col gap-2 sm:w-96" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={
            'flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg border backdrop-blur ' +
            (t.kind === 'error'
              ? 'bg-red-600 border-red-500/30 text-white'
              : 'bg-surface/95 border-ink/10 text-ink/90')
          }
        >
          {t.kind === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button
            aria-label="Dismiss"
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
            className="opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
