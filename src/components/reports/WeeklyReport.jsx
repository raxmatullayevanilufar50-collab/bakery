import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { localeTag } from '../../lib/i18n'

export default function WeeklyReport() {
  const { t, i18n } = useTranslation()
  const [days, setDays] = useState([])
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    supabase.from('sales').select('total,created_at').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).then(({ data }) => {
      const totals = Array.from({ length: 7 }, (_, index) => ({ date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + index), total: 0 }))
      ;(data || []).forEach((sale) => { const index = Math.floor((new Date(sale.created_at) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000); if (index >= 0 && index < 7) totals[index].total += Number(sale.total) })
      setDays(totals)
    })
  }, [])
  const total = days.reduce((sum, day) => sum + day.total, 0)
  const highest = days.length ? Math.max(...days.map((day) => day.total)) : 0
  return <div className="card p-4"><h2 className="font-extrabold text-brown-dark mb-3">{t('reports.weeklyTitle')}</h2><div className="flex items-end gap-2 h-32">{days.map((day) => <div key={day.date.toISOString()} className="flex-1 flex flex-col justify-end h-full"><div className="bg-orange rounded-t" style={{ height: `${Math.max(4, highest ? day.total / highest * 100 : 4)}%` }} /><span className="text-[10px] text-center text-ink-muted mt-1">{day.date.toLocaleDateString(localeTag(i18n.language), { weekday: 'short' })}</span></div>)}</div><p className="font-black mt-3">{t('reports.weeklyTotal')}: {total.toLocaleString(localeTag(i18n.language))}</p></div>
}
