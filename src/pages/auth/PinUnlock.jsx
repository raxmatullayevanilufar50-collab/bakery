import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { translateError } from '../../lib/errors'
import Numpad from '../../components/Numpad'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function PinUnlock() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, setUnlocked, signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleChange(value) {
    setError('')
    setPin(value)
    if (value.length >= 4) {
      await trySubmit(value)
    }
  }

  async function trySubmit(value) {
    setLoading(true)
    try {
      const { data: ok, error: rpcError } = await supabase.rpc('verify_pin', { p_pin: value })
      if (rpcError) throw rpcError
      if (ok) {
        setUnlocked(true)
        navigate('/', { replace: true })
      } else {
        setError(t('pinUnlock.wrongPin'))
        setPin('')
      }
    } catch (err) {
      setError(translateError(t, err))
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 gap-8 relative"
      style={{ background: 'linear-gradient(160deg, #FFF8F0 0%, #FDE8D5 50%, #F5D5B5 100%)' }}
    >
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-orange-light to-orange flex items-center justify-center text-3xl font-black text-white shadow-[var(--shadow-card)]">
          {(profile?.full_name || '?')[0].toUpperCase()}
        </div>
        <h1 className="text-xl font-extrabold text-brown-dark">
          {t('pinUnlock.greeting', { name: profile?.full_name || t('pinUnlock.greetingFallback') })}
        </h1>
        <p className="text-sm text-ink-muted mt-1">{t('pinUnlock.subtitle')}</p>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-brown/30 ${
              i < pin.length ? 'bg-orange border-orange' : ''
            }`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-bad font-semibold">{error}</p>}

      <Numpad value={pin} onChange={handleChange} maxLength={6} />

      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className="text-sm text-ink-muted underline font-semibold"
      >
        {t('pinUnlock.switchAccount')}
      </button>
    </div>
  )
}
