import { useTranslation } from 'react-i18next'
import { localeTag } from '../../lib/i18n'

// Chek raqami — sotuv UUID'sining birinchi 6 belgisi. Mijoz uchun qisqa,
// aytib berish oson, baza ichida esa savdo qatoriga bevosita bog'langan.
function receiptNumber(saleId) {
  if (!saleId) return '------'
  return String(saleId).replace(/-/g, '').slice(0, 6).toUpperCase()
}

function money(value, lang) {
  return Number(value || 0).toLocaleString(localeTag(lang))
}

// Chek 80mm termal printerga mos o'lchamda (max 300px ≈ 72mm bosiladigan
// kenglik), monoshrift va faqat qora-oq ranglarda chiziladi. Shu bilan
// hozircha ekrandan o'qish/screenshot olish ham, keyinchalik printer
// ulanganda window.print() orqali chop etish ham bir xil ko'rinish beradi.
export default function Receipt({ receipt, onClose }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const number = receiptNumber(receipt.number)
  const createdAt = receipt.createdAt ? new Date(receipt.createdAt) : new Date()
  const companyName = receipt.companyName || t('common.brand')

  const lines = receipt.items.map((item) => {
    const unitPrice = Number(item.product.price)
    return {
      id: item.product.id,
      name: item.product.name,
      unit: item.product.unit,
      quantity: Number(item.quantity),
      unitPrice,
      lineTotal: unitPrice * Number(item.quantity),
    }
  })
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  // Termal printer uchun oddiy matn nusxasi — ulashishda (Telegram, SMS)
  // ham, keyinchalik ESC/POS drayveriga uzatishda ham shu format ishlaydi.
  function plainText() {
    const rows = lines.map(
      (line) => `${line.name} x${line.quantity} = ${money(line.lineTotal, lang)}`
    )
    return [
      companyName,
      receipt.companyAddress || '',
      `${t('receipt.number')}: ${number}`,
      `${t('receipt.date')}: ${createdAt.toLocaleString(localeTag(lang))}`,
      receipt.cashierName ? `${t('receipt.cashier')}: ${receipt.cashierName}` : '',
      '--------------------------------',
      ...rows,
      '--------------------------------',
      `${t('receipt.grandTotal')}: ${money(receipt.total, lang)} ${t('common.currency')}`,
      '',
      t('receipt.thanks'),
    ]
      .filter(Boolean)
      .join('\n')
  }

  async function share() {
    const text = plainText()
    if (navigator.share) {
      try {
        await navigator.share({ title: companyName, text })
        return
      } catch {
        // Foydalanuvchi bekor qildi yoki ulashish mavjud emas — nusxalashga tushamiz.
      }
    }
    await navigator.clipboard?.writeText(text)
  }

  return (
    <div className="fixed inset-0 z-[180] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card p-4 w-full max-w-sm my-auto">
        <div className="receipt-print font-mono bg-white text-black p-4 mx-auto w-full max-w-[300px] text-[13px] leading-snug">
          <h2 className="text-center font-bold text-base uppercase break-words">{companyName}</h2>
          {receipt.companyAddress && (
            <p className="text-center text-[11px] break-words">{receipt.companyAddress}</p>
          )}

          <div className="border-t border-dashed border-black my-2" />

          <div className="flex justify-between text-[11px]">
            <span>{t('receipt.number')}</span>
            <span className="font-bold">№ {number}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>{t('receipt.date')}</span>
            <span>{createdAt.toLocaleDateString(localeTag(lang))} {createdAt.toLocaleTimeString(localeTag(lang), { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {receipt.cashierName && (
            <div className="flex justify-between text-[11px]">
              <span>{t('receipt.cashier')}</span>
              <span className="truncate max-w-[55%] text-right">{receipt.cashierName}</span>
            </div>
          )}

          <div className="border-t border-dashed border-black my-2" />

          {lines.map((line) => (
            <div key={line.id} className="mb-1.5">
              <p className="break-words">{line.name}</p>
              <div className="flex justify-between">
                <span className="text-[11px]">
                  {line.quantity}{line.unit ? ` ${line.unit}` : ''} × {money(line.unitPrice, lang)}
                </span>
                <span className="font-bold">{money(line.lineTotal, lang)}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-dashed border-black my-2" />

          <div className="flex justify-between text-[11px]">
            <span>{t('receipt.itemCount')}</span>
            <span>{itemCount}</span>
          </div>
          <div className="flex justify-between font-bold text-base mt-1">
            <span>{t('receipt.grandTotal')}</span>
            <span>{money(receipt.total, lang)}</span>
          </div>
          <p className="text-right text-[11px]">{t('common.currency')}</p>

          <div className="border-t border-dashed border-black my-2" />

          <p className="text-center font-bold">{t('receipt.thanks')}</p>
          <p className="text-center text-[11px]">{t('receipt.comeAgain')}</p>
        </div>

        <div className="flex gap-2 mt-3">
          <button type="button" className="btn-primary flex-1 h-11" onClick={() => window.print()}>
            {t('receipt.print')}
          </button>
          <button type="button" className="btn-secondary flex-1 h-11" onClick={share}>
            {t('receipt.share')}
          </button>
          <button
            type="button"
            aria-label={t('receipt.close')}
            className="btn-secondary h-11 px-4"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
