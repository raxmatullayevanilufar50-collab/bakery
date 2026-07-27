import { useTranslation } from 'react-i18next'

const COLORS = {
  // production_tasks / orders / shifts umumiy holatlari
  rejalashtirilgan: 'bg-orange-pale text-brown',
  jarayonda: 'bg-orange-pale text-brown',
  tayyor: 'bg-good-bg text-good',
  bekor_qilingan: 'bg-bad-bg text-bad',
  faol: 'bg-orange-pale text-brown',
  tugallangan: 'bg-good-bg text-good',
  // orders
  yangi: 'bg-[#E8F4FF] text-[#1A6BA0]',
  tayyorlanmoqda: 'bg-orange-pale text-brown',
  yolda: 'bg-[#F1E8FF] text-[#7B3FA0]',
  yetkazildi: 'bg-good-bg text-good',
  bekor_qilindi: 'bg-bad-bg text-bad',
}

export default function StatusBadge({ status }) {
  const { t } = useTranslation()
  return (
    <span
      className={`px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide whitespace-nowrap ${
        COLORS[status] || 'bg-orange-pale text-brown'
      }`}
    >
      {t(`status.${status}`, status)}
    </span>
  )
}
