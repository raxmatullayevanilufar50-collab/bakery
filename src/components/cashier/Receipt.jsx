import { useTranslation } from 'react-i18next'
import { localeTag } from '../../lib/i18n'

export default function Receipt({ receipt, onClose }) {
  const { t, i18n } = useTranslation()
  const share = async () => {
    const text = `Bakery System\n${receipt.items.map((item) => `${item.product.name} x ${item.quantity}: ${item.product.price * item.quantity}`).join('\n')}\n${t('pos.total')}: ${receipt.total}`
    if (navigator.share) await navigator.share({ title: t('common.brand'), text })
  }
  return <div className="fixed inset-0 z-[180] bg-black/50 flex items-center justify-center p-4">
    <div className="card p-4 w-full max-w-sm">
      <div className="receipt-print font-mono bg-white text-black p-4 mx-auto max-w-[300px]">
        <h2 className="text-center font-bold">Bakery System</h2>
        <p className="text-xs text-center">{receipt.number}</p>
        {receipt.items.map((item) => <div key={item.product.id} className="flex justify-between text-sm"><span>{item.product.name} x{item.quantity}</span><span>{(item.product.price * item.quantity).toLocaleString(localeTag(i18n.language))}</span></div>)}
        <hr className="my-2 border-black" /><p className="flex justify-between font-bold"><span>{t('pos.total')}</span><span>{receipt.total.toLocaleString(localeTag(i18n.language))}</span></p>
      </div>
      <div className="flex gap-2 mt-3"><button type="button" className="btn-primary flex-1 h-11" onClick={() => window.print()}>{t('receipt.print')}</button><button type="button" className="btn-secondary flex-1 h-11" onClick={share}>{t('receipt.share')}</button><button type="button" className="btn-secondary h-11 px-3" onClick={onClose}>×</button></div>
    </div>
  </div>
}
