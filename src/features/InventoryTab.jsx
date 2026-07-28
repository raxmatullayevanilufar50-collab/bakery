import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { translateError } from '../lib/errors'

export default function InventoryTab() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', quantity: '', unit: 'kg', threshold: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, unit, low_stock_threshold')
      .order('name')
    if (loadError) setError(translateError(t, loadError))
    setItems(data || [])
    setLoading(false)
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function createItem(e) {
    e.preventDefault()
    setError('')
    if (!form.name) return
    setSaving(true)
    const { error: insertError } = await supabase.from('inventory_items').insert({
      company_id: profile.company_id,
      name: form.name,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      low_stock_threshold: Number(form.threshold) || 0,
    })
    if (insertError) setError(translateError(t, insertError))
    else setForm({ name: '', quantity: '', unit: 'kg', threshold: '' })
    setSaving(false)
  }

  async function updateQuantity(id, quantity) {
    await supabase.from('inventory_items').update({ quantity }).eq('id', id)
  }

  async function removeItem(id) {
    await supabase.from('inventory_items').delete().eq('id', id)
  }

  const lowItems = useMemo(
    () => items.filter((item) => Number(item.quantity) <= Number(item.low_stock_threshold)),
    [items]
  )

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aLow = Number(a.quantity) <= Number(a.low_stock_threshold)
      const bLow = Number(b.quantity) <= Number(b.low_stock_threshold)
      if (aLow !== bLow) return aLow ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [items])

  return (
    <div className="flex flex-col gap-6">
      {lowItems.length > 0 && (
        <div className="bg-bad/10 border border-bad/30 rounded-[var(--radius-card)] p-4 flex flex-col gap-1.5">
          <p className="text-bad font-extrabold text-sm">
            ⚠️ {t('inventory.lowStockBannerTitle')} — {t('inventory.lowStockBannerCount', { count: lowItems.length })}
          </p>
          <p className="text-sm text-brown-dark font-semibold">
            {lowItems.map((item) => item.name).join(', ')}
          </p>
        </div>
      )}

      <form onSubmit={createItem} className="card p-4 flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-[120px]"
          placeholder={t('inventory.namePlaceholder')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className="input w-24"
          type="number"
          placeholder={t('inventory.quantityPlaceholder')}
          value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
        />
        <input
          className="input w-20"
          placeholder={t('inventory.unitPlaceholder')}
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
        />
        <input
          className="input w-28"
          type="number"
          placeholder={t('inventory.thresholdPlaceholder')}
          value={form.threshold}
          onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
        />
        <button type="submit" disabled={saving} className="btn-secondary px-4">
          {t('common.add')}
        </button>
        {error && <p className="text-sm text-bad font-semibold w-full">{error}</p>}
      </form>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
        {!loading && items.length === 0 && <p className="text-ink-muted font-semibold">{t('inventory.empty')}</p>}
        {sortedItems.map((item) => {
          const low = Number(item.quantity) <= Number(item.low_stock_threshold)
          return (
            <div
              key={item.id}
              className={`bg-surface rounded-[var(--radius-card)] shadow-[var(--shadow-card)] border p-4 flex items-center justify-between gap-3 ${
                low ? 'border-bad/40' : 'border-brown/10'
              }`}
            >
              <div>
                <p className="font-bold text-brown-dark">{item.name}</p>
                {low && <p className="text-sm text-bad font-semibold">{t('inventory.lowStock')}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input w-24"
                  defaultValue={item.quantity}
                  onBlur={(e) => updateQuantity(item.id, Number(e.target.value))}
                />
                <span className="text-sm text-ink-muted font-semibold">{item.unit}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-bad text-sm font-bold underline"
                >
                  {t('common.remove')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
