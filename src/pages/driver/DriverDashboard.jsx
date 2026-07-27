import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const ACTIVE_STATUSES = ['yangi', 'tayyorlanmoqda', 'yolda']

export default function DriverDashboard() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, address, status, order_items(quantity, products(name, unit))')
      .eq('assigned_driver_id', profile.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('driver-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `assigned_driver_id=eq.${profile.id}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, profile.id])

  async function setStatus(orderId, status) {
    await supabase.rpc('update_order_status', { p_order_id: orderId, p_status: status })
  }

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const done = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status))

  return (
    <DashboardShell
      navGroups={[{ title: t('navGroups.main'), items: [{ key: 'deliveries', label: t('nav.myDeliveries'), icon: '🚚' }] }]}
      active="deliveries"
      onNavigate={() => {}}
      title={t('driver.title')}
    >
      <div className="flex flex-col gap-3">
        {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
        {!loading && active.length === 0 && (
          <p className="text-ink-muted font-semibold">{t('driver.noOrders')}</p>
        )}
        {active.map((order) => (
          <div key={order.id} className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-lg text-brown-dark">{order.customer_name}</p>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-ink-muted font-semibold">{order.address}</p>
            <p className="text-sm text-ink-muted">
              {order.order_items?.map((oi) => `${oi.products?.name} × ${oi.quantity}`).join(', ')}
            </p>
            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`} className="btn-secondary flex items-center justify-center h-12">
                📞 {order.customer_phone}
              </a>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={order.status === 'yolda'}
                onClick={() => setStatus(order.id, 'yolda')}
                className="btn-secondary flex-1 h-12"
              >
                {t('driver.departed')}
              </button>
              <button
                type="button"
                onClick={() => setStatus(order.id, 'yetkazildi')}
                className="btn-primary flex-1 h-12"
              >
                {t('driver.delivered')}
              </button>
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <p className="text-sm font-bold text-ink-muted mt-4">{t('driver.finished')}</p>
            {done.map((order) => (
              <div key={order.id} className="card p-4 flex items-center justify-between opacity-70">
                <p className="text-ink font-semibold">{order.customer_name}</p>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </>
        )}
      </div>
    </DashboardShell>
  )
}
