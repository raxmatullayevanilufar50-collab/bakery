import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function PreOrderForm({ products, onSaved, onCancel }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [form, setForm] = useState({ customerName: '', phone: '', pickupDate: '', pickupTime: '', notes: '' })
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  async function submit(event) {
    event.preventDefault()
    if (!form.customerName || !form.pickupDate || !items.length) return
    setSaving(true)
    const { data, error } = await supabase.from('pre_orders').insert({ company_id: profile.company_id, customer_name: form.customerName, customer_phone: form.phone || null, pickup_date: form.pickupDate, pickup_time: form.pickupTime || null, notes: form.notes || null, total, created_by: profile.id }).select('id').single()
    if (!error) {
      await supabase.from('pre_order_items').insert(items.map((item) => ({ pre_order_id: data.id, product_id: item.id, quantity: item.quantity, unit_price: item.price, total: item.price * item.quantity })))
      onSaved?.()
    }
    setSaving(false)
  }
  return <form onSubmit={submit} className="card p-4 flex flex-col gap-3"><h2 className="font-extrabold text-brown-dark">{t('preOrder.title')}</h2><input className="input" required aria-label={t('preOrder.customerName')} placeholder={t('preOrder.customerName')} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /><input className="input" aria-label={t('preOrder.phone')} placeholder={t('preOrder.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><input className="input" required type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} aria-label={t('preOrder.pickupDate')} value={form.pickupDate} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} /><input className="input" type="time" aria-label={t('preOrder.pickupTime')} value={form.pickupTime} onChange={(e) => setForm({ ...form, pickupTime: e.target.value })} /><select className="input" aria-label={t('production.selectProduct')} onChange={(e) => { const product = products.find((item) => item.id === e.target.value); if (product) setItems((current) => [...current, { ...product, quantity: 1 }]) }}><option value="">{t('production.selectProduct')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.price}</option>)}</select>{items.map((item, index) => <div key={`${item.id}-${index}`} className="flex justify-between text-sm"><span>{item.name} × {item.quantity}</span><span>{item.price * item.quantity}</span></div>)}<textarea className="input min-h-20 py-3" aria-label={t('preOrder.notes')} placeholder={t('preOrder.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><p className="font-black">{t('pos.total')}: {total.toLocaleString()}</p><div className="flex gap-2"><button type="submit" disabled={saving} className="btn-primary flex-1">{t('preOrder.submit')}</button><button type="button" onClick={onCancel} className="btn-secondary px-4">{t('common.back')}</button></div></form>
}
