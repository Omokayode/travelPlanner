'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, Package, Loader2, Star, ChevronDown, ChevronUp, Search, Wand2 } from 'lucide-react'
import { PackingItem, PackingCategory, PACKING_CATEGORY_ICONS, TripType } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  tripId: string
  tripType?: TripType
}

const CATEGORY_LABELS: Record<PackingCategory, string> = {
  clothes: 'Clothing', toiletries: 'Toiletries', electronics: 'Electronics',
  documents: 'Documents', medications: 'Medications', food_snacks: 'Food & Snacks',
  gear: 'Gear', entertainment: 'Entertainment', misc: 'Miscellaneous',
}

const TEMPLATES: Record<string, Array<{ name: string; category: PackingCategory; essential?: boolean; quantity?: number }>> = {
  road_trip: [
    { name: "Driver's license", category: 'documents', essential: true },
    { name: 'Vehicle registration', category: 'documents', essential: true },
    { name: 'Insurance card', category: 'documents', essential: true },
    { name: 'Phone charger', category: 'electronics', essential: true },
    { name: 'Car charger / USB adapter', category: 'electronics' },
    { name: 'GPS / Phone mount', category: 'electronics' },
    { name: 'Sunglasses', category: 'clothes' },
    { name: 'T-shirts', category: 'clothes', quantity: 5 },
    { name: 'Jeans / pants', category: 'clothes', quantity: 2 },
    { name: 'Socks & underwear', category: 'clothes', quantity: 7 },
    { name: 'Jacket / hoodie', category: 'clothes' },
    { name: 'Toothbrush & toothpaste', category: 'toiletries', essential: true },
    { name: 'Deodorant', category: 'toiletries', essential: true },
    { name: 'Sunscreen', category: 'toiletries' },
    { name: 'Water bottles', category: 'gear', quantity: 2 },
    { name: 'Snacks', category: 'food_snacks' },
    { name: 'First aid kit', category: 'medications', essential: true },
    { name: 'Cash / credit cards', category: 'documents', essential: true },
    { name: 'Headphones', category: 'electronics' },
    { name: 'Portable battery', category: 'electronics' },
  ],
  flight: [
    { name: 'Passport', category: 'documents', essential: true },
    { name: 'Boarding passes', category: 'documents', essential: true },
    { name: 'Hotel confirmations', category: 'documents' },
    { name: 'Neck pillow', category: 'gear' },
    { name: 'Eye mask', category: 'gear' },
    { name: 'Earplugs', category: 'gear' },
    { name: 'Compression socks', category: 'clothes' },
    { name: 'Laptop / tablet', category: 'electronics' },
    { name: 'Universal adapter', category: 'electronics' },
    { name: 'Headphones', category: 'electronics' },
    { name: 'Toothbrush & toothpaste (travel)', category: 'toiletries' },
    { name: 'Hand sanitizer', category: 'toiletries' },
    { name: 'Snacks for flight', category: 'food_snacks' },
    { name: 'T-shirts', category: 'clothes', quantity: 5 },
    { name: 'Pants', category: 'clothes', quantity: 2 },
    { name: 'Socks & underwear', category: 'clothes', quantity: 7 },
  ],
  default: [
    { name: 'ID / Passport', category: 'documents', essential: true },
    { name: 'Wallet & cards', category: 'documents', essential: true },
    { name: 'Phone & charger', category: 'electronics', essential: true },
    { name: 'T-shirts', category: 'clothes', quantity: 4 },
    { name: 'Pants', category: 'clothes', quantity: 2 },
    { name: 'Socks & underwear', category: 'clothes', quantity: 5 },
    { name: 'Jacket', category: 'clothes' },
    { name: 'Toothbrush & toothpaste', category: 'toiletries', essential: true },
    { name: 'Deodorant', category: 'toiletries', essential: true },
    { name: 'Medications', category: 'medications' },
  ],
}

