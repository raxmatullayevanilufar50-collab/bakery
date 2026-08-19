import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { translateError } from '../lib/errors'

// "Demo sifatida ko'rish" — kodsiz kirish tugmasi. Landing va Kirish
// sahifalarida ishlatiladi.
export default function DemoLoginButton({ className = '' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signInDemo } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function enter() {
    setError('')
    setLoading(true)
    const signInError = await signInDemo()
    setLoading(false)
    if (signInError) {
      setError(translateError(t, signInError))
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className={`flex flex-col items-center gap-2 w-full ${className}`}>
      <button
        type="button"
        onClick={enter}
        disabled={loading}
        className="btn-secondary w-full flex items-center justify-center gap-2 border-2 border-orange/40 bg-orange-pale/60"
      >
        🎬 {loading ? t('demo.entering') : t('demo.cta')}
      </button>
      <p className="text-xs text-ink-muted font-semibold text-center">{t('demo.ctaHint')}</p>
      {error && <p className="text-sm text-bad font-semibold text-center">{error}</p>}
    </div>
  )
}
