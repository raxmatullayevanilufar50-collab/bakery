import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { localeTag } from '../lib/i18n'
import DailyReport from '../components/reports/DailyReport'
import WeeklyReport from '../components/reports/WeeklyReport'

const HISTORY_LIMIT = 500

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function ReportsTab() {
  const { t, i18n } = useTranslation()
  const [sales, setSales] = useState([])
  const [productionHistory, setProductionHistory] = useState([])
  const [tasksToday, setTasksToday] = useState(0)
  const [ordersToday, setOrdersToday] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [{ data: saleRows }, { count: taskCount }, { count: orderCount }, { data: productionRows }] = await Promise.all([
      supabase
        .from('sales')
        .select('id, total, created_at, products(name)')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('production_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'tayyor')
        .gte('created_at', startOfDay(new Date()).toISOString()),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay(new Date()).toISOString()),
      supabase
        .from('production_logs')
        .select('id, quantity, created_at, profiles(full_name), products(name, unit)')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT),
    ])

    setSales(saleRows || [])
    setTasksToday(taskCount || 0)
    setOrdersToday(orderCount || 0)
    setProductionHistory(productionRows || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const todayTotal = sales
    .filter((s) => new Date(s.created_at) >= startOfDay(new Date()))
    .reduce((sum, s) => sum + Number(s.total), 0)

  const byDay = sales.reduce((acc, s) => {
    const day = new Date(s.created_at).toLocaleDateString(localeTag(i18n.language))
    acc[day] = (acc[day] || 0) + Number(s.total)
    return acc
  }, {})

  if (loading) return <p className="text-ink-muted font-semibold">{t('common.loading')}</p>

  return (
    <div className="flex flex-col gap-6">
      <DailyReport />
      <WeeklyReport />
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-5 text-center">
          <div className="text-2xl mb-1">💰</div>
          <p className="text-2xl font-black text-brown-dark">{todayTotal.toLocaleString(localeTag(i18n.language))}</p>
          <p className="text-xs text-ink-muted font-semibold mt-1">{t('reports.todaySales')}</p>
        </div>
        <div className="card p-5 text-center">
          <div className="text-2xl mb-1">🥖</div>
          <p className="text-2xl font-black text-brown-dark">{tasksToday}</p>
          <p className="text-xs text-ink-muted font-semibold mt-1">{t('reports.todayProduced')}</p>
        </div>
        <div className="card p-5 text-center">
          <div className="text-2xl mb-1">🚚</div>
          <p className="text-2xl font-black text-brown-dark">{ordersToday}</p>
          <p className="text-xs text-ink-muted font-semibold mt-1">{t('reports.todayOrders')}</p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-extrabold text-brown-dark mb-3">{t('reports.last7Days')}</h2>
        {Object.keys(byDay).length === 0 && (
          <p className="text-ink-muted text-sm font-semibold">{t('reports.noSales')}</p>
        )}
        <div className="flex flex-col gap-2">
          {Object.entries(byDay).map(([day, total]) => (
            <div key={day} className="flex justify-between text-sm">
              <span className="text-ink-muted font-semibold">{day}</span>
              <span className="font-bold text-brown-dark">
                {total.toLocaleString(localeTag(i18n.language))} {t('common.currency')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-extrabold text-brown-dark mb-3">{t('reports.productionHistory')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted border-b border-brown/10">
                <th className="py-2 pr-3 font-extrabold">{t('reports.colDate')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colEmployee')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colProduct')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colQuantity')}</th>
              </tr>
            </thead>
            <tbody>
              {productionHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-ink-muted font-semibold">
                    {t('productionLog.noEntries')}
                  </td>
                </tr>
              )}
              {productionHistory.map((p) => (
                <tr key={p.id} className="border-b border-brown/5 hover:bg-orange-pale/50">
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">
                    {new Date(p.created_at).toLocaleString(localeTag(i18n.language))}
                  </td>
                  <td className="py-2 pr-3 text-ink font-semibold whitespace-nowrap">{p.profiles?.full_name}</td>
                  <td className="py-2 pr-3 text-ink whitespace-nowrap">{p.products?.name}</td>
                  <td className="py-2 pr-3 text-ink">
                    {p.quantity} {p.products?.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
