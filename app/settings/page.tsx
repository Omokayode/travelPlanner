'use client'

import { useState, useEffect } from 'react'
import { Settings, Car, Fuel, Camera, Plus, Trash2, Check, Loader2, Palette, LogOut } from 'lucide-react'
import Navbar, { signOut } from '@/components/Navbar'
import ThemeSwitch from '@/components/ui/ThemeSwitch'
import { Vehicle, FuelType } from '@/lib/types'
import { DEFAULT_FUEL_PRICES, DEFAULT_MPG } from '@/lib/domain/fuel'
import { invalidateAppSettings } from '@/lib/useAppSettings'
import { toast } from '@/lib/client'

interface AppSettings {
  immichUrl?: string | null
  immichAlbumId?: string | null
  immichKeySet?: boolean
  immichFromEnv?: boolean
  immichUrlFromEnv?: boolean
  immichConfigured?: boolean
  gasPriceRegular?: number | null
  gasPricePremium?: number | null
  gasPriceDiesel?: number | null
  savedVehicles?: Vehicle[]
}

const FUEL_LABELS: Record<FuelType, string> = {
  regular: 'Regular (87)',
  premium: 'Premium (93)',
  diesel: 'Diesel',
  electric: 'Electric',
}

const DEFAULT_GAS = DEFAULT_FUEL_PRICES

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({})
  const [newKey, setNewKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    make: '', model: '', year: undefined, fuelEfficiency: DEFAULT_MPG,
    fuelType: 'regular', tankSize: 15,
  })

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setLoading(false)
      })
  }, [])

  const save = async (patch: Partial<AppSettings> & { immichApiKey?: string; clearImmichApiKey?: boolean }) => {
    setSettings(s => ({ ...s, ...patch }))
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast.error((await res.json().catch(() => null))?.error || 'Could not save'); return }
      setSettings(await res.json())
      invalidateAppSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const saveKey = async () => {
    const key = newKey.trim()
    if (!key) return
    await save({ immichApiKey: key })
    setNewKey('')
    setTestResult(null)
  }

  const testImmich = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/immich?action=ping')
      const data = await res.json()
      setTestResult(res.ok
        ? { ok: true, text: `Connected — ${data.albums} album${data.albums === 1 ? '' : 's'} visible` }
        : { ok: false, text: data.error || 'Could not reach Immich' })
    } catch {
      setTestResult({ ok: false, text: 'Could not reach the server' })
    } finally { setTesting(false) }
  }

  const addVehicle = async () => {
    if (!newVehicle.make) return
    const v: Vehicle = {
      make: newVehicle.make!,
      model: newVehicle.model || '',
      year: newVehicle.year,
      fuelEfficiency: newVehicle.fuelEfficiency || DEFAULT_MPG,
      fuelType: newVehicle.fuelType as FuelType || 'regular',
      tankSize: newVehicle.tankSize || 15,
    }
    const updated = [...(settings.savedVehicles || []), v]
    await save({ savedVehicles: updated })
    setAddingVehicle(false)
    setNewVehicle({ make: '', model: '', year: undefined, fuelEfficiency: DEFAULT_MPG, fuelType: 'regular', tankSize: 15 })
  }

  const removeVehicle = async (i: number) => {
    const updated = (settings.savedVehicles || []).filter((_, idx) => idx !== i)
    await save({ savedVehicles: updated })
  }

  if (loading) return (
    <div className="min-h-screen bg-base">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-base">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <Settings className="w-6 h-6 text-accent" /> App Settings
            </h1>
            <p className="text-ink/40 text-sm mt-1">Shared across all trips</p>
          </div>
          {saved && (
            <div className="flex items-center gap-1.5 text-accent text-sm">
              <Check className="w-4 h-4" /> Saved
            </div>
          )}
        </div>

        {/* Appearance */}
        <section className="tp-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" /> Appearance
          </h2>
          <ThemeSwitch />
          <p className="text-ink-3 text-xs">&ldquo;Device&rdquo; follows your phone or computer&apos;s light/dark setting. Saved in this browser.</p>
        </section>

        {/* Immich */}
        <section className="tp-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Camera className="w-4 h-4 text-accent" /> Immich Photos
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-ink/50 text-xs mb-1 block">Server URL</label>
              {settings.immichUrlFromEnv ? (
                <div className="text-ink/60 text-sm">Set by the server (internal Immich address)</div>
              ) : (
                <input className="tp-input w-full" placeholder="https://photos.yourdomain.com"
                  value={settings.immichUrl || ''}
                  onChange={e => setSettings(s => ({ ...s, immichUrl: e.target.value }))}
                  onBlur={() => save({ immichUrl: settings.immichUrl })} />
              )}
            </div>
            <div>
              <label className="text-ink/50 text-xs mb-1 block">
                API Key {settings.immichKeySet && <span className="text-accent ml-1">● saved</span>}
              </label>
              <div className="flex gap-2">
                <input className="tp-input w-full font-mono text-sm" type="password" autoComplete="off"
                  placeholder={settings.immichKeySet ? 'Type a new key to replace the saved one' : 'Paste your Immich API key'}
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveKey() }} />
                <button type="button" onClick={saveKey} disabled={!newKey.trim() || saving}
                  className="shrink-0 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white text-sm font-medium">
                  Save key
                </button>
              </div>
              <div className="text-ink/30 text-xs mt-1">
                Immich → Account Settings → API Keys. Permissions needed: album.read, asset.read, asset.view,
                asset.download. The key is kept on the server and never shown again.
                {settings.immichKeySet && (
                  <button type="button" className="ml-2 text-danger/70 hover:text-danger"
                    onClick={() => save({ clearImmichApiKey: true })}>Remove saved key</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={testImmich} disabled={testing}
                className="px-3 py-1.5 rounded-lg border border-ink/10 hover:border-emerald-500/40 text-ink/80 text-sm">
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {testResult && (
                <span className={testResult.ok ? 'text-accent text-sm' : 'text-danger text-sm'}>{testResult.text}</span>
              )}
            </div>
          </div>
        </section>

        {/* Gas Prices */}
        <section className="tp-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Fuel className="w-4 h-4 text-accent" /> Gas Prices
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(['regular', 'premium', 'diesel'] as const).map(type => (
              <div key={type}>
                <label className="text-ink/50 text-xs mb-1 block">{FUEL_LABELS[type]}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30 text-sm">$</span>
                  <input type="number" step="0.01" className="tp-input pl-7 w-full"
                    placeholder={DEFAULT_GAS[type].toFixed(2)}
                    value={settings[`gasPrice${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof AppSettings] as number || ''}
                    onChange={e => setSettings(s => ({ ...s, [`gasPrice${type.charAt(0).toUpperCase() + type.slice(1)}`]: parseFloat(e.target.value) || undefined }))}
                    onBlur={() => save({ gasPriceRegular: settings.gasPriceRegular ?? null, gasPricePremium: settings.gasPricePremium ?? null, gasPriceDiesel: settings.gasPriceDiesel ?? null })} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-ink/30 text-xs">Used for fuel cost estimates on road trip segments</p>
        </section>

        {/* Saved Vehicles */}
        <section className="tp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Car className="w-4 h-4 text-accent" /> Saved Vehicles
            </h2>
            <button onClick={() => setAddingVehicle(true)}
              className="tp-btn text-xs py-1.5"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>

          {(settings.savedVehicles || []).length === 0 && !addingVehicle && (
            <div className="text-center py-6 text-ink/30 text-sm border border-dashed border-ink/10 rounded-xl">
              No saved vehicles yet — add one to skip the vehicle form when creating trips
            </div>
          )}

          {(settings.savedVehicles || []).map((v, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-ink/3 rounded-xl border border-ink/8">
              <Car className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink">{v.year && `${v.year} `}{v.make} {v.model}</div>
                <div className="text-xs text-ink/40">{v.fuelEfficiency} MPG · {v.tankSize}gal · {v.fuelType}</div>
              </div>
              <button onClick={() => removeVehicle(i)} className="text-ink/20 hover:text-danger">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {addingVehicle && (
            <div className="space-y-3 p-4 bg-ink/3 rounded-xl border border-emerald-500/20">
              <div className="grid grid-cols-3 gap-2">
                <input className="tp-input" placeholder="Make" value={newVehicle.make || ''}
                  onChange={e => setNewVehicle(v => ({ ...v, make: e.target.value }))} />
                <input className="tp-input" placeholder="Model" value={newVehicle.model || ''}
                  onChange={e => setNewVehicle(v => ({ ...v, model: e.target.value }))} />
                <input className="tp-input" placeholder="Year" type="number" value={newVehicle.year || ''}
                  onChange={e => setNewVehicle(v => ({ ...v, year: parseInt(e.target.value) || undefined }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-ink/40 text-xs mb-1 block">MPG</label>
                  <input className="tp-input w-full" type="number" value={newVehicle.fuelEfficiency || DEFAULT_MPG}
                    onChange={e => setNewVehicle(v => ({ ...v, fuelEfficiency: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-ink/40 text-xs mb-1 block">Tank (gal)</label>
                  <input className="tp-input w-full" type="number" value={newVehicle.tankSize || 15}
                    onChange={e => setNewVehicle(v => ({ ...v, tankSize: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-ink/40 text-xs mb-1 block">Fuel type</label>
                  <select className="tp-input w-full" value={newVehicle.fuelType || 'regular'}
                    onChange={e => setNewVehicle(v => ({ ...v, fuelType: e.target.value as FuelType }))}>
                    {Object.entries(FUEL_LABELS).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddingVehicle(false)} className="px-4 py-2 text-sm text-ink/50">Cancel</button>
                <button onClick={addVehicle} disabled={!newVehicle.make || saving}
                  className="tp-btn text-sm disabled:opacity-40">Save Vehicle</button>
              </div>
            </div>
          )}
        </section>

        {/* Phones have no sign-out in the top bar */}
        <button type="button" onClick={signOut} className="md:hidden tp-btn-ghost w-full justify-center">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )
}
