'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Compass, Loader2, Lock } from 'lucide-react'

function LoginForm() {
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error || 'Sign-in failed')
        return
      }
      const next = params.get('next') || '/'
      // only same-site paths
      window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/'
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="tp-card w-full max-w-sm p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
          <Compass className="w-4 h-4 text-ink" />
        </div>
        <span className="font-display text-xl font-semibold text-ink">
          Trip by <span className="text-accent">JKBLabs</span>
        </span>
      </div>
      <label className="block">
        <span className="text-ink/50 text-xs mb-1 block">Password</span>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className="tp-input w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="text-sm text-danger bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Sign in
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
