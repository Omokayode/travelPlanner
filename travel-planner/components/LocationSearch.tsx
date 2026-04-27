// components/LocationSearch.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, MapPin, Loader2, X } from 'lucide-react'
import { GeoLocation } from '@/lib/types'
import { searchPlaces } from '@/lib/api'

interface LocationSearchProps {
  value?: GeoLocation | null
  onChange: (loc: GeoLocation | null) => void
  placeholder?: string
  label?: string
  className?: string
}

export default function LocationSearch({
  value,
  onChange,
  placeholder = 'Search for a place…',
  label,
  className = '',
}: LocationSearchProps) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState<GeoLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) setQuery(value.name)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await searchPlaces(q, 6)
      setResults(res)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (!q) { onChange(null); setResults([]); setOpen(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 350)
  }

  const handleSelect = (loc: GeoLocation) => {
    onChange(loc)
    setQuery(loc.name)
    setOpen(false)
    setResults([])
  }

  const handleClear = () => {
    setQuery('')
    onChange(null)
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="tp-label">{label}</label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="tp-input pl-9 pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
        )}
        {query && !loading && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a2235] border border-[#2d3f5a] rounded-xl
          shadow-2xl shadow-black/50 overflow-hidden">
          {results.map(loc => (
            <button
              key={loc.id}
              onClick={() => handleSelect(loc)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#111827] transition-colors text-left"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm text-[#f1f5f9] font-medium">{loc.name}</div>
                <div className="text-xs text-[#475569] line-clamp-1">{loc.address}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
