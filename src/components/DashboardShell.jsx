import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'
import { localeTag } from '../lib/i18n'

const ROLE_ICONS = {
  owner: '👑',
  manager: '📋',
  baker: '👷',
  driver: '🚚',
  cashier: '💰',
}

// navGroups: [{ title: 'Bo'lim nomi', items: [{ key, label, icon }] }]
export default function DashboardShell({ navGroups, active, onNavigate, title, children }) {
  const { t, i18n } = useTranslation()
  const { profile, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const today = new Date().toLocaleDateString(localeTag(i18n.language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  function handleNavClick(key) {
    onNavigate?.(key)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[99] md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-[260px] bg-gradient-to-b from-[#5c2d0a] to-[#3D1F0A] flex flex-col z-[100]
          transition-transform duration-300 md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange flex items-center justify-center text-xl shrink-0">🍞</div>
          <div>
            <p className="text-white font-extrabold text-base leading-tight">{t('common.brand')}</p>
            <p className="text-white/50 text-[11px]">{t('common.brandTagline')}</p>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-light to-orange flex items-center justify-center font-extrabold text-white text-sm shrink-0">
            {(profile?.full_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">{profile?.full_name}</p>
            <p className="text-white/50 text-[11px]">
              {ROLE_ICONS[profile?.role]} {t(`roles.${profile?.role}`, profile?.role)}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="text-white/35 text-[10px] font-extrabold uppercase tracking-wider px-2.5 pt-3 pb-1.5">
                {group.title}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavClick(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold mb-0.5 transition text-left
                    ${
                      active === item.key
                        ? 'bg-orange text-white shadow-[0_4px_12px_rgba(232,117,42,0.4)]'
                        : 'text-white/65 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <span className="text-lg w-5 text-center shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="bg-bad text-white text-[11px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2.5 text-white/50 text-sm font-semibold hover:text-red-400 transition"
          >
            🚪 {t('common.logout')}
          </button>
          <LanguageSwitcher variant="dark" />
        </div>
      </aside>

      <div className="flex-1 md:ml-[260px] min-h-screen flex flex-col">
        <div className="md:hidden flex items-center justify-between bg-surface px-4 h-14 border-b border-brown/10 sticky top-0 z-50 gap-2">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-xl text-brown-dark shrink-0">
            ☰
          </button>
          <p className="font-extrabold text-brown-dark text-sm truncate">
            {t('common.brand')} 🍞
          </p>
          <LanguageSwitcher />
        </div>

        <div className="hidden md:flex items-center justify-between bg-surface px-7 h-16 border-b border-brown/10 sticky top-0 z-50">
          <p className="text-lg font-extrabold text-brown-dark">{title}</p>
          <div className="flex items-center gap-4">
            <p className="text-sm text-ink-muted font-semibold capitalize">{today}</p>
            <LanguageSwitcher />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-7">
          <p className="md:hidden text-lg font-extrabold text-brown-dark mb-4">{title}</p>
          {children}
        </main>
      </div>
    </div>
  )
}
