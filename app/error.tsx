'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

/** Shown instead of a blank screen when a page crashes while rendering. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0b1121] flex items-center justify-center px-4">
      <div className="tp-card max-w-sm w-full p-6 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
        <p className="text-white/50 text-sm">This page hit an error. Your saved data is safe.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm">
            Try again
          </button>
          <Link href="/" className="px-4 py-2 rounded-lg border border-white/10 text-white/70 text-sm">
            Your trips
          </Link>
        </div>
      </div>
    </div>
  )
}
