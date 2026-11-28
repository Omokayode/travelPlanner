'use client'
// lib/useAppSettings.ts — the Settings page values (gas prices, saved vehicles), fetched once per page load.
import { useEffect, useState } from 'react'
import type { GasPrices } from '@/lib/domain/fuel'
import type { Vehicle } from '@/lib/types'

export interface PublicSettings extends GasPrices {
  savedVehicles?: Vehicle[] | null
  immichConfigured?: boolean
  homeCity?: string | null
}

let cached: Promise<PublicSettings | null> | null = null

function load(): Promise<PublicSettings | null> {
  if (!cached) {
    cached = fetch('/api/settings')
      .then((r) => (r.ok ? (r.json() as Promise<PublicSettings>) : null))
      .catch(() => null)
  }
  return cached
}

/** Call after saving settings so the next reader sees the new values. */
export function invalidateAppSettings() {
  cached = null
}

export function useAppSettings(): PublicSettings | null {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  useEffect(() => {
    let alive = true
    load().then((s) => alive && setSettings(s))
    return () => {
      alive = false
    }
  }, [])
  return settings
}
