import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseProductionUtterance } from '../lib/voiceParse'
import { translateError } from '../lib/errors'
import { localeTag } from '../lib/i18n'
import VoiceRecorder from '../components/VoiceRecorder'

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Baker uchun asosiy sahifa: kun davomida necha dona nima pishirganini
// ovoz yoki matn orqali erkin qayd qiladi. Xodim ID'si va sana avtomatik —
// qo'lda kiritilmaydi. Har bir yozuv alohida qator, ustiga yozilmaydi.
export default function ProductionLogTab() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [todayLogs, setTodayLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: productRows }, { data: logRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit').order('name'),
      supabase
        .from('production_logs')
        .select('id, quantity, created_at, products(name, unit)')
        .eq('profile_id', profile.id)
        .gte('created_at', startOfDay().toISOString())
        .order('created_at', { ascending: false }),
    ])
    setProducts(productRows || [])
    setTodayLogs(logRows || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  function handleTranscript(transcript) {
    setError('')
    const parsed = parseProductionUtterance(transcript, products)
    setDraft({
      productId: parsed.productId,
      quantity: parsed.quantity ? String(parsed.quantity) : '',
    })
  }

  function updateDraft(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))
  }

  async function confirmDraft() {
    setError('')
    const quantity = Number(draft.quantity)
    if (!draft.productId || !quantity || quantity <= 0) {
      setError(t('productionLog.invalidDraft'))
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('production_logs').insert({
      company_id: profile.company_id,
      profile_id: profile.id,
      product_id: draft.productId,
      quantity,
    })
    setSaving(false)
    if (insertError) {
      setError(translateError(t, insertError))
      return
    }
    setDraft(null)
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6 flex flex-col items-center gap-2">
        <h2 className="font-extrabold text-brown-dark mb-2">{t('productionLog.title')}</h2>
        <p className="text-xs text-ink-muted text-center max-w-xs mb-2">{t('productionLog.example')}</p>
        <VoiceRecorder onTranscript={handleTranscript} />
      </div>

      {draft && (
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-extrabold text-brown-dark">{t('productionLog.confirmTitle')}</h3>
          <select className="input" value={draft.productId} onChange={updateDraft('productId')}>
            <option value="">{t('productionLog.selectProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            placeholder={t('productionLog.quantity')}
            value={draft.quantity}
            onChange={updateDraft('quantity')}
          />
          {error && <p className="text-sm text-bad font-semibold">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="btn-secondary flex-1">
              {t('voiceSale.no')}
            </button>
            <button type="button" onClick={confirmDraft} disabled={saving} className="btn-primary flex-1">
              {saving ? t('common.saving') : t('voiceSale.yes')}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-extrabold text-brown-dark">{t('productionLog.todayEntries')}</h2>
        {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
        {!loading && todayLogs.length === 0 && (
          <p className="text-ink-muted font-semibold">{t('productionLog.noEntries')}</p>
        )}
        {todayLogs.map((log) => (
          <div key={log.id} className="card p-3 flex items-center justify-between text-sm">
            <span className="text-ink font-semibold">
              {log.products?.name} × {log.quantity} {log.products?.unit}
            </span>
            <span className="text-ink-muted">
              {new Date(log.created_at).toLocaleTimeString(localeTag(i18n.language), {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
