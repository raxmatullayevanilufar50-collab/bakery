import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { callPinAuth } from '../../lib/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import { translateError } from '../../lib/errors'
import AuthCard from '../../components/AuthCard'
import Numpad from '../../components/Numpad'

const STEPS = {
  CODE: 'code',
  CHOOSE: 'choose',
  SETUP_CODE: 'setupCode',
  SETUP_PIN: 'setupPin',
  LOGIN_PIN: 'loginPin',
}

export default function EmployeeJoin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setUnlocked, refreshProfile } = useAuth()

  const [step, setStep] = useState(STEPS.CODE)
  const [companyCode, setCompanyCode] = useState('')
  const [employees, setEmployees] = useState([])
  const [selected, setSelected] = useState(null)
  const [setupCode, setSetupCode] = useState('')

  const [pinStage, setPinStage] = useState('enter') // setup: enter -> confirm
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submitCompanyCode(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const code = companyCode.trim().toUpperCase()
    const { data, error: rpcError } = await supabase.rpc('list_company_employees_for_login', {
      p_company_code: code,
    })
    setLoading(false)
    if (rpcError) {
      setError(translateError(t, rpcError))
      return
    }
    setCompanyCode(code)
    setEmployees(data || [])
    setStep(STEPS.CHOOSE)
  }

  function chooseEmployee(emp) {
    setSelected(emp)
    setPin('')
    setError('')
    setStep(STEPS.LOGIN_PIN)
  }

  function goToSetup() {
    setError('')
    setStep(STEPS.SETUP_CODE)
  }

  function submitSetupCode(e) {
    e.preventDefault()
    if (!setupCode.trim()) return
    setError('')
    setPinStage('enter')
    setPin('')
    setConfirmPin('')
    setStep(STEPS.SETUP_PIN)
  }

  async function finishSetup() {
    setError('')
    setLoading(true)
    try {
      const { session } = await callPinAuth({
        action: 'setup',
        companyCode,
        inviteCode: setupCode.trim().toUpperCase(),
        pin,
      })
      await applySession(session)
    } catch (err) {
      setError(err.message)
      setPinStage('enter')
      setPin('')
      setConfirmPin('')
    } finally {
      setLoading(false)
    }
  }

  function proceedSetupToConfirm() {
    if (pin.length < 4) {
      setError(t('pinSetup.tooShort'))
      return
    }
    setError('')
    setPinStage('confirm')
  }

  async function handleSetupPinChange(value) {
    setError('')
    if (pinStage === 'enter') {
      setPin(value)
    } else {
      setConfirmPin(value)
    }
  }

  async function submitSetupConfirm() {
    if (confirmPin !== pin) {
      setError(t('pinSetup.mismatch'))
      setPinStage('enter')
      setPin('')
      setConfirmPin('')
      return
    }
    await finishSetup()
  }

  async function handleLoginPinChange(value) {
    setError('')
    setPin(value)
    if (value.length >= 4) {
      setLoading(true)
      try {
        const { session } = await callPinAuth({
          action: 'login',
          companyCode,
          profileId: selected.id,
          pin: value,
        })
        await applySession(session)
      } catch (err) {
        setError(err.message)
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  async function applySession(session) {
    await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
    await refreshProfile()
    setUnlocked(true)
    navigate('/', { replace: true })
  }

  const setupCurrent = pinStage === 'enter' ? pin : confirmPin

  return (
    <AuthCard
      title={t('employeeJoin.title')}
      subtitle={
        step === STEPS.CODE
          ? t('employeeJoin.subtitleCode')
          : step === STEPS.CHOOSE
            ? t('employeeJoin.subtitleChoose')
            : step === STEPS.SETUP_CODE
              ? t('employeeJoin.subtitleSetupCode')
              : step === STEPS.SETUP_PIN
                ? pinStage === 'enter'
                  ? t('pinSetup.titleEnter')
                  : t('pinSetup.titleConfirm')
                : t('pinUnlock.subtitle')
      }
    >
      {step === STEPS.CODE && (
        <form onSubmit={submitCompanyCode} className="flex flex-col gap-3">
          <input
            className="input text-center tracking-widest uppercase"
            placeholder={t('employeeJoin.codePlaceholder')}
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            required
          />
          {error && <p className="text-sm text-bad font-semibold">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? t('common.loading') : t('pinSetup.continue')}
          </button>
        </form>
      )}

      {step === STEPS.CHOOSE && (
        <div className="flex flex-col gap-3">
          {employees.length === 0 && (
            <p className="text-sm text-ink-muted text-center">{t('employeeJoin.noEmployees')}</p>
          )}
          {employees.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => chooseEmployee(emp)}
              className="btn-secondary flex items-center justify-center"
            >
              {emp.full_name}
            </button>
          ))}
          <button type="button" onClick={goToSetup} className="btn-primary mt-2">
            {t('employeeJoin.newEmployee')}
          </button>
          <button
            type="button"
            onClick={() => setStep(STEPS.CODE)}
            className="text-sm text-ink-muted underline font-semibold mt-1"
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {step === STEPS.SETUP_CODE && (
        <form onSubmit={submitSetupCode} className="flex flex-col gap-3">
          <input
            className="input text-center tracking-widest uppercase"
            placeholder={t('employeeJoin.setupCodePlaceholder')}
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            required
          />
          {error && <p className="text-sm text-bad font-semibold">{error}</p>}
          <button type="submit" className="btn-primary mt-2">
            {t('pinSetup.continue')}
          </button>
          <button
            type="button"
            onClick={() => setStep(STEPS.CHOOSE)}
            className="text-sm text-ink-muted underline font-semibold"
          >
            {t('common.back')}
          </button>
        </form>
      )}

      {step === STEPS.SETUP_PIN && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
            {Array.from({ length: Math.max(setupCurrent.length, 4) }).map((_, i) => (
              <span
                key={i}
                className={`w-4 h-4 rounded-full border-2 border-brown/30 ${
                  i < setupCurrent.length ? 'bg-orange border-orange' : ''
                }`}
              />
            ))}
          </div>
          {error && <p className="text-sm text-bad font-semibold">{error}</p>}
          <Numpad value={setupCurrent} onChange={handleSetupPinChange} maxLength={6} />
          <button
            type="button"
            disabled={setupCurrent.length < 4 || loading}
            onClick={pinStage === 'enter' ? proceedSetupToConfirm : submitSetupConfirm}
            className="btn-primary w-full"
          >
            {loading ? t('common.saving') : pinStage === 'enter' ? t('pinSetup.continue') : t('pinSetup.confirm')}
          </button>
        </div>
      )}

      {step === STEPS.LOGIN_PIN && (
        <div className="flex flex-col items-center gap-4">
          <p className="font-semibold text-brown-dark">{selected?.full_name}</p>
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
          <Numpad value={pin} onChange={handleLoginPinChange} maxLength={6} />
          <button
            type="button"
            onClick={() => setStep(STEPS.CHOOSE)}
            className="text-sm text-ink-muted underline font-semibold"
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {step === STEPS.CODE && (
        <p className="text-sm text-center text-ink-muted mt-4">
          <Link to="/" className="text-orange font-bold">
            {t('common.back')}
          </Link>
        </p>
      )}
    </AuthCard>
  )
}
