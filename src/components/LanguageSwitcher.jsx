import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'

const LABELS = { uz: "O'z", ru: 'Ру', en: 'En' }

// Ekranning yuqori qismida doim ko'rinib turishi kerak (auth ekranlarida
// AuthCard/Landing ichida, tizimga kirgandan keyin DashboardShell'da).
export default function LanguageSwitcher({ variant = 'light' }) {
  const { i18n } = useTranslation()
  const { changeLanguage } = useAuth()

  const isDark = variant === 'dark'

  return (
    <div
      className={`inline-flex rounded-full p-1 gap-0.5 ${isDark ? 'bg-white/10' : 'bg-orange-pale'}`}
      role="group"
      aria-label="Til / Язык / Language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => changeLanguage(lang)}
          className={`px-2.5 py-1 rounded-full text-xs font-extrabold transition
            ${
              i18n.language === lang
                ? 'bg-orange text-white'
                : isDark
                  ? 'text-white/60 hover:text-white'
                  : 'text-brown hover:text-brown-dark'
            }`}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  )
}
