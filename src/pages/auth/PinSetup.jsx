import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { translateError } from '../../lib/errors'
import Numpad from '../../components/Numpad'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function PinSetup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setUnlocked, refreshProfile } = useAuth()
  const [stage, setStage] = useState('enter') // enter -> confirm
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const current = stage === 'enter' ? pin : confirmPin
  const setCurrent = stage === 'enter' ? setPin : setConfirmPin

  async function handleChange(value) {
    setError('')
    setCurrent(value)

    if (stage === 'enter' && value.length >= 4 && value.length <= 6) {
      return
    }
  }

  function proceedToConfirm() {
    if (pin.length < 4) {
      setError(t('pinSetup.tooShort'))
      return
    }
    setStage('confirm')
  }

  async function submitPin() {
    if (confirmPin !== pin) {
      setError(t('pinSetup.mismatch'))
      setStage('enter')
      setPin('')
      setConfirmPin('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('set_pin', { p_pin: pin })
      if (rpcError) throw rpcError
      await refreshProfile()
      setUnlocked(true)
      navigate('/', { replace: true })
    } catch (err) {
      setError(translateError(t, err))
      setStage('enter')
      setPin('')
      setConfirmPin('')
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
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-brown-light to-brown flex items-center justify-center text-3xl shadow-[var(--shadow-card)]">
          🔢
        </div>
        <h1 className="text-xl font-extrabold text-brown-dark">
          {stage === 'enter' ? t('pinSetup.titleEnter') : t('pinSetup.titleConfirm')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">{t('pinSetup.subtitle')}</p>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: Math.max(current.length, 4) }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-brown/30 ${
              i < current.length ? 'bg-orange border-orange' : ''
            }`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-bad font-semibold">{error}</p>}

      <Numpad value={current} onChange={handleChange} maxLength={6} />

      <button
        type="button"
        disabled={current.length < 4 || loading}
        onClick={stage === 'enter' ? proceedToConfirm : submitPin}
        className="btn-primary w-full max-w-xs"
      >
        {loading ? t('common.saving') : stage === 'enter' ? t('pinSetup.continue') : t('pinSetup.confirm')}
      </button>
    </div>
  )
}
