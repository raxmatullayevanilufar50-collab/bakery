import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import AuthCard from '../../components/AuthCard'
import DemoLoginButton from '../../components/DemoLoginButton'

export default function OwnerLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      navigate('/', { replace: true })
    } catch {
      setError(t('ownerLogin.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title={t('ownerLogin.title')} subtitle={t('ownerLogin.subtitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="email"
          placeholder={t('ownerLogin.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder={t('ownerLogin.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? t('ownerLogin.submitting') : t('ownerLogin.submit')}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <span className="h-px flex-1 bg-brown/15" />
        <span className="text-xs font-bold text-ink-muted">{t('common.or')}</span>
        <span className="h-px flex-1 bg-brown/15" />
      </div>
      <DemoLoginButton />

      <p className="text-sm text-center mt-4">
        <Link to="/parolni-tiklash" className="text-orange font-bold">
          {t('ownerLogin.forgotPassword')}
        </Link>
      </p>
      <p className="text-sm text-center text-ink-muted mt-4">
        {t('ownerLogin.noAccount')}{' '}
        <Link to="/kompaniya-ochish" className="text-orange font-bold">
          {t('ownerLogin.createCompany')}
        </Link>
      </p>
    </AuthCard>
  )
}
