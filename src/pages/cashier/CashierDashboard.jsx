import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { localeTag } from '../../lib/i18n'
import { translateError } from '../../lib/errors'

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function CashierDashboard() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ productId: '', quantity: '1' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: productRows }, { data: saleRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit, price').order('name'),
      supabase
        .from('sales')
        .select('id, quantity, unit_price, total, created_at, products(name, unit)')
        .eq('cashier_id', profile.id)
        .gte('created_at', startOfDay().toISOString())
        .order('created_at', { ascending: false }),
    ])
    setProducts(productRows || [])
    setSales(saleRows || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  const selectedProduct = products.find((p) => p.id === form.productId)
  const total = selectedProduct ? selectedProduct.price * Number(form.quantity || 0) : 0

  async function recordSale(e) {
    e.preventDefault()
    setError('')
    if (!selectedProduct || !form.quantity || Number(form.quantity) <= 0) {
      setError(t('cashier.missingFields'))
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('sales').insert({
      company_id: profile.company_id,
      cashier_id: profile.id,
      product_id: selectedProduct.id,
      quantity: Number(form.quantity),
      unit_price: selectedProduct.price,
      total,
    })
    if (insertError) setError(translateError(t, insertError))
    else setForm({ productId: '', quantity: '1' })
    setSaving(false)
    load()
  }

  const todayTotal = sales.reduce((sum, s) => sum + Number(s.total), 0)

  return (
    <DashboardShell
      navGroups={[{ title: t('navGroups.main'), items: [{ key: 'kassa', label: t('nav.kassa'), icon: '💰' }] }]}
      active="kassa"
      onNavigate={() => {}}
      title={t('cashier.title')}
    >
      <div className="flex flex-col gap-6">
        <form onSubmit={recordSale} className="card p-4 flex flex-col gap-3">
          <h2 className="font-extrabold text-brown-dark">{t('cashier.recordSale')}</h2>
          <select
            className="input"
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
          >
            <option value="">{t('cashier.selectProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.price.toLocaleString(localeTag(i18n.language))} {t('common.currency')}/{p.unit}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min="1"
            placeholder={t('cashier.quantityPlaceholder')}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          {selectedProduct && (
            <p className="text-lg font-extrabold text-brown-dark">
              {t('cashier.total', { total: total.toLocaleString(localeTag(i18n.language)) })}
            </p>
          )}
          {error && <p className="text-sm text-bad font-semibold">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary h-14">
            {saving ? t('common.saving') : t('cashier.submit')}
          </button>
        </form>

        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-brown-dark">
            {todayTotal.toLocaleString(localeTag(i18n.language))} {t('common.currency')}
          </p>
          <p className="text-sm text-ink-muted font-semibold">{t('cashier.todayBalance')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-extrabold text-brown-dark">{t('cashier.myTodaySales')}</h2>
          {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
          {!loading && sales.length === 0 && <p className="text-ink-muted font-semibold">{t('cashier.noSales')}</p>}
          {sales.map((sale) => (
            <div key={sale.id} className="card p-3 flex items-center justify-between text-sm">
              <span className="text-ink font-semibold">
                {sale.products?.name} × {sale.quantity}
              </span>
              <span className="font-bold text-brown-dark">
                {Number(sale.total).toLocaleString(localeTag(i18n.language))} {t('common.currency')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
