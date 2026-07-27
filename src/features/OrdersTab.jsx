import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import { translateError } from '../lib/errors'

const STATUSES = ['yangi', 'tayyorlanmoqda', 'yolda', 'yetkazildi', 'bekor_qilindi']

export default function OrdersTab() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ customerName: '', customerPhone: '', address: '', driverId: '' })
  const [lineItems, setLineItems] = useState([])
  const [lineDraft, setLineDraft] = useState({ productId: '', quantity: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: orderRows }, { data: productRows }, { data: driverRows }] = await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, customer_name, customer_phone, address, status, assigned_driver_id, created_at, profiles(full_name), order_items(id, quantity, products(name, unit))'
        )
        .order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, unit'),
      supabase.from('profiles').select('id, full_name').eq('role', 'driver').eq('is_active', true).order('full_name'),
    ])
    setOrders(orderRows || [])
    setProducts(productRows || [])
    setDrivers(driverRows || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  function addLineItem() {
    if (!lineDraft.productId || !lineDraft.quantity) return
    const product = products.find((p) => p.id === lineDraft.productId)
    setLineItems((items) => [
      ...items,
      { productId: lineDraft.productId, name: product?.name, quantity: Number(lineDraft.quantity) },
    ])
    setLineDraft({ productId: '', quantity: '' })
  }

  function removeLineItem(index) {
    setLineItems((items) => items.filter((_, i) => i !== index))
  }

  async function createOrder(e) {
    e.preventDefault()
    setError('')
    if (!form.customerName || lineItems.length === 0) {
      setError(t('orders.missingFields'))
      return
    }
    setSaving(true)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        company_id: profile.company_id,
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        address: form.address,
        assigned_driver_id: form.driverId || null,
        created_by: profile.id,
      })
      .select()
      .single()

    if (orderError) {
      setError(translateError(t, orderError))
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      lineItems.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
      }))
    )
    if (itemsError) setError(translateError(t, itemsError))
    else {
      setForm({ customerName: '', customerPhone: '', address: '', driverId: '' })
      setLineItems([])
    }
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  async function removeOrder(id) {
    await supabase.from('orders').delete().eq('id', id)
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={createOrder} className="card p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-brown-dark">{t('orders.newOrder')}</h2>
        <input
          className="input"
          placeholder={t('orders.customerName')}
          value={form.customerName}
          onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
        />
        <input
          className="input"
          placeholder={t('orders.customerPhone')}
          value={form.customerPhone}
          onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
        />
        <input
          className="input"
          placeholder={t('orders.address')}
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <select
          className="input"
          value={form.driverId}
          onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}
        >
          <option value="">{t('orders.selectDriver')}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>

        <div className="border-t border-brown/10 pt-3">
          <p className="text-sm font-bold text-ink-muted mb-2">{t('orders.productsHeading')}</p>
          <div className="flex gap-2 mb-2">
            <select
              className="input flex-1"
              value={lineDraft.productId}
              onChange={(e) => setLineDraft((d) => ({ ...d, productId: e.target.value }))}
            >
              <option value="">{t('orders.selectProduct')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="input w-24"
              type="number"
              placeholder={t('orders.quantityPlaceholder')}
              value={lineDraft.quantity}
              onChange={(e) => setLineDraft((d) => ({ ...d, quantity: e.target.value }))}
            />
            <button type="button" onClick={addLineItem} className="btn-secondary px-4">
              +
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {lineItems.map((item, i) => (
              <li key={i} className="text-sm flex justify-between text-ink-muted font-semibold">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <button type="button" onClick={() => removeLineItem(i)} className="text-bad font-bold underline">
                  {t('orders.removeLine')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('common.saving') : t('orders.createOrder')}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-ink-muted">{t('common.loading')}</p>}
        {!loading && orders.length === 0 && <p className="text-ink-muted">{t('orders.noOrders')}</p>}
        {orders.map((order) => (
          <div key={order.id} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-brown-dark">{order.customer_name}</p>
                <p className="text-sm text-ink-muted">
                  {order.address} · {order.customer_phone}
                </p>
                <p className="text-sm text-ink-muted">
                  {t('orders.driverLabel', { name: order.profiles?.full_name || t('common.unassigned') })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-sm rounded-lg border border-brown/20 bg-transparent px-2 py-1 text-ink font-semibold"
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
                <StatusBadge status={order.status} />
              </div>
            </div>
            <p className="text-sm text-ink-muted font-semibold">
              {order.order_items?.map((oi) => `${oi.products?.name} × ${oi.quantity}`).join(', ')}
            </p>
            <button
              type="button"
              onClick={() => removeOrder(order.id)}
              className="self-start text-bad text-sm font-bold underline"
            >
              {t('common.remove')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
