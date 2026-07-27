import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import AuthCard from '../../components/AuthCard'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    // Email mavjud yoki yo'qligidan qat'i nazar bir xil xabar ko'rsatiladi
    // (foydalanuvchi mavjudligini oshkor qilmaslik uchun).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/yangi-parol`,
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <AuthCard title={t('forgotPassword.title')} subtitle={t('forgotPassword.subtitle')}>
      {sent ? (
        <p className="text-sm text-good font-semibold text-center">{t('forgotPassword.sent')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="input"
            type="email"
            placeholder={t('ownerLogin.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? t('common.saving') : t('forgotPassword.submit')}
          </button>
        </form>
      )}
      <p className="text-sm text-center text-ink-muted mt-4">
        <Link to="/kirish" className="text-orange font-bold">
          {t('common.back')}
        </Link>
      </p>
    </AuthCard>
  )
}
