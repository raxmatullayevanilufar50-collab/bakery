import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

export default function AuthCard({ title, subtitle, children }) {
  const { t } = useTranslation()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative"
      style={{ background: 'var(--gradient-auth-bg)' }}
    >
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-br from-brown-light to-brown flex items-center justify-center text-4xl shadow-[var(--shadow-card-lg)]">
            🍞
          </div>
          <p className="font-display text-2xl font-black text-brown-dark tracking-tight">{t('common.brand')}</p>
        </div>
        <div className="card p-8">
          <h1 className="text-xl font-extrabold text-brown-dark">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted mt-1 mb-6">{subtitle}</p>}
          <div className={subtitle ? '' : 'mt-5'}>{children}</div>
        </div>
      </div>
    </div>
  )
}
