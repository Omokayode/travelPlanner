// components/ActivityPanel.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, Star, Globe, Phone, Edit2, X, Loader2, Sparkles } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Activity, GeoLocation } from '@/lib/types'
import { getCityAttractions } from '@/lib/api'
import LocationSearch from './LocationSearch'
import clsx from 'clsx'

const ACTIVITY_TYPES = [
  { type: 'food', label: '🍽 Food', color: 'text-orange-400' },
  { type: 'attraction', label: '🎡 Attraction', color: 'text-purple-400' },
  { type: 'accommodation', label: '🛏 Hotel', color: 'text-blue-400' },
  { type: 'outdoor', label: '🥾 Outdoor', color: 'text-green-400' },
  { type: 'shopping', label: '🛍 Shopping', color: 'text-pink-400' },
  { type: 'nightlife', label: '🎵 Nightlife', color: 'text-indigo-400' },
  { type: 'other', label: '📌 Other', color: 'text-gray-400' },
] as const

interface ActivityPanelProps {
  activities: Activity[]
  cityName?: string
  onAdd: (activity: Activity) => void
  onUpdate: (activity: Activity) => void
  onDelete: (id: string) => void
}

export default function ActivityPanel({ activities, cityName, onAdd, onUpdate, onDelete }: ActivityPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Partial<Activity>[]>([])

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<Activity['type']>('attraction')
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('')

  const resetForm = () => {
    setName(''); setType('attraction'); setLocation(null)
    setTime(''); setDuration(''); setCost(''); setNotes(''); setWebsite('')
    setEditingId(null)
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    const activity: Activity = {
      id: editingId || uuidv4(),
      name: name.trim(),
      type,
      location: location || undefined,
      time: time || undefined,
      duration: duration ? parseInt(duration) : undefined,
      cost: cost ? parseFloat(cost) : undefined,
      notes: notes || undefined,
      website: website || undefined,
      visited: false,
    }
    if (editingId) {
      onUpdate(activity)
    } else {
      onAdd(activity)
    }
    resetForm()
    setShowForm(false)
  }

  const startEdit = (activity: Activity) => {
    setEditingId(activity.id)
    setName(activity.name)
    setType(activity.type)
    setLocation(activity.location || null)
    setTime(activity.time || '')
    setDuration(activity.duration ? String(activity.duration) : '')
    setCost(activity.cost ? String(activity.cost) : '')
    setNotes(activity.notes || '')
    setWebsite(activity.website || '')
    setShowForm(true)
  }

  const fetchSuggestions = async () => {
    if (!cityName) return
    setLoadingSuggestions(true)
    try {
      const results = await getCityAttractions(cityName, 10)
      setSuggestions(results)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const addSuggestion = (s: Partial<Activity>) => {
    const activity: Activity = {
      id: uuidv4(),
      name: s.name || 'Activity',
      type: s.type || 'attraction',
      location: s.location,
      notes: s.notes,
      website: s.website,
      visited: false,
    }
    onAdd(activity)
    setSuggestions(prev => prev.filter(x => x.name !== s.name))
  }

  const typeConfig = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.type, t]))

  return (
    <div className="space-y-3">
      {/* Activity list */}
      {activities.map(activity => {
        const tc = typeConfig[activity.type]
        return (
          <div key={activity.id}
            className={clsx(
              'flex items-start gap-3 p-3 rounded-xl border transition-all',
              activity.visited
                ? 'bg-green-500/5 border-green-500/15 opacity-70'
                : 'bg-[#111827] border-[#1e293b] hover:border-[#2d3f5a]'
            )}>
            <div className="w-8 h-8 rounded-lg bg-[#1a2235] flex items-center justify-center shrink-0 text-sm">
              {tc?.label.split(' ')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-[#f1f5f9]">{activity.name}</span>
                  {activity.isHighlight && <Star className="w-3 h-3 text-emerald-500 inline ml-1" />}
                  <div className="flex items-center gap-2 mt-0.5">
                    {activity.time && <span className="text-xs text-[#475569]">{activity.time}</span>}
                    {activity.duration && <span className="text-xs text-[#475569]">{activity.duration}min</span>}
                    {activity.cost !== undefined && <span className="text-xs text-green-400">${activity.cost}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onUpdate({ ...activity, visited: !activity.visited })}
                    className={clsx('p-1 rounded transition-colors',
                      activity.visited ? 'text-green-400 bg-green-500/10' : 'text-[#475569] hover:text-green-400')}>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => startEdit(activity)}
                    className="p-1 rounded text-[#475569] hover:text-emerald-400 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(activity.id)}
                    className="p-1 rounded text-[#475569] hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {activity.notes && <div className="text-xs text-[#64748b] mt-1 italic">{activity.notes}</div>}
              {activity.website && (
                <a href={activity.website} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                  <Globe className="w-3 h-3" />{new URL(activity.website).hostname}
                </a>
              )}
            </div>
          </div>
        )
      })}

      {/* AI suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
          <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Suggestions for {cityName}
          </div>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1">
                <div>
                  <div className="text-sm text-[#f1f5f9]">{s.name}</div>
                  {s.notes && <div className="text-xs text-[#475569]">{s.notes}</div>}
                </div>
                <button onClick={() => addSuggestion(s)}
                  className="shrink-0 p-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-[#111827] rounded-xl p-4 space-y-3 border border-[#2d3f5a]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#94a3b8]">{editingId ? 'Edit Activity' : 'Add Activity'}</span>
            <button onClick={() => { setShowForm(false); resetForm() }} className="text-[#475569] hover:text-[#94a3b8]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="tp-label">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="tp-input" placeholder="Activity name…" autoFocus />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {ACTIVITY_TYPES.map(({ type: t, label }) => (
              <button key={t} onClick={() => setType(t as Activity['type'])}
                className={clsx('py-1.5 rounded-lg text-xs border transition-all',
                  type === t ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-[#0b1121] border-[#1e293b] text-[#64748b]')}>
                {label}
              </button>
            ))}
          </div>
          <LocationSearch label="Location (optional)" onChange={setLocation} placeholder="Search location…" />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="tp-label">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="tp-input" />
            </div>
            <div>
              <label className="tp-label">Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="tp-input" placeholder="60" />
            </div>
            <div>
              <label className="tp-label">Cost ($)</label>
              <input type="number" value={cost} onChange={e => setCost(e.target.value)} className="tp-input" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="tp-label">Website</label>
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className="tp-input" placeholder="https://…" />
          </div>
          <div>
            <label className="tp-label">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="tp-input h-14 resize-none" placeholder="Notes, tips, reservations…" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm() }} className="tp-btn-ghost flex-1 justify-center">Cancel</button>
            <button onClick={handleSubmit} disabled={!name.trim()} className="tp-btn-primary flex-1 justify-center">
              {editingId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showForm && (
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)} className="tp-btn-ghost text-xs flex-1 justify-center">
            <Plus className="w-3.5 h-3.5" />
            Add Activity
          </button>
          {cityName && (
            <button onClick={fetchSuggestions} disabled={loadingSuggestions} className="tp-btn-ghost text-xs flex-1 justify-center">
              {loadingSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Suggest for {cityName}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
