import { useTranslation } from 'react-i18next'
import { localeTag } from '../../lib/i18n'

function money(value, lang) {
  return Number(value || 0).toLocaleString(localeTag(lang))
}

// Kunlik yopish hisoboti (Z-hisobot) — chek bilan bir xil `receipt-print`
// uslubidan foydalanadi, shuning uchun termal printerdan ham, ekrandan
// screenshot sifatida ham bir xil o'qiladi.
export default function ZReport({ report, companyName, closedByName, onClose }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const breakdown = Array.isArray(report.product_breakdown) ? report.product_breakdown : []
  const closedAt = report.closed_at ? new Date(report.closed_at) : null
  const average = report.transaction_count > 0 ? Number(report.total_sales) / report.transaction_count : 0

  return (
    <div className="fixed inset-0 z-[180] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card p-4 w-full max-w-sm my-auto">
        <div className="receipt-print font-mono bg-white text-black p-4 mx-auto w-full max-w-[300px] text-[13px] leading-snug">
          <h2 className="text-center font-bold text-base uppercase break-words">
            {companyName || t('common.brand')}
          </h2>
          <p className="text-center font-bold text-[11px] tracking-wider">{t('dailyClose.receiptTitle')}</p>

          <div className="border-t border-dashed border-black my-2" />

          <div className="flex justify-between text-[11px]">
            <span>{t('dailyClose.reportDate')}</span>
            <span className="font-bold">
              {new Date(`${report.report_date}T00:00:00`).toLocaleDateString(localeTag(lang))}
            </span>
          </div>
          {closedAt && (
            <div className="flex justify-between text-[11px]">
              <span>{t('dailyClose.closedAt')}</span>
              <span>
                {closedAt.toLocaleDateString(localeTag(lang))}{' '}
                {closedAt.toLocaleTimeString(localeTag(lang), { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          {closedByName && (
            <div className="flex justify-between text-[11px]">
              <span>{t('dailyClose.closedBy')}</span>
              <span className="truncate max-w-[55%] text-right">{closedByName}</span>
            </div>
          )}

          <div className="border-t border-dashed border-black my-2" />

          <p className="font-bold text-[11px] mb-1">{t('dailyClose.byProduct')}</p>
          {breakdown.length === 0 && <p className="text-[11px]">{t('dailyClose.noSalesThatDay')}</p>}
          {breakdown.map((row) => (
            <div key={row.product_name} className="mb-1.5">
              <p className="break-words">{row.product_name}</p>
              <div className="flex justify-between">
                <span className="text-[11px]">
                  {Number(row.quantity).toLocaleString(localeTag(lang))}
                  {row.unit ? ` ${row.unit}` : ''}
                </span>
                <span className="font-bold">{money(row.total, lang)}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-dashed border-black my-2" />

          <div className="flex justify-between text-[11px]">
            <span>{t('dailyClose.transactions')}</span>
            <span className="font-bold">{report.transaction_count}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>{t('dailyClose.itemsSold')}</span>
            <span className="font-bold">{Number(report.item_count).toLocaleString(localeTag(lang))}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>{t('dailyClose.average')}</span>
            <span>{money(Math.round(average), lang)}</span>
          </div>

          <div className="flex justify-between font-bold text-base mt-2">
            <span>{t('dailyClose.grandTotal')}</span>
            <span>{money(report.total_sales, lang)}</span>
          </div>
          <p className="text-right text-[11px]">{t('common.currency')}</p>

          <div className="border-t border-dashed border-black my-2" />

          <p className="text-center text-[11px]">{t('dailyClose.footer')}</p>
        </div>

        <div className="flex gap-2 mt-3">
          <button type="button" className="btn-primary flex-1 h-11" onClick={() => window.print()}>
            {t('receipt.print')}
          </button>
          <button type="button" className="btn-secondary flex-1 h-11" onClick={onClose}>
            {t('receipt.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
