'use client'

// Share button + dialog on the trip page: create, copy, replace or turn off the read-only link.
import { useState } from 'react'
import { Share2, Copy, Check, Link2Off, RefreshCw, Loader2 } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'
import { confirmDialog } from '@/components/ui/Confirm'
import { api, reportError, toast } from '@/lib/client'

export default function ShareTrip({ tripId, token: initial }: { tripId: string; token?: string | null }) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState(initial || null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}` : ''

  const create = async () => {
    setBusy(true)
    try {
      const r = await api<{ shareToken: string }>(`/api/trips/${tripId}/share`, 'POST')
      setToken(r.shareToken)
    } catch (err) {
      reportError(err, 'Could not create the link')
    } finally {
      setBusy(false)
    }
  }
  const replace = async () => {
    if (!(await confirmDialog({ title: 'Make a new link?', message: 'The current link stops working for anyone who has it.', confirmLabel: 'New link' }))) return
    await create()
  }
  const stop = async () => {
    if (!(await confirmDialog({ title: 'Turn off sharing?', message: 'The link stops working.', confirmLabel: 'Turn off', danger: true }))) return
    setBusy(true)
    try {
      await api(`/api/trips/${tripId}/share`, 'DELETE')
      setToken(null)
      toast.info('Sharing turned off')
    } catch (err) {
      reportError(err, 'Could not turn sharing off')
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed — select the link and copy it by hand')
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Share trip" title="Share"
        className="p-2 rounded-lg text-ink-3 hover:text-accent hover:bg-emerald-500/10">
        <Share2 className="w-4 h-4" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share this trip" icon={<Share2 className="w-5 h-5 text-accent" />}>
        <p className="text-sm text-ink-2 mb-4">
          Anyone with the link can see the route, map, days and where you stay — read-only, no login. Costs, bookings,
          confirmation emails, notes, photos and the packing list stay private.
        </p>
        {token ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.target.select()} className="tp-input font-mono text-xs" aria-label="Share link" />
              <button type="button" onClick={copy} className="tp-btn-primary shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 justify-between">
              <button type="button" onClick={replace} disabled={busy} className="tp-btn-ghost text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> New link
              </button>
              <button type="button" onClick={stop} disabled={busy} className="tp-btn-danger text-xs">
                <Link2Off className="w-3.5 h-3.5" /> Turn off sharing
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={create} disabled={busy} className="tp-btn-primary w-full justify-center">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Create share link
          </button>
        )}
      </Dialog>
    </>
  )
}
