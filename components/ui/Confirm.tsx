'use client'

// In-app replacement for window.confirm():
//   if (!(await confirmDialog({ title: 'Delete trip?', message: '…', confirmLabel: 'Delete', danger: true }))) return
// <ConfirmHost /> is mounted once in the root layout.
import { useEffect, useState } from 'react'
import Dialog from './Dialog'

interface Request {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

let show: ((r: Request) => void) | null = null

export function confirmDialog(opts: Omit<Request, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(window.confirm(opts.title)) // host not mounted (should not happen)
    show({ ...opts, resolve })
  })
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null)
  useEffect(() => {
    show = setReq
    return () => {
      show = null
    }
  }, [])
  const done = (ok: boolean) => {
    req?.resolve(ok)
    setReq(null)
  }

  return (
    <Dialog open={!!req} onClose={() => done(false)} title={req?.title} size="sm">
      {req?.message && <div className="text-ink-2 text-sm mb-5">{req.message}</div>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => done(false)} className="tp-btn-ghost">
          {req?.cancelLabel || 'Cancel'}
        </button>
        <button
          type="button"
          data-autofocus
          onClick={() => done(true)}
          className={req?.danger ? 'tp-btn bg-red-600 text-white hover:bg-red-500' : 'tp-btn-primary'}
        >
          {req?.confirmLabel || 'OK'}
        </button>
      </div>
    </Dialog>
  )
}
