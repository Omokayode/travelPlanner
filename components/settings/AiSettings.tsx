'use client'

// Settings → AI: is the self-hosted Ollama reachable, and which installed model plans trips.
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface Status {
  configured: boolean
  reachable: boolean
  model: string
  models: { name: string; sizeGb: number }[]
}

export default function AiSettings({ onSave }: { onSave: (patch: { aiModel: string | null }) => void }) {
  const [s, setS] = useState<Status | null>(null)
  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => setS(null))
  }, [])

  return (
    <section className="tp-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" /> AI trip planning
      </h2>
      {!s ? (
        <p className="text-ink-3 text-sm">Checking…</p>
      ) : !s.configured ? (
        <p className="text-ink-3 text-sm">Not set up on this server (OLLAMA_URL). “Plan by cities” works without it.</p>
      ) : !s.reachable ? (
        <p className="text-warn text-sm">Ollama is set up but not answering right now.</p>
      ) : (
        <>
          <label className="tp-label" htmlFor="ai-model">Model</label>
          <select
            id="ai-model"
            className="tp-input"
            value={s.model}
            onChange={(e) => {
              setS({ ...s, model: e.target.value })
              onSave({ aiModel: e.target.value })
            }}
          >
            {s.models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.sizeGb} GB)
              </option>
            ))}
            {!s.models.some((m) => m.name === s.model) && <option value={s.model}>{s.model} (not installed)</option>}
          </select>
          <p className="text-ink-3 text-xs">
            The AI only reads what you type into a route (cities, nights, interests); places come from Wikipedia and
            OpenStreetMap. Small models are fast; bigger ones follow instructions better but take longer.
          </p>
        </>
      )}
    </section>
  )
}
