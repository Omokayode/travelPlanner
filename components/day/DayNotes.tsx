'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

export default function DayNotes({ notes, onSave }: { notes: string; onSave: (n: string) => void }) {
  const [value, setValue] = useState(notes)
  const [saved, setSaved] = useState(true)

  return (
    <div className="space-y-2">
      <label className="text-ink/50 text-xs uppercase tracking-wide">Day Notes</label>
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        className="tp-input h-48 resize-none w-full"
        placeholder="Notes for the day — observations, tips, memories…"
      />
      <button
        onClick={() => { onSave(value); setSaved(true) }}
        disabled={saved}
        className="tp-btn w-full justify-center disabled:opacity-50"
      >
        {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Notes'}
      </button>
    </div>
  )
}