export default function PackingListPanel({ tripId, tripType }: Props) {
  const [items, setItems] = useState<PackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<PackingCategory>('misc')
  const [newEssential, setNewEssential] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'packed' | 'unpacked' | 'essential'>('all')

  const load = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`)
      const data = await res.json()
      setItems(data)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [tripId])

  const addItem = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), category: newCategory, essential: newEssential, quantity: 1 }),
      })
      const item = await res.json()
      setItems(prev => [...prev, item])
      setNewName('')
      setNewEssential(false)
    } finally { setSaving(false) }
  }

  const togglePacked = async (item: PackingItem) => {
    const updated = { ...item, packed: !item.packed }
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    await fetch(`/api/trips/${tripId}/packing/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/trips/${tripId}/packing/${id}`, { method: 'DELETE' })
  }

  const loadTemplate = async () => {
    const tpl = tripType && TEMPLATES[tripType] ? TEMPLATES[tripType] : TEMPLATES.default
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tpl.map(t => ({ ...t, packed: false, quantity: t.quantity || 1 }))),
      })
      setItems(await res.json())
    } finally { setSaving(false) }
  }

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'packed' ? i.packed :
      filter === 'unpacked' ? !i.packed :
      filter === 'essential' ? i.essential : true
    return matchSearch && matchFilter
  })

  const byCategory = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, PackingItem[]>)

  const packedCount = items.filter(i => i.packed).length
  const progress = items.length > 0 ? (packedCount / items.length) * 100 : 0
  const categories = Object.keys(byCategory) as PackingCategory[]

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-white/40">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      Loading packing list…
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="tp-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Packed</span>
            <span className="text-white font-medium text-sm">{packedCount} / {items.length}</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          {progress === 100 && <div className="text-center text-green-400 text-sm mt-2 font-medium">✅ All packed!</div>}
        </div>
      )}

      {/* Search + template */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="tp-input pl-9 w-full" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {items.length === 0 && (
          <button onClick={loadTemplate} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/25 text-sm font-medium whitespace-nowrap disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Load template
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'unpacked', 'packed', 'essential'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border',
              filter === f ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/50 border-white/10 hover:border-emerald-500/30 hover:text-white/70')}>
            {f === 'all' ? `All (${items.length})` :
             f === 'unpacked' ? `To pack (${items.filter(i => !i.packed).length})` :
             f === 'packed' ? `Packed (${items.filter(i => i.packed).length})` :
             `⭐ Essential (${items.filter(i => i.essential).length})`}
          </button>
        ))}
      </div>

      {/* Add item */}
      <div className="tp-card p-4 space-y-3">
        <div className="text-white/60 text-xs font-medium uppercase tracking-wider">Add Item</div>
        <input
          className="tp-input w-full text-base"
          placeholder="Item name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          autoComplete="off"
        />
        <div className="flex gap-2">
          <select className="tp-input flex-1" value={newCategory} onChange={e => setNewCategory(e.target.value as PackingCategory)}>
            {(Object.keys(CATEGORY_LABELS) as PackingCategory[]).map(cat => (
              <option key={cat} value={cat}>{PACKING_CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer px-2">
            <input type="checkbox" checked={newEssential} onChange={e => setNewEssential(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
            <Star className="w-3.5 h-3.5 text-emerald-400/60" />
          </label>
          <button onClick={addItem} disabled={!newName.trim() || saving}
            className="tp-btn text-sm disabled:opacity-40 flex items-center gap-1 whitespace-nowrap">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* Item list by category */}
      {categories.length === 0 && (
        <div className="text-center py-10 text-white/30">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No items yet</p>
          <p className="text-xs mt-1">Add items manually or load a template</p>
        </div>
      )}

      {categories.map(cat => {
        const catItems = byCategory[cat]
        const allPacked = catItems.every(i => i.packed)
        const isCollapsed = collapsed.has(cat)
        return (
          <div key={cat} className="tp-card overflow-hidden">
            <button onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/4 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">{PACKING_CATEGORY_ICONS[cat as PackingCategory]}</span>
                <span className={clsx('text-sm font-medium', allPacked ? 'text-white/40 line-through' : 'text-white')}>
                  {CATEGORY_LABELS[cat as PackingCategory] || cat}
                </span>
                <span className="text-white/30 text-xs">{catItems.filter(i => i.packed).length}/{catItems.length}</span>
              </div>
              {isCollapsed ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronUp className="w-4 h-4 text-white/30" />}
            </button>

            {!isCollapsed && (
              <div className="border-t border-white/6">
                {catItems.map(item => (
                  <div key={item.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 border-b border-white/4 last:border-b-0 group">
                    <button onClick={() => togglePacked(item)}
                      className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        item.packed ? 'bg-green-500 border-green-500' : 'border-white/20 hover:border-emerald-500/50')}>
                      {item.packed && <Check className="w-3 h-3 text-black" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={clsx('text-sm', item.packed ? 'line-through text-white/30' : 'text-white/80')}>
                        {item.name}
                        {item.quantity > 1 && <span className="text-white/40 ml-1">×{item.quantity}</span>}
                      </span>
                      {item.essential && !item.packed && <span className="ml-2 text-emerald-400 text-xs">⭐</span>}
                    </div>
                    <button onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {items.length > 0 && (
        <button onClick={loadTemplate} disabled={saving}
          className="w-full text-center text-white/30 text-xs hover:text-emerald-400/60 py-2 transition-colors">
          {saving ? 'Loading…' : '↺ Replace with template'}
        </button>
      )}

    </div>
  )
}
