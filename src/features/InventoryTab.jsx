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

  const [products, setProducts] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [recipeRows, setRecipeRows] = useState([])
  const [recipeForm, setRecipeForm] = useState({ inventoryItemId: '', quantityPerUnit: '' })
  const [recipeError, setRecipeError] = useState('')
  // Retsepti bor mahsulotlar — retseptsizlari uchun xomashyo umuman
  // kamaymaydi, shuning uchun ularni ogohlantirish sifatida ko'rsatamiz.
  const [productIdsWithRecipe, setProductIdsWithRecipe] = useState(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, unit, low_stock_threshold, unit_cost')
      .order('name')
    if (loadError) setError(translateError(t, loadError))
    setItems(data || [])
    setLoading(false)
  }, [t])

  const loadProducts = useCallback(async () => {
    const [{ data }, { data: recipeProductRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit').order('name'),
      supabase.from('product_ingredients').select('product_id'),
    ])
    setProducts(data || [])
    setProductIdsWithRecipe(new Set((recipeProductRows || []).map((row) => row.product_id)))
  }, [])

  const loadRecipe = useCallback(async (productId) => {
    if (!productId) {
      setRecipeRows([])
      return
    }
    const { data } = await supabase
      .from('product_ingredients')
      .select('id, quantity_per_unit, inventory_items(id, name, unit)')
      .eq('product_id', productId)
      .order('created_at')
    setRecipeRows(data || [])
  }, [])

  useEffect(() => {
    load()
    loadProducts()
  }, [load, loadProducts])

  useEffect(() => {
    loadRecipe(selectedProductId)
  }, [selectedProductId, loadRecipe])

  useEffect(() => {
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function addRecipeRow(e) {
    e.preventDefault()
    setRecipeError('')
    if (!selectedProductId || !recipeForm.inventoryItemId || !recipeForm.quantityPerUnit) return
    const { error: insertError } = await supabase.from('product_ingredients').insert({
      company_id: profile.company_id,
      product_id: selectedProductId,
      inventory_item_id: recipeForm.inventoryItemId,
      quantity_per_unit: Number(recipeForm.quantityPerUnit),
    })
    if (insertError) setRecipeError(translateError(t, insertError))
    else setRecipeForm({ inventoryItemId: '', quantityPerUnit: '' })
    loadRecipe(selectedProductId)
    loadProducts()
  }

  async function removeRecipeRow(id) {
    await supabase.from('product_ingredients').delete().eq('id', id)
    loadRecipe(selectedProductId)
    loadProducts()
  }

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

  // Narx o'zgarganda serverdagi trigger (record_ingredient_price_change,
  // 20260729090200) shu xomashyo ishlatiladigan har bir mahsulot uchun
  // price_recommendations qatorini avtomatik yaratadi. Shu yerda faqat
  // yangi yaratilgan qatorlarga AI izohini so'raymiz — narxning o'zini
  // hech qachon hisoblamaymiz.
  async function updateUnitCost(item, unitCost) {
    if (Number(unitCost) === Number(item.unit_cost)) return
    const since = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ unit_cost: unitCost })
      .eq('id', item.id)
    if (updateError) return

    const { data: newRecs } = await supabase
      .from('price_recommendations')
      .select('id')
      .eq('triggered_by_item_id', item.id)
      .eq('status', 'kutilmoqda')
      .gte('created_at', since)
    if (newRecs && newRecs.length > 0) {
      supabase.functions.invoke('explain-price-recommendation', {
        body: { recommendationIds: newRecs.map((r) => r.id) },
      })
    }
  }

  async function removeItem(id) {
    await supabase.from('inventory_items').delete().eq('id', id)
  }

  const lowItems = useMemo(
    () => items.filter((item) => Number(item.quantity) <= Number(item.low_stock_threshold)),
    [items]
  )

  const productsWithoutRecipe = useMemo(
    () => products.filter((p) => !productIdsWithRecipe.has(p.id)),
    [products, productIdsWithRecipe]
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
                <input
                  type="number"
                  className="input w-28"
                  placeholder={t('inventory.unitCostPlaceholder')}
                  defaultValue={item.unit_cost || ''}
                  onBlur={(e) => updateUnitCost(item, Number(e.target.value) || 0)}
                />
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

      <div className="card p-4 flex flex-col gap-3">
        <div>
          <h2 className="font-extrabold text-brown-dark">{t('inventory.recipesTitle')}</h2>
          <p className="text-xs text-ink-muted font-semibold mt-1">{t('inventory.recipesHint')}</p>
        </div>

        {productsWithoutRecipe.length > 0 && (
          <div className="bg-bad/10 border border-bad/30 rounded-[var(--radius-card)] p-3 flex flex-col gap-1">
            <p className="text-bad font-extrabold text-sm">
              ⚠️ {t('inventory.missingRecipeTitle', { count: productsWithoutRecipe.length })}
            </p>
            <p className="text-sm text-brown-dark font-semibold">
              {productsWithoutRecipe.map((p) => p.name).join(', ')}
            </p>
            <p className="text-xs text-ink-muted font-semibold">{t('inventory.missingRecipeHint')}</p>
          </div>
        )}
        <select
          className="input"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          <option value="">{t('inventory.selectProductForRecipe')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedProductId && (
          <>
            <div className="flex flex-col gap-2">
              {recipeRows.length === 0 && (
                <p className="text-sm text-ink-muted font-semibold">{t('inventory.noRecipeYet')}</p>
              )}
              {recipeRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink font-semibold">
                    {row.inventory_items?.name} — {row.quantity_per_unit} {row.inventory_items?.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRecipeRow(row.id)}
                    className="text-bad text-sm font-bold underline"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={addRecipeRow} className="flex flex-wrap gap-2">
              <select
                className="input flex-1 min-w-[140px]"
                value={recipeForm.inventoryItemId}
                onChange={(e) => setRecipeForm((f) => ({ ...f, inventoryItemId: e.target.value }))}
              >
                <option value="">{t('inventory.selectIngredient')}</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
              <input
                className="input w-32"
                type="number"
                step="0.0001"
                placeholder={t('inventory.quantityPerUnitPlaceholder')}
                value={recipeForm.quantityPerUnit}
                onChange={(e) => setRecipeForm((f) => ({ ...f, quantityPerUnit: e.target.value }))}
              />
              <button type="submit" className="btn-secondary px-4">
                {t('common.add')}
              </button>
            </form>
            {recipeError && <p className="text-sm text-bad font-semibold">{recipeError}</p>}
          </>
        )}
      </div>
    </div>
  )
}
