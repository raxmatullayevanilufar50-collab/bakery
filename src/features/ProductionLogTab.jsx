import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseProductionUtterance } from '../lib/voiceParse'
import { translateError } from '../lib/errors'
import { localeTag } from '../lib/i18n'
import VoiceRecorder from '../components/VoiceRecorder'
import { applyDemoProduction, useDemoStore } from '../lib/demoStore'

const EMPTY_ROW = { productId: '', quantity: '' }

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Ko'p punktli gapni ("o'n dona somsa, besh dona non pishirdim")
// aniqlash uchun oddiy signal — feature parity SalesTab bilan bir xil.
function looksMultiItem(transcript) {
  return /,| va /.test(transcript.toLowerCase())
}

// Baker uchun asosiy sahifa: kun davomida necha dona nima pishirganini
// ovoz yoki matn orqali erkin qayd qiladi. Har bir tasdiqlangan qator
// production_logs'ga yoziladi — serverdagi trigger
// (apply_production_log_inventory_impact, 20260729090100) retsept
// bo'yicha xomashyoni avtomatik kamaytiradi.
export default function ProductionLogTab() {
  const { t, i18n } = useTranslation()
  const { profile, isDemo } = useAuth()
  const demo = useDemoStore()
  const [products, setProducts] = useState([])
  // Demo rejimida pishirish zanjirini mijoz tomonda hisoblash uchun
  // retseptlar kerak (serverdagi trigger nima qilsa, o'shani takrorlaymiz).
  const [recipes, setRecipes] = useState([])
  const [todayLogs, setTodayLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [draftItems, setDraftItems] = useState(null)
  const [aiTranscript, setAiTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: productRows }, { data: logRows }, { data: recipeRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit').order('name'),
      supabase
        .from('production_logs')
        .select('id, quantity, created_at, products(name, unit)')
        .eq('profile_id', profile.id)
        .gte('created_at', startOfDay().toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('product_ingredients').select('product_id, inventory_item_id, quantity_per_unit'),
    ])
    setProducts(productRows || [])
    setTodayLogs(logRows || [])
    setRecipes(recipeRows || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('production-log-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  function rowFromLocalParse(transcript) {
    const parsed = parseProductionUtterance(transcript, products)
    return { productId: parsed.productId, quantity: parsed.quantity ? String(parsed.quantity) : '' }
  }

  async function handleTranscript(transcript) {
    setError('')
    const local = rowFromLocalParse(transcript)

    if (!looksMultiItem(transcript) && local.productId) {
      setDraftItems([local])
      setAiTranscript('')
      return
    }

    setParsing(true)
    const { data, error: invokeError } = await supabase.functions.invoke('parse-voice-command', {
      body: { transcript },
    })
    setParsing(false)

    if (!invokeError && data?.items?.length > 0) {
      setDraftItems(data.items.map((item) => ({ productId: item.productId, quantity: String(item.quantity) })))
      setAiTranscript(transcript)
      return
    }

    setDraftItems([local.productId ? local : { ...EMPTY_ROW }])
    setAiTranscript('')
  }

  function updateRow(index, field) {
    return (e) => {
      const value = e.target.value
      setDraftItems((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
    }
  }

  function addRow() {
    setDraftItems((rows) => [...rows, { ...EMPTY_ROW }])
  }

  function removeRow(index) {
    setDraftItems((rows) => rows.filter((_, i) => i !== index))
  }

  async function confirmDraft() {
    setError('')
    const rows = draftItems.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) }))
    const invalid = rows.some((r) => !r.productId || !r.quantity || r.quantity <= 0)
    if (rows.length === 0 || invalid) {
      setError(t('productionLog.invalidDraft'))
      return
    }

    // Demo rejimi: bazaga yozilmaydi, lekin serverdagi trigger nima
    // qilsa o'shani mijoz tomonda takrorlaymiz — xomashyo retsept
    // bo'yicha kamayadi, tayyor mahsulot vitrinaga tushadi. Natija
    // Ombor va Kassa ekranlarida ham ko'rinadi.
    if (isDemo) {
      const inventoryDelta = {}
      const displayDelta = {}
      for (const r of rows) {
        displayDelta[r.productId] = (displayDelta[r.productId] || 0) + r.quantity
        for (const ing of recipes.filter((x) => x.product_id === r.productId)) {
          inventoryDelta[ing.inventory_item_id] =
            (inventoryDelta[ing.inventory_item_id] || 0) - Number(ing.quantity_per_unit) * r.quantity
        }
      }
      applyDemoProduction({
        logs: rows.map((r) => {
          const product = products.find((p) => p.id === r.productId)
          return {
            id: 'demo-' + crypto.randomUUID(),
            quantity: r.quantity,
            created_at: new Date().toISOString(),
            products: { name: product?.name, unit: product?.unit },
          }
        }),
        inventoryDelta,
        displayDelta,
      })
      setDraftItems(null)
      setAiTranscript('')
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('production_logs').insert(
      rows.map((r) => ({
        company_id: profile.company_id,
        profile_id: profile.id,
        product_id: r.productId,
        quantity: r.quantity,
      }))
    )
    setSaving(false)
    if (insertError) {
      setError(translateError(t, insertError))
      return
    }

    if (aiTranscript) {
      supabase.rpc('log_ai_voice_command', {
        p_transcript: aiTranscript,
        p_parsed: rows,
        p_model: 'claude-haiku-4-5',
        p_target_table: 'production_logs',
      })
    }

    setDraftItems(null)
    setAiTranscript('')
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6 flex flex-col items-center gap-2">
        <h2 className="font-extrabold text-brown-dark mb-2">{t('productionLog.title')}</h2>
        <p className="text-xs text-ink-muted text-center max-w-xs mb-2">{t('productionLog.example')}</p>
        <VoiceRecorder onTranscript={handleTranscript} />
        {parsing && <p className="text-sm text-ink-muted font-semibold">{t('productionLog.analyzing')}</p>}
      </div>

      {draftItems && (
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-extrabold text-brown-dark">{t('productionLog.confirmTitle')}</h3>

          {draftItems.map((row, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 border-b border-brown/10 pb-3 last:border-0 last:pb-0"
            >
              <select className="input flex-1 min-w-[140px]" value={row.productId} onChange={updateRow(index, 'productId')}>
                <option value="">{t('productionLog.selectProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                className="input w-24"
                type="number"
                placeholder={t('productionLog.quantity')}
                value={row.quantity}
                onChange={updateRow(index, 'quantity')}
              />
              {draftItems.length > 1 && (
                <button type="button" onClick={() => removeRow(index)} className="text-bad text-sm font-bold underline">
                  {t('common.remove')}
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addRow} className="text-sm text-orange font-bold underline self-start">
            + {t('productionLog.addRow')}
          </button>

          {error && <p className="text-sm text-bad font-semibold">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraftItems(null)} className="btn-secondary flex-1">
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
        {!loading && todayLogs.length === 0 && demo.productionLogs.length === 0 && (
          <p className="text-ink-muted font-semibold">{t('productionLog.noEntries')}</p>
        )}
        {[...demo.productionLogs, ...todayLogs].map((log) => (
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
