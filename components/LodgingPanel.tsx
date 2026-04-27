'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, Edit2, X, Check, Hotel, MapPin, Mail, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Lodging, Trip } from '@/lib/types'
import LocationSearch from './LocationSearch'
import clsx from 'clsx'

interface Props {
  trip: Trip
  onUpdate: (lodgings: Lodging[]) => void
}

const emptyForm = (): Omit<Lodging, 'id'> => ({
  name: '',
  location: null as any,
  checkIn: '',
  checkOut: '',
  confirmationText: '',
  notes: '',
  cost: undefined,
  bookingRef: '',
})

export default function LodgingPanel({ trip, onUpdate }: Props) {
  const lodgings: Lodging[] = (trip.lodgings as Lodging[]) || []
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Find lodging that covers a given date
  function getLodgingForDate(date: string): Lodging | undefined {
    return lodgings.find(l => l.checkIn <= date && date <= l.checkOut)
  }

  const saveLodging = async () => {
    if (!form.name.trim() || !form.location || !form.checkIn || !form.checkOut) return
    setSaving(true)
    const updated = editingId
      ? lodgings.map(l => l.id === editingId ? { ...form, id: editingId } : l)
      : [...lodgings, { ...form, id: uuidv4() }]
    await save(updated)
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
    setSaving(false)
  }

  const deleteLodging = async (id: string) => {
    await save(lodgings.filter(l => l.id !== id))
  }

  const startEdit = (l: Lodging) => {
    setEditingId(l.id)
    setForm({ name: l.name, location: l.location, checkIn: l.checkIn, checkOut: l.checkOut,
      confirmationText: l.confirmationText || '', notes: l.notes || '',
      cost: l.cost, bookingRef: l.bookingRef || '' })
    setShowForm(true)
  }

  const save = async (updated: Lodging[]) => {
    await fetch(`/api/trips/${trip.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...trip, lodgings: updated }),
    })
    onUpdate(updated)
  }

  const nights = (l: Lodging) => {
    const d1 = new Date(l.checkIn), d2 = new Date(l.checkOut)
    return Math.round((d2.getTime() - d1.getTime()) / 86400000)
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wide">Bases & Lodging</h3>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()) }}
          className="tp-btn text-xs py-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* Empty state */}
      {lodgings.length === 0 && !showForm && (
        <div className="tp-card text-center py-8 border-dashed">
          <Hotel className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <div className="text-sm text-white/40">No lodging added yet</div>
          <div className="text-xs text-white/20 mt-1">Add hotels, rentals, or campgrounds as trip bases</div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="tp-card p-5 space-y-4 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-emerald-400">{editingId ? 'Edit' : 'Add'} lodging</h4>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input className="tp-input w-full" placeholder="Name (e.g. Hilton Nashville, Airbnb on 5th)"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          <LocationSearch label="Location" onChange={loc => setForm(f => ({ ...f, location: loc! }))}
            placeholder="Search address or place…" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">Check-in</label>
              <input type="date" className="tp-input w-full" value={form.checkIn}
                min={trip.startDate} max={trip.endDate}
                onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Check-out</label>
              <input type="date" className="tp-input w-full" value={form.checkOut}
                min={form.checkIn || trip.startDate} max={trip.endDate}
                onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
              <input type="number" className="tp-input pl-7 w-full" placeholder="Total cost"
                value={form.cost ?? ''} onChange={e => setForm(f => ({ ...f, cost: e.target.value ? parseFloat(e.target.value) : undefined }))} />
            </div>
            <input className="tp-input" placeholder="Booking ref #" value={form.bookingRef}
              onChange={e => setForm(f => ({ ...f, bookingRef: e.target.value }))} />
          </div>

          <textarea className="tp-input w-full resize-none" rows={2} placeholder="Notes (optional)"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div>
            <label className="text-white/50 text-xs mb-1 block">Confirmation email (paste here)</label>
            <textarea className="tp-input w-full resize-none font-mono text-xs" rows={3}
              placeholder="Paste confirmation text…"
              value={form.confirmationText}
              onChange={e => setForm(f => ({ ...f, confirmationText: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditingId(null) }}
              className="px-4 py-2 text-sm text-white/50 hover:text-white/80">Cancel</button>
            <button onClick={saveLodging}
              disabled={!form.name.trim() || !form.location || !form.checkIn || !form.checkOut || saving}
              className="tp-btn text-sm flex items-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Lodging list */}
      {lodgings.sort((a, b) => a.checkIn.localeCompare(b.checkIn)).map(l => {
        const n = nights(l)
        const isExpanded = expandedId === l.id
        return (
          <div key={l.id} className="tp-card overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-lg shrink-0">
                🏨
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : l.id)}>
                <div className="text-white/90 font-medium text-sm">{l.name}</div>
                <div className="text-white/40 text-xs flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {l.location?.city || l.location?.name}
                  <span className="opacity-40">·</span>
                  {l.checkIn} → {l.checkOut}
                  <span className="opacity-40">·</span>
                  {n} night{n !== 1 ? 's' : ''}
                </div>
                {l.cost && <div className="text-emerald-400 text-xs mt-0.5">${l.cost.toFixed(2)}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(l)} className="p-1.5 text-white/30 hover:text-emerald-400">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteLodging(l.id)} className="p-1.5 text-white/30 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setExpandedId(isExpanded ? null : l.id)} className="p-1.5 text-white/30">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-white/6 space-y-2">
                {l.bookingRef && (
                  <div className="text-xs text-white/40">Ref: <span className="text-white/70 font-mono">{l.bookingRef}</span></div>
                )}
                {l.notes && <div className="text-xs text-white/50 italic">{l.notes}</div>}
                {l.confirmationText && (
                  <details className="mt-2">
                    <summary className="text-xs text-emerald-400/60 cursor-pointer flex items-center gap-1">
                      <Mail className="w-3 h-3" /> View confirmation
                    </summary>
                    <pre className="mt-2 text-xs text-white/40 font-mono whitespace-pre-wrap bg-white/3 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {l.confirmationText}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Helper export — used by day page to find the base for a given date
export function getLodgingForDate(lodgings: Lodging[], date: string): Lodging | undefined {
  return lodgings.find(l => l.checkIn <= date && date <= l.checkOut)
}
