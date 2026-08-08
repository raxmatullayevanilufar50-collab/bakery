import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

export default function PreOrderList() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  useEffect(() => { supabase.from('pre_orders').select('id,customer_name,pickup_date,status,total,pre_order_items(quantity,unit_price,products(name),custom_name)').order('pickup_date').then(({ data }) => setOrders(data || [])) }, [])
  async function update(id, status) { await supabase.from('pre_orders').update({ status }).eq('id', id); setOrders((items) => items.map((item) => item.id === id ? { ...item, status } : item)) }
  return <div className="flex flex-col gap-3">{orders.map((order) => <div key={order.id} className="card p-4 flex items-center gap-3"><div className="flex-1"><p className="font-extrabold">{order.customer_name}</p><p className="text-sm text-ink-muted">{order.pickup_date} · {order.total}</p></div><select className="input h-10 py-0" aria-label={t('preOrder.status.label')} value={order.status} onChange={(e) => update(order.id, e.target.value)}>{['kutilmoqda', 'tayyor', 'berildi', 'bekor'].map((status) => <option key={status} value={status}>{t(`preOrder.status.${status}`)}</option>)}</select></div>)}</div>
}
