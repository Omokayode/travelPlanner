'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Edit2, X, Check, Camera, Loader2, Receipt, ChevronDown, ChevronUp } from 'lucide-react'
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_COLORS, Trip, Segment, Lodging } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  tripId: string
  trip?: Trip          // for auto-pulling proposed items
  filterDayId?: string
}

interface ProposedItem {
  id: string
  label: string
  category: ExpenseCategory
  amount: number
  source: 'manual' | 'fuel' | 'tolls' | 'lodging' | 'auto'
  notes?: string
}

const CATEGORIES: ExpenseCategory[] = ['fuel', 'food', 'accommodation', 'activities', 'transport', 'shopping', 'tolls', 'misc']
const PAYMENT_METHODS = ['Credit card', 'Debit card', 'Cash', 'Venmo', 'PayPal', 'Apple Pay']
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Fuel', food: 'Food & Drink', accommodation: 'Accommodation',
  activities: 'Activities', transport: 'Transport', shopping: 'Shopping',
  tolls: 'Tolls', misc: 'Miscellaneous',
}

type PanelMode = 'proposed' | 'actual'

interface ExpenseForm {
  name: string; amount: string; category: ExpenseCategory
  date: string; notes: string; receipt: string | null; paymentMethod: string
}

const emptyForm = (): ExpenseForm => ({
  name: '', amount: '', category: 'misc',
  date: new Date().toISOString().split('T')[0],
  notes: '', receipt: null, paymentMethod: '',
})

// Derive proposed items from trip segments and lodgings
function deriveProposed(trip?: Trip): ProposedItem[] {
  if (!trip) return []
  const items: ProposedItem[] = []

  let totalFuel = 0, totalTolls = 0
  for (const day of trip.days || []) {
    for (const seg of day.segments || []) {
      totalFuel += seg.fuelCost || 0
      totalTolls += seg.tollCost || 0
    }
  }
  if (totalFuel > 0) items.push({ id: 'auto-fuel', label: 'Fuel (from route)', category: 'fuel', amount: Math.round(totalFuel * 100) / 100, source: 'fuel' })
  if (totalTolls > 0) items.push({ id: 'auto-tolls', label: 'Tolls (estimated)', category: 'tolls', amount: Math.round(totalTolls * 100) / 100, source: 'tolls' })

  for (const lodging of (trip.lodgings || []) as Lodging[]) {
    if (lodging.cost) {
      items.push({ id: `lodging-${lodging.id}`, label: lodging.name, category: 'accommodation', amount: lodging.cost, source: 'lodging' })
    }
  }

  return items
}

