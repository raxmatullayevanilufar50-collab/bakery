import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { translateError } from '../lib/errors'
import { localeTag } from '../lib/i18n'

// Faqat Owner uchun (nav'da ham faqat Owner'ga qo'shiladi — RLS bilan
// bir xil qoida): xomashyo narxi o'zgarganda avtomatik yaratilgan narx
// tavsiyalarini ko'rsatadi va tasdiqlash/rad etish imkonini beradi.
// Narx/tannarx/marja raqamlari Postgres trigger'ida hisoblangan — bu
// yerda faqat AI izohini (agar hali yozilmagan bo'lsa) so'raymiz.
export default function PricingTab() {
  const { t, i18n } = useTranslation()
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const explainTriggered = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('price_recommendations')
      .select(
        'id, old_price, suggested_price, old_cost, new_cost, target_margin_pct, explanation, status, created_at, products(name)'
      )
      .order('created_at', { ascending: false })
    setRecs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('pricing-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_recommendations' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  // Zaxira: agar InventoryTab'dagi narx yangilanishidan keyin izoh
  // chaqirilmagan bo'lsa (masalan sahifa qayta yuklangan), bir marta
  // izohsiz qolgan tavsiyalar uchun AI'ni chaqiramiz.
  useEffect(() => {
    if (loading || explainTriggered.current) return
    const missing = recs.filter((r) => r.status === 'kutilmoqda' && !r.explanation)
    if (missing.length > 0) {
      explainTriggered.current = true
      supabase.functions
        .invoke('explain-price-recommendation', { body: { recommendationIds: missing.map((r) => r.id) } })
        .then(() => load())
    }
  }, [loading, recs, load])

  async function decide(id, action) {
    setError('')
    setBusyId(id)
    const { error: rpcError } = await supabase.rpc(
      action === 'accept' ? 'apply_price_recommendation' : 'reject_price_recommendation',
      { p_id: id }
    )
    setBusyId(null)
    if (rpcError) setError(translateError(t, rpcError))
    load()
  }

  const pending = recs.filter((r) => r.status === 'kutilmoqda')
  const decided = recs.filter((r) => r.status !== 'kutilmoqda')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-extrabold text-brown-dark mb-3">{t('pricing.pendingTitle')}</h2>
        {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
        {!loading && pending.length === 0 && (
          <p className="text-ink-muted font-semibold">{t('pricing.noPending')}</p>
        )}
        <div className="flex flex-col gap-3">
          {pending.map((r) => (
            <div key={r.id} className="card p-4 flex flex-col gap-2">
              <p className="font-bold text-brown-dark">{r.products?.name}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-muted line-through">
                  {Number(r.old_price).toLocaleString(localeTag(i18n.language))}
                </span>
                <span className="text-ink-muted">→</span>
                <span className="font-extrabold text-brown-dark">
                  {Number(r.suggested_price).toLocaleString(localeTag(i18n.language))} {t('common.currency')}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                {t('pricing.costLine', {
                  oldCost: Number(r.old_cost).toLocaleString(localeTag(i18n.language)),
                  newCost: Number(r.new_cost).toLocaleString(localeTag(i18n.language)),
                  margin: r.target_margin_pct,
                })}
              </p>
              {r.explanation ? (
                <p className="text-sm text-ink bg-orange-pale/50 rounded-lg p-2">{r.explanation}</p>
              ) : (
                <p className="text-sm text-ink-muted italic">{t('pricing.explaining')}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'reject')}
                  className="btn-secondary flex-1"
                >
                  {t('pricing.reject')}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'accept')}
                  className="btn-primary flex-1"
                >
                  {t('pricing.accept')}
                </button>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-bad font-semibold mt-2">{error}</p>}
      </div>

      {decided.length > 0 && (
        <div>
          <h2 className="font-extrabold text-brown-dark mb-3">{t('pricing.historyTitle')}</h2>
          <div className="flex flex-col gap-2">
            {decided.map((r) => (
              <div key={r.id} className="card p-3 flex items-center justify-between text-sm">
                <span className="text-ink font-semibold">{r.products?.name}</span>
                <span className={r.status === 'qabul_qilindi' ? 'text-good font-bold' : 'text-ink-muted font-bold'}>
                  {t(`pricing.status_${r.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
