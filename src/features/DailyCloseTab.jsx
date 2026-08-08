import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { translateError } from '../lib/errors'
import { localeTag } from '../lib/i18n'
import { todayInTashkent } from '../lib/businessDay'
import ZReport from '../components/reports/ZReport'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'

const HISTORY_LIMIT = 90

export default function DailyCloseTab() {
  const { t, i18n } = useTranslation()
  const { company } = useAuth()
  const toast = useToast()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [openReport, setOpenReport] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('daily_reports')
      .select('id, report_date, total_sales, transaction_count, item_count, product_breakdown, closed_at, profiles(full_name)')
      .order('report_date', { ascending: false })
      .limit(HISTORY_LIMIT)
    if (loadError) setError(translateError(t, loadError))
    setReports(data || [])
    setLoading(false)
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const today = todayInTashkent()
  const todayClosed = reports.some((r) => r.report_date === today)

  async function closeToday() {
    setConfirmOpen(false)
    setError('')
    setClosing(true)
    const { data, error: rpcError } = await supabase.rpc('close_day', { p_date: today })
    setClosing(false)
    if (rpcError) {
      setError(translateError(t, rpcError))
      return
    }
    toast.success(t('dailyClose.closed'))
    await load()
    setOpenReport({ ...data, profiles: null })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-extrabold text-brown-dark">{t('dailyClose.title')}</h2>
          <p className="text-xs text-ink-muted font-semibold mt-1">{t('dailyClose.hint')}</p>
        </div>
        {todayClosed && (
          <p className="text-sm text-good font-bold">{t('dailyClose.alreadyClosedToday')}</p>
        )}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={closing}
          className="btn-primary h-12"
        >
          {closing ? t('common.saving') : todayClosed ? t('dailyClose.recloseButton') : t('dailyClose.button')}
        </button>
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
      </div>

      <div className="card p-4">
        <h3 className="font-extrabold text-brown-dark mb-3">{t('dailyClose.history')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted border-b border-brown/10">
                <th className="py-2 pr-3 font-extrabold">{t('dailyClose.reportDate')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('dailyClose.grandTotal')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('dailyClose.transactions')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('dailyClose.itemsSold')}</th>
                <th className="py-2 pr-3 font-extrabold">{t('dailyClose.closedBy')}</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-ink-muted font-semibold">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-ink-muted font-semibold">
                    {t('dailyClose.noReports')}
                  </td>
                </tr>
              )}
              {reports.map((report) => (
                <tr key={report.id} className="border-b border-brown/5 hover:bg-orange-pale/50">
                  <td className="py-2 pr-3 text-ink font-semibold whitespace-nowrap">
                    {new Date(`${report.report_date}T00:00:00`).toLocaleDateString(localeTag(i18n.language))}
                  </td>
                  <td className="py-2 pr-3 text-brown-dark font-bold whitespace-nowrap">
                    {Number(report.total_sales).toLocaleString(localeTag(i18n.language))} {t('common.currency')}
                  </td>
                  <td className="py-2 pr-3 text-ink">{report.transaction_count}</td>
                  <td className="py-2 pr-3 text-ink">
                    {Number(report.item_count).toLocaleString(localeTag(i18n.language))}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">
                    {report.profiles?.full_name || '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => setOpenReport(report)}
                      className="text-orange text-sm font-bold underline whitespace-nowrap"
                    >
                      {t('dailyClose.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title={todayClosed ? t('dailyClose.recloseButton') : t('dailyClose.button')}
          message={todayClosed ? t('dailyClose.confirmReclose') : t('dailyClose.confirmMessage')}
          onConfirm={closeToday}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {openReport && (
        <ZReport
          report={openReport}
          companyName={company?.name}
          closedByName={openReport.profiles?.full_name}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  )
}