export default function BudgetPanel({ tripId, trip, filterDayId }: Props) {
  const [mode, setMode] = useState<PanelMode>('proposed')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [proposedItems, setProposedItems] = useState<ProposedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [viewReceipt, setViewReceipt] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all')
  const [newProposed, setNewProposed] = useState({ label: '', amount: '', category: 'misc' as ExpenseCategory })
  const [showAddProposed, setShowAddProposed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const [expRes, propRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/expenses`),
        fetch(`/api/trips/${tripId}/budget`),
      ])
      const expData: Expense[] = await expRes.json()
      const propData: ProposedItem[] = await propRes.json()
      setExpenses(expData)
      // Merge auto-derived with saved manual proposed items
      const autoItems = deriveProposed(trip)
      const manualItems = (Array.isArray(propData) ? propData : []).filter((p: ProposedItem) => p.source === 'manual')
      setProposedItems([...autoItems, ...manualItems])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [tripId])

  const saveProposed = async (items: ProposedItem[]) => {
    setProposedItems(items)
    const manualOnly = items.filter(i => i.source === 'manual')
    await fetch(`/api/trips/${tripId}/budget`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manualOnly),
    })
  }

  const addProposedItem = async () => {
    if (!newProposed.label || !newProposed.amount) return
    const item: ProposedItem = {
      id: `manual-${Date.now()}`, label: newProposed.label,
      category: newProposed.category, amount: parseFloat(newProposed.amount), source: 'manual',
    }
    await saveProposed([...proposedItems, item])
    setNewProposed({ label: '', amount: '', category: 'misc' })
    setShowAddProposed(false)
  }

  const removeProposedItem = async (id: string) => {
    await saveProposed(proposedItems.filter(i => i.id !== id))
  }

  const displayed = expenses.filter(e => {
    if (filterDayId && e.dayId !== filterDayId) return false
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
    return true
  })

  const totalProposed = proposedItems.reduce((s, i) => s + i.amount, 0)
  const totalActual = displayed.reduce((s, e) => s + e.amount, 0)
  const diff = totalActual - totalProposed

  const handleReceipt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { alert('Receipt must be under 3MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, receipt: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const saveExpense = async () => {
    if (!form.name.trim() || !form.amount) return
    setSaving(true)
    try {
      const payload = { ...form, amount: parseFloat(form.amount), dayId: filterDayId ?? null, tripId }
      let res: Response
      if (editingId) {
        res = await fetch(`/api/trips/${tripId}/expenses/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const updated = await res.json()
        setExpenses(prev => prev.map(e => e.id === editingId ? updated : e))
      } else {
        res = await fetch(`/api/trips/${tripId}/expenses`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const created = await res.json(); setExpenses(prev => [...prev, created])
      }
      setShowForm(false); setEditingId(null); setForm(emptyForm())
    } finally { setSaving(false) }
  }

  const deleteExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/trips/${tripId}/expenses/${id}`, { method: 'DELETE' })
  }

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id)
    setForm({ name: expense.name, amount: String(expense.amount), category: expense.category as ExpenseCategory,
      date: expense.date, notes: expense.notes || '', receipt: expense.receipt || null, paymentMethod: expense.paymentMethod || '' })
    setShowForm(true)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-white/40">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading budget…
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {(['proposed', 'actual'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              mode === m ? 'bg-emerald-500 text-white' : 'text-white/50 hover:text-white/80')}>
            {m === 'proposed' ? '📋 Planned' : '🧾 Actual'}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="tp-card p-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xs text-white/40 mb-1">Planned</div>
          <div className="text-xl font-semibold text-white">${totalProposed.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 mb-1">Actual</div>
          <div className="text-xl font-semibold text-white">${totalActual.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 mb-1">{diff >= 0 ? 'Over' : 'Under'}</div>
          <div className={clsx('text-xl font-semibold', diff > 0 ? 'text-red-400' : 'text-green-400')}>
            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
          </div>
        </div>
      </div>

      {/* PROPOSED tab */}
      {mode === 'proposed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">Planned Budget</h3>
            <button onClick={() => setShowAddProposed(true)}
              className="tp-btn text-xs py-1.5"><Plus className="w-3.5 h-3.5" /> Add line item</button>
          </div>

          {/* Auto-derived items */}
          {proposedItems.filter(i => i.source !== 'manual').length > 0 && (
            <div className="text-xs text-white/30 flex items-center gap-1.5 mb-1">
              ⚡ Auto-calculated from your routes and lodging
            </div>
          )}

          {proposedItems.map(item => (
            <div key={item.id} className={clsx('tp-card flex items-center gap-3 p-3',
              item.source !== 'manual' && 'border-white/5 bg-white/2')}>
              <span className="text-lg">{EXPENSE_CATEGORY_ICONS[item.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/80 truncate">{item.label}</div>
                <div className="text-xs text-white/30">{CATEGORY_LABELS[item.category]}
                  {item.source !== 'manual' && <span className="ml-1 text-emerald-400/50">· auto</span>}
                </div>
              </div>
              <div className="text-white font-medium">${item.amount.toFixed(2)}</div>
              {item.source === 'manual' && (
                <button onClick={() => removeProposedItem(item.id)} className="text-white/20 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {proposedItems.length === 0 && (
            <div className="tp-card text-center py-8 text-white/30 border-dashed text-sm">
              No planned budget yet. Add items or complete route segments to auto-populate.
            </div>
          )}

          {/* Total proposed */}
          {proposedItems.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-white/8 px-1">
              <span className="text-white/50 text-sm">Total planned</span>
              <span className="text-white font-semibold">${totalProposed.toFixed(2)}</span>
            </div>
          )}

          {/* Add proposed item form */}
          {showAddProposed && (
            <div className="tp-card p-4 space-y-3 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-400">Add budget line</span>
                <button onClick={() => setShowAddProposed(false)} className="text-white/30 hover:text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input className="tp-input w-full" placeholder="Description (e.g. Hotels, Restaurants, Activities)"
                value={newProposed.label} onChange={e => setNewProposed(p => ({ ...p, label: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input type="number" className="tp-input pl-7 w-full" placeholder="0.00"
                    value={newProposed.amount} onChange={e => setNewProposed(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <select className="tp-input" value={newProposed.category}
                  onChange={e => setNewProposed(p => ({ ...p, category: e.target.value as ExpenseCategory }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{EXPENSE_CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddProposed(false)} className="px-4 py-2 text-sm text-white/50">Cancel</button>
                <button onClick={addProposedItem} disabled={!newProposed.label || !newProposed.amount}
                  className="tp-btn text-sm disabled:opacity-40">Add</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTUAL tab */}
      {mode === 'actual' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">Actual Expenses</h3>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()) }}
              className="tp-btn text-xs py-1.5"><Plus className="w-3.5 h-3.5" /> Add expense</button>
          </div>

          {/* Add/edit form */}
          {showForm && (
            <div className="tp-card p-5 space-y-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-emerald-400">{editingId ? 'Edit' : 'Add'} expense</h4>
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
              </div>
              <input className="tp-input w-full" placeholder="Description (e.g. Dinner at Olive Garden)"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                  <input className="tp-input pl-7 w-full" placeholder="0.00" type="number" step="0.01"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <input type="date" className="tp-input w-full" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                <select className="tp-input w-full" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{EXPENSE_CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
                </select>
                <select className="tp-input w-full" value={form.paymentMethod}
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="">Payment method…</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className="col-span-2">
                  <textarea className="tp-input w-full resize-none" rows={2} placeholder="Notes (optional)"
                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="text-white/50 text-xs mb-2">Receipt photo</div>
                {form.receipt ? (
                  <div className="relative inline-block">
                    <img src={form.receipt} alt="Receipt" className="h-28 rounded-xl object-cover border border-white/10" />
                    <button onClick={() => setForm(f => ({ ...f, receipt: null }))}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15 text-white/40 hover:border-emerald-500/30 hover:text-emerald-400 text-sm">
                    <Camera className="w-4 h-4" /> Upload receipt
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleReceipt} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-sm text-white/50 hover:text-white/80">Cancel</button>
                <button onClick={saveExpense} disabled={!form.name.trim() || !form.amount || saving}
                  className="tp-btn text-sm flex items-center gap-2 disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Category filter */}
          {expenses.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setCategoryFilter('all')}
                className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all',
                  categoryFilter === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/50 border-white/10')}>All</button>
              {CATEGORIES.filter(c => expenses.some(e => e.category === c)).map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all',
                    categoryFilter === cat ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/50 border-white/10')}>
                  {EXPENSE_CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {/* Expense list */}
          {displayed.length === 0 ? (
            <div className="text-center py-10 text-white/30">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No expenses yet</p>
              <p className="text-xs mt-1">Add receipts after each purchase</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.sort((a, b) => b.date.localeCompare(a.date)).map(expense => (
                <div key={expense.id} className="tp-card group">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[expense.category as ExpenseCategory] + '22' }}>
                      {EXPENSE_CATEGORY_ICONS[expense.category as ExpenseCategory]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/90 text-sm font-medium truncate">{expense.name}</div>
                      <div className="text-white/40 text-xs flex items-center gap-2 mt-0.5">
                        <span>{expense.date}</span>
                        {expense.paymentMethod && <><span>·</span><span>{expense.paymentMethod}</span></>}
                        {expense.receipt && <span className="text-emerald-400/60">📎</span>}
                      </div>
                    </div>
                    <div className="text-right mr-2">
                      <div className="text-white font-medium">${expense.amount.toFixed(2)}</div>
                      <div className="text-xs" style={{ color: EXPENSE_CATEGORY_COLORS[expense.category as ExpenseCategory] }}>
                        {CATEGORY_LABELS[expense.category as ExpenseCategory]}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {expense.receipt && (
                        <button onClick={() => setViewReceipt(expense.receipt!)} className="p-1.5 text-white/30 hover:text-emerald-400">
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => startEdit(expense)} className="p-1.5 text-white/30 hover:text-white/70">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteExpense(expense.id)} className="p-1.5 text-white/30 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-white/8 px-1">
                <span className="text-white/50 text-sm">Total spent</span>
                <span className="text-white font-semibold">${totalActual.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Receipt lightbox */}
      {viewReceipt && (
        <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-4"
          onClick={() => setViewReceipt(null)}>
          <img src={viewReceipt} alt="Receipt" className="max-w-full max-h-full rounded-xl" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  )
}
