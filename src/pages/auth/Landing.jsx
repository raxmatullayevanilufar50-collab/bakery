import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function Landing() {
  const { t } = useTranslation()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'linear-gradient(160deg, #FFF8F0 0%, #FDE8D5 50%, #F5D5B5 100%)' }}
    >
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm text-center">
        <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-brown-light to-brown flex items-center justify-center text-5xl shadow-[var(--shadow-card-lg)]">
          🍞
        </div>
        <p className="font-display text-3xl font-black text-brown-dark tracking-tight">{t('common.brand')}</p>
        <p className="text-sm text-ink-muted font-semibold mt-1 mb-8">{t('landing.subtitle')}</p>

        <div className="card p-6 flex flex-col gap-3">
          <p className="text-lg font-extrabold text-brown-dark mb-1">{t('landing.welcome')}</p>
          <Link to="/kompaniya-ochish" className="btn-primary flex items-center justify-center">
            {t('landing.createCompany')}
          </Link>
          <Link to="/kirish" className="btn-secondary flex items-center justify-center">
            {t('landing.ownerLogin')}
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-muted font-bold my-1">
            <span className="flex-1 h-px bg-brown/15" />
            {t('common.or')}
            <span className="flex-1 h-px bg-brown/15" />
          </div>
          <Link to="/xodim-kirish" className="btn-secondary flex items-center justify-center">
            {t('landing.employeeLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
