import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { translateError } from '../../lib/errors'
import AuthCard from '../../components/AuthCard'

export default function OwnerSignup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Email tasdiqlash yoqilgan loyihalarda: foydalanuvchi avval signUp qiladi,
  // emailini tasdiqlaydi, /kirish orqali kiradi — shu sessiya bilan qaytib
  // kelganda email/parol maydonlarini qayta so'ramaymiz.
  const { session } = useAuth()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    companyName: '',
    address: '',
    businessType: '',
  })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!session && form.password.length < 6) {
      setError(t('ownerSignup.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      if (!session) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        })
        if (signUpError) throw signUpError

        if (!signUpData.session) {
          setInfo(t('ownerSignup.confirmEmailInfo'))
          setLoading(false)
          return
        }
      }

      const { error: rpcError } = await supabase.rpc('create_company', {
        p_name: form.companyName,
        p_address: form.address,
        p_business_type: form.businessType,
        p_full_name: form.fullName,
      })
      if (rpcError) throw rpcError

      navigate('/pin-ornatish', { replace: true })
    } catch (err) {
      setError(translateError(t, err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title={t('ownerSignup.title')} subtitle={t('ownerSignup.subtitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="text"
          placeholder={t('ownerSignup.fullName')}
          value={form.fullName}
          onChange={update('fullName')}
          required
        />
        <input
          className="input"
          type="text"
          placeholder={t('ownerSignup.companyName')}
          value={form.companyName}
          onChange={update('companyName')}
          required
        />
        <input
          className="input"
          type="text"
          placeholder={t('ownerSignup.address')}
          value={form.address}
          onChange={update('address')}
        />
        <input
          className="input"
          type="text"
          placeholder={t('ownerSignup.businessType')}
          value={form.businessType}
          onChange={update('businessType')}
        />
        {!session && (
          <>
            <input
              className="input"
              type="email"
              placeholder={t('ownerSignup.email')}
              value={form.email}
              onChange={update('email')}
              required
            />
            <input
              className="input"
              type="password"
              placeholder={t('ownerSignup.password')}
              value={form.password}
              onChange={update('password')}
              required
              minLength={6}
            />
          </>
        )}
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        {info && <p className="text-sm text-good font-semibold">{info}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? t('ownerSignup.submitting') : t('ownerSignup.submit')}
        </button>
      </form>
      <p className="text-sm text-center text-ink-muted mt-4">
        {t('ownerSignup.haveAccount')}{' '}
        <Link to="/kirish" className="text-orange font-bold">
          {t('ownerSignup.login')}
        </Link>
      </p>
    </AuthCard>
  )
}
