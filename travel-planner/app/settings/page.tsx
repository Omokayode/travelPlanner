'use client'

import { useState, useEffect } from 'react'
import { Settings, Car, Fuel, Camera, Save, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { Vehicle, FuelType } from '@/lib/types'
import clsx from 'clsx'

interface AppSettings {
  immichUrl?: string
  immichApiKey?: string
  immichAlbumId?: string
  gasPriceRegular?: number
  gasPricePremium?: number
  gasPriceDiesel?: number
  savedVehicles?: Vehicle[]
}

const FUEL_LABELS: Record<FuelType, string> = {
  regular: 'Regular (87)',
  premium: 'Premium (93)',
  diesel: 'Diesel',
  electric: 'Electric',
}

const DEFAULT_GAS = { regular: 3.45, premium: 3.95, diesel: 3.65 }

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    make: '', model: '', year: undefined, fuelEfficiency: 28,
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

  const save = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch }
    setSettings(updated)
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const addVehicle = async () => {
    if (!newVehicle.make) return
    const v: Vehicle = {
      make: newVehicle.make!,
      model: newVehicle.model || '',
      year: newVehicle.year,
      fuelEfficiency: newVehicle.fuelEfficiency || 28,
      fuelType: newVehicle.fuelType as FuelType || 'regular',
      tankSize: newVehicle.tankSize || 15,
    }
    const updated = [...(settings.savedVehicles || []), v]
    await save({ savedVehicles: updated })
    setAddingVehicle(false)
    setNewVehicle({ make: '', model: '', year: undefined, fuelEfficiency: 28, fuelType: 'regular', tankSize: 15 })
  }

  const removeVehicle = async (i: number) => {
    const updated = (settings.savedVehicles || []).filter((_, idx) => idx !== i)
    await save({ savedVehicles: updated })
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-500" /> App Settings
            </h1>
            <p className="text-white/40 text-sm mt-1">Shared across all trips</p>
          </div>
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <Check className="w-4 h-4" /> Saved
            </div>
          )}
        </div>

        {/* Immich */}
        <section className="tp-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-500" /> Immich Photos
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">Server URL</label>
              <input className="tp-input w-full" placeholder="https://photos.yourdomain.com"
                value={settings.immichUrl || ''}
                onChange={e => setSettings(s => ({ ...s, immichUrl: e.target.value }))}
                onBlur={() => save({ immichUrl: settings.immichUrl })} />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">API Key</label>
              <input className="tp-input w-full font-mono text-sm" type="password"
                placeholder="Your Immich API key"
                value={settings.immichApiKey || ''}
                onChange={e => setSettings(s => ({ ...s, immichApiKey: e.target.value }))}
                onBlur={() => save({ immichApiKey: settings.immichApiKey })} />
              <div className="text-white/30 text-xs mt-1">Immich → Account Settings → API Keys</div>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Default Album ID (optional)</label>
              <input className="tp-input w-full font-mono text-sm"
                placeholder="Leave blank to pick per-trip"
                value={settings.immichAlbumId || ''}
                onChange={e => setSettings(s => ({ ...s, immichAlbumId: e.target.value }))}
                onBlur={() => save({ immichAlbumId: settings.immichAlbumId })} />
              <div className="text-white/30 text-xs mt-1">Get the album ID from your Immich URL when viewing an album</div>
            </div>
          </div>
        </section>

        {/* Gas Prices */}
        <section className="tp-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Fuel className="w-4 h-4 text-emerald-500" /> Gas Prices
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(['regular', 'premium', 'diesel'] as const).map(type => (
              <div key={type}>
                <label className="text-white/50 text-xs mb-1 block">{FUEL_LABELS[type]}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input type="number" step="0.01" className="tp-input pl-7 w-full"
                    placeholder={DEFAULT_GAS[type].toFixed(2)}
                    value={settings[`gasPrice${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof AppSettings] as number || ''}
                    onChange={e => setSettings(s => ({ ...s, [`gasPrice${type.charAt(0).toUpperCase() + type.slice(1)}`]: parseFloat(e.target.value) || undefined }))}
                    onBlur={() => save(settings)} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs">Used for fuel cost estimates on road trip segments</p>
        </section>

        {/* Saved Vehicles */}
        <section className="tp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-500" /> Saved Vehicles
            </h2>
            <button onClick={() => setAddingVehicle(true)}
              className="tp-btn text-xs py-1.5"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>

          {(settings.savedVehicles || []).length === 0 && !addingVehicle && (
            <div className="text-center py-6 text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
              No saved vehicles yet — add one to skip the vehicle form when creating trips
            </div>
          )}

          {(settings.savedVehicles || []).map((v, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/8">
              <Car className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{v.year && `${v.year} `}{v.make} {v.model}</div>
                <div className="text-xs text-white/40">{v.fuelEfficiency} MPG · {v.tankSize}gal · {v.fuelType}</div>
              </div>
              <button onClick={() => removeVehicle(i)} className="text-white/20 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {addingVehicle && (
            <div className="space-y-3 p-4 bg-white/3 rounded-xl border border-emerald-500/20">
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
                  <label className="text-white/40 text-xs mb-1 block">MPG</label>
                  <input className="tp-input w-full" type="number" value={newVehicle.fuelEfficiency || 28}
                    onChange={e => setNewVehicle(v => ({ ...v, fuelEfficiency: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Tank (gal)</label>
                  <input className="tp-input w-full" type="number" value={newVehicle.tankSize || 15}
                    onChange={e => setNewVehicle(v => ({ ...v, tankSize: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Fuel type</label>
                  <select className="tp-input w-full" value={newVehicle.fuelType || 'regular'}
                    onChange={e => setNewVehicle(v => ({ ...v, fuelType: e.target.value as FuelType }))}>
                    {Object.entries(FUEL_LABELS).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddingVehicle(false)} className="px-4 py-2 text-sm text-white/50">Cancel</button>
                <button onClick={addVehicle} disabled={!newVehicle.make || saving}
                  className="tp-btn text-sm disabled:opacity-40">Save Vehicle</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
