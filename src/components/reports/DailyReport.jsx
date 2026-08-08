import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { localeTag } from '../../lib/i18n'
import Skeleton from '../ui/Skeleton'

function dateValue(date) {
  return date.toISOString().slice(0, 10)
}

export default function DailyReport() {
  const { t, i18n } = useTranslation()
  const [date, setDate] = useState(dateValue(new Date()))
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const start = new Date(`${date}T00:00:00`)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      const { data } = await supabase.from('sales').select('id,quantity,total,created_at,products(name,category)').gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
      if (!cancelled) { setSales(data || []); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [date])
  const summary = useMemo(() => {
    const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0)
    const items = sales.reduce((sum, sale) => sum + Number(sale.quantity), 0)
    const categories = sales.reduce((result, sale) => { const key = sale.products?.category || 'boshqa'; result[key] = (result[key] || 0) + Number(sale.total); return result }, {})
    const hours = sales.reduce((result, sale) => { const key = new Date(sale.created_at).getHours(); result[key] = (result[key] || 0) + Number(sale.total); return result }, {})
    return { revenue, items, categories, hours }
  }, [sales])
  if (loading) return <Skeleton variant="grid" count={4} />
  const maxCategory = Math.max(...Object.values(summary.categories), 1)
  return <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between"><h2 className="font-extrabold text-brown-dark">{t('reports.dailyTitle')}</h2><input className="input h-10" type="date" aria-label={t('reports.date')} value={date} onChange={(event) => setDate(event.target.value)} /></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[[t('reports.revenue'), summary.revenue.toLocaleString(localeTag(i18n.language))], [t('reports.itemsSold'), summary.items], [t('reports.average'), (summary.revenue / (sales.length || 1)).toLocaleString(localeTag(i18n.language))], [t('reports.transactions'), sales.length]].map(([label, value]) => <div className="card p-4" key={label}><p className="text-xl font-black text-brown-dark">{value}</p><p className="text-xs text-ink-muted font-bold">{label}</p></div>)}
    </div>
    <div className="card p-4"><h3 className="font-extrabold mb-3">{t('reports.byCategory')}</h3>{Object.entries(summary.categories).map(([category, value]) => <div key={category} className="mb-2"><div className="flex justify-between text-sm font-bold"><span>{t(`categories.${category}`)}</span><span>{value.toLocaleString(localeTag(i18n.language))}</span></div><div className="h-2 bg-cream-dark rounded-full"><div className="h-2 bg-orange rounded-full" style={{ width: `${(value / maxCategory) * 100}%` }} /></div></div>)}</div>
    <div className="card p-4"><h3 className="font-extrabold mb-3">{t('reports.hourly')}</h3><div className="flex items-end gap-1 h-32">{Array.from({ length: 24 }, (_, hour) => { const value = summary.hours[hour] || 0; const max = Math.max(...Object.values(summary.hours), 1); return <div key={hour} className="flex-1 flex flex-col justify-end h-full" title={`${hour}:00`}><div className="bg-brown rounded-t" style={{ height: `${Math.max(3, value / max * 100)}%` }} /></div> })}</div></div>
  </div>
}
