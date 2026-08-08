import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { translateError } from '../lib/errors'

function tomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Owner/Manager uchun: ertangi kun uchun har bir mahsulotdan qancha
// tayyorlash kerakligini AI yordamida taklif qiladi (forecast-demand
// Edge Function). Raqamlar Postgres'da hisoblangan — bu yerda faqat
// natijani ko'rsatish va production_tasks'ga aylantirish bor.
export default function ForecastTab() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [forecasts, setForecasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [addedTaskIds, setAddedTaskIds] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('demand_forecasts')
      .select('id, product_id, suggested_quantity, confidence_pct, explanation, products(name, unit)')
      .eq('forecast_date', tomorrowDate())
      .order('created_at')
    setForecasts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function generate() {
    setError('')
    setGenerating(true)
    const { error: invokeError } = await supabase.functions.invoke('forecast-demand')
    setGenerating(false)
    if (invokeError) {
      setError(translateError(t, invokeError))
      return
    }
    load()
  }

  async function createTask(forecast) {
    await supabase.from('production_tasks').insert({
      company_id: profile.company_id,
      product_id: forecast.product_id,
      quantity: forecast.suggested_quantity,
    })
    setAddedTaskIds((ids) => [...ids, forecast.id])
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 flex flex-col items-center gap-3 text-center">
        <h2 className="font-extrabold text-brown-dark">{t('forecast.title')}</h2>
        <p className="text-sm text-ink-muted max-w-sm">{t('forecast.subtitle')}</p>
        <button type="button" onClick={generate} disabled={generating} className="btn-primary px-6">
          {generating ? t('forecast.generating') : t('forecast.generate')}
        </button>
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
      </div>

      {loading && <p className="text-ink-muted font-semibold text-center">{t('common.loading')}</p>}
      {!loading && forecasts.length === 0 && (
        <p className="text-ink-muted font-semibold text-center">{t('forecast.empty')}</p>
      )}

      <div className="flex flex-col gap-3">
        {forecasts.map((f) => (
          <div key={f.id} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-brown-dark">{f.products?.name}</p>
              <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-orange-pale text-brown shrink-0">
                ±{Math.max(0, Math.round(100 - f.confidence_pct))}%
              </span>
            </div>
            <p className="text-2xl font-black text-brown-dark">
              {f.suggested_quantity} {f.products?.unit}
            </p>
            {f.explanation && <p className="text-sm text-ink-muted">{f.explanation}</p>}
            <button
              type="button"
              onClick={() => createTask(f)}
              disabled={addedTaskIds.includes(f.id)}
              className="btn-secondary mt-1"
            >
              {addedTaskIds.includes(f.id) ? '✓' : t('forecast.createTask')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
