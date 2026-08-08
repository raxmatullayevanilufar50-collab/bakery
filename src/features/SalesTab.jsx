import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseSaleUtterance } from '../lib/voiceParse'
import { translateError } from '../lib/errors'
import { localeTag } from '../lib/i18n'
import { exportToExcel } from '../lib/xlsxExport'
import VoiceRecorder from '../components/VoiceRecorder'

const HISTORY_LIMIT = 500
const EMPTY_ROW = { productId: '', quantity: '', total: '' }

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Ko'p punktli gapni ("3 ta somsa, 2 ta non sotildi") aniqlash uchun
// oddiy signal — vergul yoki "va" bo'lsa, mahalliy (bitta-punktli)
// parser yetarli emas, AI-asosli tahlilga murojaat qilinadi.
function looksMultiItem(transcript) {
  return /,| va /.test(transcript.toLowerCase())
}

export default function SalesTab() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const [sales, setSales] = useState([])
  const [employees, setEmployees] = useState([])
  const [products, setProducts] = useState([])
  const [todayTotal, setTodayTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ date: '', employeeId: '', productId: '' })

  const [entryMode, setEntryMode] = useState(null) // null | 'voice' | 'manual'
  const [draftItems, setDraftItems] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [aiTranscript, setAiTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const loadStatic = useCallback(async () => {
    const [{ data: productRows }, { data: employeeRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit, price').order('name'),
      isOwner
        ? supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] }),
    ])
    setProducts(productRows || [])
    setEmployees(employeeRows || [])
  }, [isOwner])

  const loadSales = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('id, quantity, unit_price, total, customer_name, created_at, cashier_id, profiles(full_name), products(name, unit)')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)

    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00`)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
    }
    if (filters.employeeId) query = query.eq('cashier_id', filters.employeeId)
    if (filters.productId) query = query.eq('product_id', filters.productId)

    const { data } = await query
    setSales(data || [])
    setLoading(false)
  }, [filters])

  const loadTodayTotal = useCallback(async () => {
    const { data } = await supabase.from('sales').select('total').gte('created_at', startOfDay().toISOString())
    setTodayTotal((data || []).reduce((sum, r) => sum + Number(r.total), 0))
  }, [])

  useEffect(() => {
    loadStatic()
  }, [loadStatic])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  useEffect(() => {
    loadTodayTotal()
  }, [loadTodayTotal])

  // Realtime — boshqa qurilmadan (masalan ovoz orqali) kiritilgan savdo
  // ham darhol ko'rinadi (4-bo'lim, 8-talab; 20260729090100 migratsiyasi).
  useEffect(() => {
    const channel = supabase
      .channel('sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        loadSales()
        loadTodayTotal()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadSales, loadTodayTotal])

  function rowFromLocalParse(transcript) {
    const parsed = parseSaleUtterance(transcript, products)
    return {
      row: {
        productId: parsed.productId,
        quantity: parsed.quantity ? String(parsed.quantity) : '',
        total: parsed.total ? String(parsed.total) : '',
      },
      customerName: parsed.customerName || '',
    }
  }

  async function handleTranscript(transcript) {
    setError('')
    const local = rowFromLocalParse(transcript)

    // Yagona-punktli, mahalliy parser to'liq topa olgan holatda — tezkor
    // yo'l, tarmoqqa chiqmaydi.
    if (!looksMultiItem(transcript) && local.row.productId) {
      setDraftItems([local.row])
      setCustomerName(local.customerName)
      setAiTranscript('')
      setEntryMode(null)
      return
    }

    setParsing(true)
    const { data, error: invokeError } = await supabase.functions.invoke('parse-voice-command', {
      body: { transcript },
    })
    setParsing(false)

    if (!invokeError && data?.items?.length > 0) {
      setDraftItems(
        data.items.map((item) => {
          const product = products.find((p) => p.id === item.productId)
          const total = product ? Number(product.price) * Number(item.quantity) : 0
          return { productId: item.productId, quantity: String(item.quantity), total: String(total) }
        })
      )
      setCustomerName(local.customerName)
      setAiTranscript(transcript)
      setEntryMode(null)
      return
    }

    // AI ham hech narsa topa olmadi — mahalliy natija (bo'lsa) yoki
    // bo'sh qator bilan qo'lda to'ldirish uchun ekran ochiladi.
    setDraftItems([local.row.productId ? local.row : { ...EMPTY_ROW }])
    setCustomerName(local.customerName)
    setAiTranscript('')
    setEntryMode(null)
  }

  function openManualEntry() {
    setError('')
    setDraftItems([{ ...EMPTY_ROW }])
    setCustomerName('')
    setAiTranscript('')
    setEntryMode(null)
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
    const rows = draftItems.map((r) => ({
      productId: r.productId,
      quantity: Number(r.quantity),
      total: Number(r.total),
    }))
    const invalid = rows.some((r) => !r.productId || !r.quantity || r.quantity <= 0 || !r.total || r.total <= 0)
    if (rows.length === 0 || invalid) {
      setError(t('voiceSale.invalidDraft'))
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('sales').insert(
      rows.map((r) => ({
        company_id: profile.company_id,
        cashier_id: profile.id,
        product_id: r.productId,
        quantity: r.quantity,
        unit_price: r.total / r.quantity,
        total: r.total,
        customer_name: customerName || null,
      }))
    )
    setSaving(false)
    if (insertError) {
      setError(translateError(t, insertError))
      return
    }

    // AI orqali tahlil qilingan bo'lsa — shaffoflik uchun xom matn va
    // natijani audit_logs'ga yozamiz (Owner audit jurnalida ko'radi).
    if (aiTranscript) {
      supabase.rpc('log_ai_voice_command', {
        p_transcript: aiTranscript,
        p_parsed: rows,
        p_model: 'claude-haiku-4-5',
        p_target_table: 'sales',
      })
    }

    setSuccess(t('voiceSale.saved'))
    setDraftItems(null)
    setCustomerName('')
    setAiTranscript('')
    loadSales()
    loadTodayTotal()
    setTimeout(() => setSuccess(''), 3000)
  }

  async function exportSales() {
    const rows = sales.map((s) => ({
      [t('reports.colDate')]: new Date(s.created_at).toLocaleString(localeTag(i18n.language)),
      [t('reports.colEmployee')]: s.profiles?.full_name || '',
      [t('reports.colProduct')]: s.products?.name || '',
      [t('reports.colQuantity')]: s.quantity,
      [t('reports.colPrice')]: s.total,
      [t('reports.colCustomer')]: s.customer_name || '',
    }))
    await exportToExcel(rows, 'savdo-hisoboti.xlsx', 'Savdo')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 text-center">
        <p className="text-3xl font-black text-brown-dark">
          {todayTotal.toLocaleString(localeTag(i18n.language))} {t('common.currency')}
        </p>
        <p className="text-xs text-ink-muted font-semibold mt-1">{t('sales.todayTotal')}</p>
      </div>

      <div className="card p-5 flex flex-col items-center gap-3">
        {entryMode !== 'voice' && !draftItems && (
          <div className="flex gap-3 w-full max-w-sm">
            <button type="button" onClick={() => setEntryMode('voice')} className="btn-primary flex-1">
              🎤 {t('sales.voiceEntry')}
            </button>
            <button type="button" onClick={openManualEntry} className="btn-secondary flex-1">
              ✍️ {t('sales.manualEntry')}
            </button>
          </div>
        )}
        {entryMode === 'voice' && !draftItems && (
          <>
            <VoiceRecorder onTranscript={handleTranscript} />
            {parsing && <p className="text-sm text-ink-muted font-semibold">{t('voiceSale.analyzing')}</p>}
            <button type="button" onClick={() => setEntryMode(null)} className="text-sm text-ink-muted underline font-semibold">
              {t('common.back')}
            </button>
          </>
        )}
      </div>

      {success && <div className="card p-4 text-center text-good font-bold">{success}</div>}

      {draftItems && (
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-extrabold text-brown-dark">{t('voiceSale.confirmTitle')}</h3>

          {draftItems.map((row, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 border-b border-brown/10 pb-3 last:border-0 last:pb-0"
            >
              <select className="input flex-1 min-w-[140px]" value={row.productId} onChange={updateRow(index, 'productId')}>
                <option value="">{t('voiceSale.selectProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                className="input w-24"
                type="number"
                placeholder={t('voiceSale.quantity')}
                value={row.quantity}
                onChange={updateRow(index, 'quantity')}
              />
              <input
                className="input w-28"
                type="number"
                placeholder={t('voiceSale.total')}
                value={row.total}
                onChange={updateRow(index, 'total')}
              />
              {draftItems.length > 1 && (
                <button type="button" onClick={() => removeRow(index)} className="text-bad text-sm font-bold underline">
                  {t('common.remove')}
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addRow} className="text-sm text-orange font-bold underline self-start">
            + {t('voiceSale.addRow')}
          </button>

          <input
            className="input"
            placeholder={t('voiceSale.customerName')}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

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

      {isOwner && (
        <div className="card p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-ink-muted block mb-1">{t('sales.filterDate')}</label>
            <input
              className="input w-full"
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-bold text-ink-muted block mb-1">{t('sales.filterEmployee')}</label>
            <select
              className="input w-full"
              value={filters.employeeId}
              onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">{t('sales.allEmployees')}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-bold text-ink-muted block mb-1">{t('sales.filterProduct')}</label>
            <select
              className="input w-full"
              value={filters.productId}
              onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value }))}
            >
              <option value="">{t('sales.allProducts')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={exportSales} className="btn-secondary px-4 h-12 shrink-0">
            📥 {t('reports.exportExcel')}
          </button>
        </div>
      )}

      <div className="card p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted border-b border-brown/10">
                <th className="py-2 pr-3 font-extrabold">{t('reports.colDate')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('sales.colTime')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colEmployee')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colProduct')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colQuantity')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colPrice')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('reports.colCustomer')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-ink-muted font-semibold">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-ink-muted font-semibold">
                    {t('reports.noSales')}
                  </td>
                </tr>
              )}
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-brown/5 hover:bg-orange-pale/50">
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString(localeTag(i18n.language))}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">
                    {new Date(s.created_at).toLocaleTimeString(localeTag(i18n.language), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2 pr-3 text-ink font-semibold whitespace-nowrap">{s.profiles?.full_name}</td>
                  <td className="py-2 pr-3 text-ink whitespace-nowrap">{s.products?.name}</td>
                  <td className="py-2 pr-3 text-ink">
                    {s.quantity} {s.products?.unit}
                  </td>
                  <td className="py-2 pr-3 text-brown-dark font-bold whitespace-nowrap">
                    {Number(s.total).toLocaleString(localeTag(i18n.language))} {t('common.currency')}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">{s.customer_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
