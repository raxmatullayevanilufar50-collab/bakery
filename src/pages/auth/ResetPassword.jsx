import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AuthCard from '../../components/AuthCard'

// Bu sahifaga email'dagi tiklash havolasi orqali kelinadi. Supabase-js
// URL'dagi tiklash tokenini avtomatik aniqlab, vaqtinchalik sessiya
// o'rnatadi (detectSessionInUrl standart yoqilgan) — shuning uchun bu
// yerda alohida token qayta ishlash shart emas, faqat useAuth()'dagi
// session mavjudligini tekshiramiz.
export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('ownerSignup.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.mismatch'))
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <AuthCard title={t('resetPassword.title')}>
        <p className="text-sm text-ink-muted text-center">{t('common.loading')}</p>
      </AuthCard>
    )
  }

  if (!session) {
    return (
      <AuthCard title={t('resetPassword.title')}>
        <p className="text-sm text-bad font-semibold text-center">{t('resetPassword.invalidLink')}</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('resetPassword.title')} subtitle={t('resetPassword.subtitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="password"
          placeholder={t('resetPassword.newPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          className="input"
          type="password"
          placeholder={t('resetPassword.confirmPassword')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary mt-2">
          {saving ? t('common.saving') : t('resetPassword.submit')}
        </button>
      </form>
    </AuthCard>
  )
}
