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
const EMPTY_DRAFT = { productId: '', quantity: '', total: '', customerName: '' }

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
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
  const [draft, setDraft] = useState(null)
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

  function handleTranscript(transcript) {
    setError('')
    const parsed = parseSaleUtterance(transcript, products)
    setDraft({
      productId: parsed.productId,
      quantity: parsed.quantity ? String(parsed.quantity) : '',
      total: parsed.total ? String(parsed.total) : '',
      customerName: parsed.customerName,
    })
    setEntryMode(null)
  }

  function openManualEntry() {
    setError('')
    setDraft(EMPTY_DRAFT)
    setEntryMode(null)
  }

  function updateDraft(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))
  }

  async function confirmDraft() {
    setError('')
    const quantity = Number(draft.quantity)
    const total = Number(draft.total)
    if (!draft.productId || !quantity || quantity <= 0 || !total || total <= 0) {
      setError(t('voiceSale.invalidDraft'))
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('sales').insert({
      company_id: profile.company_id,
      cashier_id: profile.id,
      product_id: draft.productId,
      quantity,
      unit_price: total / quantity,
      total,
      customer_name: draft.customerName || null,
    })
    setSaving(false)
    if (insertError) {
      setError(translateError(t, insertError))
      return
    }
    setSuccess(t('voiceSale.saved'))
    setDraft(null)
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
        {entryMode !== 'voice' && !draft && (
          <div className="flex gap-3 w-full max-w-sm">
            <button type="button" onClick={() => setEntryMode('voice')} className="btn-primary flex-1">
              🎤 {t('sales.voiceEntry')}
            </button>
            <button type="button" onClick={openManualEntry} className="btn-secondary flex-1">
              ✍️ {t('sales.manualEntry')}
            </button>
          </div>
        )}
        {entryMode === 'voice' && !draft && (
          <>
            <VoiceRecorder onTranscript={handleTranscript} />
            <button type="button" onClick={() => setEntryMode(null)} className="text-sm text-ink-muted underline font-semibold">
              {t('common.back')}
            </button>
          </>
        )}
      </div>

      {success && <div className="card p-4 text-center text-good font-bold">{success}</div>}

      {draft && (
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-extrabold text-brown-dark">{t('voiceSale.confirmTitle')}</h3>
          <select className="input" value={draft.productId} onChange={updateDraft('productId')}>
            <option value="">{t('voiceSale.selectProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            placeholder={t('voiceSale.quantity')}
            value={draft.quantity}
            onChange={updateDraft('quantity')}
          />
          <input
            className="input"
            type="number"
            placeholder={t('voiceSale.total')}
            value={draft.total}
            onChange={updateDraft('total')}
          />
          <input
            className="input"
            placeholder={t('voiceSale.customerName')}
            value={draft.customerName}
            onChange={updateDraft('customerName')}
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
