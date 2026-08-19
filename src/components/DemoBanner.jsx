import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

// Demo rejimida ekran tepasida doimiy turadigan tasma. Maqsad — ko'rib
// turgan odam bu ma'lumotni haqiqiy deb o'ylab qolmasligi.
export default function DemoBanner() {
  const { t } = useTranslation()
  const { isDemo, signOut } = useAuth()
  if (!isDemo) return null

  return (
    <div className="bg-gradient-to-r from-orange to-brown-light text-white px-4 py-2 flex items-center justify-center gap-3 text-center">
      <p className="text-xs sm:text-sm font-extrabold">
        🎬 {t('demo.bannerTitle')}
        <span className="hidden sm:inline font-semibold opacity-90"> — {t('demo.bannerSubtitle')}</span>
      </p>
      <button
        type="button"
        onClick={signOut}
        className="text-[11px] font-extrabold underline underline-offset-2 shrink-0 opacity-90 hover:opacity-100"
      >
        {t('demo.exit')}
      </button>
    </div>
  )
}
