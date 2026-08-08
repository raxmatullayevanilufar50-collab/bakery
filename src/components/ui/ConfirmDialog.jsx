import { useTranslation } from 'react-i18next'

export default function ConfirmDialog({ title, message, onConfirm, onCancel, destructive = false }) {
  const { t } = useTranslation()
  return <div className="fixed inset-0 z-[190] bg-black/50 flex items-center justify-center p-4">
    <div className="card p-5 w-full max-w-sm">
      <h2 className="font-extrabold text-brown-dark">{title}</h2>
      <p className="text-sm text-ink-muted mt-2">{message}</p>
      <div className="flex gap-2 mt-5">
        <button type="button" className={`${destructive ? 'bg-bad' : 'bg-orange'} text-white rounded-xl h-11 px-4 font-extrabold flex-1`} onClick={onConfirm}>{t('common.confirm')}</button>
        <button type="button" className="btn-secondary h-11 px-4" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  </div>
}
