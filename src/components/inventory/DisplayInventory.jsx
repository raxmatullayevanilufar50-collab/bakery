import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Icon from '../ui/Icon'

export default function DisplayInventory() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const [{ data: productRows }, { data: inventoryRows }] = await Promise.all([
      supabase.from('products').select('id,name,unit').eq('is_available', true).order('name'),
      supabase.from('display_inventory').select('product_id,quantity_available'),
    ])
    setProducts(productRows || [])
    setCounts(Object.fromEntries((inventoryRows || []).map((row) => [row.product_id, Number(row.quantity_available)])))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  async function update(productId, delta) {
    const quantity = Math.max(0, (counts[productId] || 0) + delta)
    setCounts((current) => ({ ...current, [productId]: quantity }))
    const { error } = await supabase.from('display_inventory').upsert({ company_id: profile.company_id, product_id: productId, quantity_available: quantity, updated_at: new Date().toISOString() }, { onConflict: 'company_id,product_id' })
    if (error) load()
  }
  if (loading) return <p className="text-ink-muted">{t('common.loading')}</p>
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{products.map((product) => <div key={product.id} className="card p-4 flex items-center gap-3"><span className="flex-1 font-extrabold text-brown-dark">{product.name}</span><button type="button" aria-label={t('common.remove')} onClick={() => update(product.id, -1)}><Icon name="minus" /></button><span className="font-black w-10 text-center">{counts[product.id] || 0}</span><button type="button" aria-label={t('common.add')} onClick={() => update(product.id, 1)}><Icon name="plus" /></button></div>)}</div>
}
