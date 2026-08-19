import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import DemoLoginButton from '../../components/DemoLoginButton'

const FEATURES = [
  { key: 'schedule', icon: '🗓️' },
  { key: 'voice', icon: '🎤' },
  { key: 'inventory', icon: '📦' },
  { key: 'roles', icon: '👥' },
  { key: 'reports', icon: '📊' },
  { key: 'ai', icon: '🔮' },
]

const STEPS = ['step1', 'step2', 'step3']

// Kirmagan foydalanuvchi "/" manzilida ko'radigan to'liq marketing sahifasi
// (App.jsx -> Root). Tizimga kirgan foydalanuvchilarga hech qachon
// ko'rsatilmaydi — ular to'g'ridan-to'g'ri o'z rol dashboard'iga tushadi.
export default function Landing() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 backdrop-blur bg-cream/80 border-b border-brown/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brown-light to-brown flex items-center justify-center text-lg shadow-[var(--shadow-card)] shrink-0">
              🍞
            </div>
            <span className="font-display text-lg font-black text-brown-dark tracking-tight">
              {t('common.brand')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/kirish" className="btn-secondary h-10 px-4 items-center text-sm hidden sm:flex">
              {t('marketing.nav.login')}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pt-16 pb-20" style={{ background: 'var(--gradient-auth-bg)' }}>
        <div aria-hidden className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-orange/10 blur-3xl" />
        <div aria-hidden className="absolute -left-24 bottom-0 w-72 h-72 rounded-full bg-brown/10 blur-3xl" />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-brown-light to-brown flex items-center justify-center text-4xl shadow-[var(--shadow-card-lg)]">
            🍞
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black text-brown-dark tracking-tight leading-tight">
            {t('marketing.hero.title')}
          </h1>
          <p className="text-base sm:text-lg text-ink-muted font-semibold mt-5 max-w-xl mx-auto">
            {t('marketing.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link to="/kirish" className="btn-primary px-8 flex items-center justify-center w-full sm:w-auto">
              {t('marketing.hero.ctaLogin')}
            </Link>
            <Link
              to="/kompaniya-ochish"
              className="btn-secondary px-8 flex items-center justify-center w-full sm:w-auto bg-surface"
            >
              {t('marketing.hero.ctaSignup')}
            </Link>
          </div>
          <div className="mt-6 max-w-xs mx-auto">
            <DemoLoginButton />
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl font-black text-brown-dark">{t('marketing.about.title')}</h2>
          <div className="flex flex-col gap-4 mt-6">
            <p className="text-ink-muted font-semibold leading-relaxed">{t('marketing.about.p1')}</p>
            <p className="text-ink-muted font-semibold leading-relaxed">{t('marketing.about.p2')}</p>
            <p className="text-ink-muted font-semibold leading-relaxed">{t('marketing.about.p3')}</p>
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-20 bg-orange-pale/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-black text-brown-dark">{t('marketing.features.title')}</h2>
            <p className="text-ink-muted font-semibold mt-2">{t('marketing.features.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ key, icon }) => (
              <div key={key} className="card p-6 flex flex-col gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-pale flex items-center justify-center text-2xl">
                  {icon}
                </div>
                <h3 className="font-extrabold text-brown-dark text-lg">{t(`marketing.features.${key}.title`)}</h3>
                <p className="text-sm text-ink-muted font-semibold leading-relaxed">
                  {t(`marketing.features.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl font-black text-brown-dark mb-10">
            {t('marketing.howItWorks.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange to-brown-light text-white flex items-center justify-center text-xl font-black shadow-[0_4px_16px_rgba(232,117,42,0.35)]">
                  {i + 1}
                </div>
                <h3 className="font-extrabold text-brown-dark">{t(`marketing.howItWorks.${step}.title`)}</h3>
                <p className="text-sm text-ink-muted font-semibold leading-relaxed max-w-[220px]">
                  {t(`marketing.howItWorks.${step}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="px-4 py-20 bg-orange-pale/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl font-black text-brown-dark">{t('marketing.aboutUs.title')}</h2>
          <p className="text-ink-muted font-semibold leading-relaxed mt-4">{t('marketing.aboutUs.text')}</p>

          <div className="card p-6 mt-10 inline-flex flex-col gap-3 text-left">
            <h3 className="font-extrabold text-brown-dark text-center mb-1">
              {t('marketing.aboutUs.contactTitle')}
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-muted font-bold w-20 shrink-0">{t('marketing.aboutUs.emailLabel')}:</span>
              <a href="mailto:raxmatullayevanilufar50@gmail.com" className="text-ink font-semibold hover:text-orange transition">
                raxmatullayevanilufar50@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-muted font-bold w-20 shrink-0">{t('marketing.aboutUs.phoneLabel')}:</span>
              <a href="tel:+998946711115" className="text-ink font-semibold hover:text-orange transition">
                +998 94 671 11 15
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-muted font-bold w-20 shrink-0">{t('marketing.aboutUs.telegramLabel')}:</span>
              <a
                href="https://t.me/nraxmatullayeva"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink font-semibold hover:text-orange transition"
              >
                @nraxmatullayeva
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 py-10 border-t border-brown/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brown-light to-brown flex items-center justify-center text-sm shrink-0">
              🍞
            </div>
            <span className="font-display font-black text-brown-dark">{t('common.brand')}</span>
          </div>
          <div className="flex items-center gap-5 text-sm font-bold text-ink-muted">
            <Link to="/kirish" className="hover:text-orange transition">
              {t('marketing.footer.loginLink')}
            </Link>
            <Link to="/kompaniya-ochish" className="hover:text-orange transition">
              {t('marketing.footer.signupLink')}
            </Link>
            <Link to="/xodim-kirish" className="hover:text-orange transition">
              {t('marketing.footer.employeeLink')}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/nraxmatullayeva"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="w-9 h-9 rounded-full bg-orange-pale flex items-center justify-center text-ink-muted hover:text-orange transition text-xs font-extrabold"
            >
              TG
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-ink-muted font-semibold mt-8">{t('marketing.footer.copyright')}</p>
      </footer>
    </div>
  )
}
