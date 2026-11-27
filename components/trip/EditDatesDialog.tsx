'use client'

// Change a trip's dates: shows how many days are added or removed, then one server call.
import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'
import { daysInclusive, isIsoDate } from '@/lib/domain/dates'
import { api, reportError } from '@/lib/client'

interface Props {
  open: boolean
  tripId: string
  startDate: string
  endDate: string
  dayCount: number
  onClose: () => void
  onChanged: () => void
}

export default function EditDatesDialog({ open, tripId, startDate, endDate, dayCount, onClose, onChanged }: Props) {
  const [start, setStart] = useState(startDate)
  const [end, setEnd] = useState(endDate)
  const [confirm, setConfirm] = useState<{ add: number; remove: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStart(startDate)
      setEnd(endDate)
      setConfirm(null)
    }
  }, [open, startDate, endDate])

  const valid = isIsoDate(start) && isIsoDate(end) && end >= start
  const apply = async () => {
    setSaving(true)
    try {
      await api(`/api/trips/${tripId}/dates`, 'PUT', { startDate: start, endDate: end })
      onClose()
      onChanged()
    } catch (err) {
      reportError(err, 'Could not change the dates')
    } finally {
      setSaving(false)
    }
  }
  const review = () => {
    if (!valid) return reportError(null, 'The end date must be on or after the start date.')
    const diff = daysInclusive(start, end) - dayCount
    if (diff === 0) return apply()
    setConfirm({ add: Math.max(0, diff), remove: Math.max(0, -diff) })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit trip dates">
      {!confirm ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label" htmlFor="ed-start">Start date</label>
              <input id="ed-start" type="date" className="tp-input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="tp-label" htmlFor="ed-end">End date</label>
              <input id="ed-end" type="date" className="tp-input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="text-ink-3 text-sm">
            {valid ? daysInclusive(start, end) : '–'} days (currently {dayCount}). Days keep their places; they move with the dates.
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="tp-btn-ghost">Cancel</button>
            <button type="button" onClick={review} className="tp-btn-primary">Review changes</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="tp-card p-4 space-y-2">
            <div className="text-ink-2 text-sm">Applying this change will:</div>
            {confirm.add > 0 && (
              <div className="text-ok text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add {confirm.add} day{confirm.add !== 1 ? 's' : ''} at the end
              </div>
            )}
            {confirm.remove > 0 && (
              <div className="text-danger text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Remove {confirm.remove} day{confirm.remove !== 1 ? 's' : ''} from the end, with their places
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setConfirm(null)} className="tp-btn-ghost">Back</button>
            <button type="button" onClick={apply} disabled={saving} className="tp-btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
