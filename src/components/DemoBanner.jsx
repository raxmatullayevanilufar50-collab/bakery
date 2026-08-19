import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

// Demo mehmoni ko'ra oladigan rollar. Har biri o'z paneliga ega,
// shuning uchun ish beruvchi bitta havoladan butun tizimni ko'radi.
const DEMO_ROLES = ['owner', 'manager', 'baker', 'cashier', 'driver']

// Demo rejimida ekran tepasida doimiy turadigan tasma. Maqsad — ko'rib
// turgan odam bu ma'lumotni haqiqiy deb o'ylab qolmasligi, va rollarni
// almashtirib butun tizimni aylanib chiqa olishi.
export default function DemoBanner() {
  const { t } = useTranslation()
  const { isDemo, demoRole, setDemoRole, signOut } = useAuth()
  if (!isDemo) return null

  return (
    <div className="bg-gradient-to-r from-orange to-brown-light text-white px-3 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
      <p className="text-xs sm:text-sm font-extrabold shrink-0">
        🎬 {t('demo.bannerTitle')}
        <span className="hidden md:inline font-semibold opacity-90"> — {t('demo.bannerSubtitle')}</span>
      </p>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span className="text-[11px] font-bold opacity-80 hidden sm:inline">{t('demo.viewAs')}:</span>
        {DEMO_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setDemoRole(role)}
            className={`text-[11px] font-extrabold rounded-full px-2.5 py-1 transition ${
              demoRole === role ? 'bg-white text-brown-dark' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {t(`roles.${role}`)}
          </button>
        ))}
      </div>

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
