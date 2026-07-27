import { useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './context/AuthContext'
import LanguageSwitcher from './components/LanguageSwitcher'
import Landing from './pages/auth/Landing'
import OwnerSignup from './pages/auth/OwnerSignup'
import OwnerLogin from './pages/auth/OwnerLogin'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import EmployeeJoin from './pages/auth/EmployeeJoin'
import PinSetup from './pages/auth/PinSetup'
import PinUnlock from './pages/auth/PinUnlock'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import BakerDashboard from './pages/baker/BakerDashboard'
import DriverDashboard from './pages/driver/DriverDashboard'
import CashierDashboard from './pages/cashier/CashierDashboard'

const ROLE_DASHBOARDS = {
  owner: OwnerDashboard,
  manager: ManagerDashboard,
  baker: BakerDashboard,
  driver: DriverDashboard,
  cashier: CashierDashboard,
}

function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <p className="text-ink-muted font-semibold">{t('common.loading')}</p>
    </div>
  )
}

function Root() {
  const { t } = useTranslation()
  const { session, profile, profileChecked, loading, unlocked } = useAuth()

  if (loading) return <LoadingScreen />
  if (!session) return <Landing />
  if (!profileChecked) return <LoadingScreen />

  if (!profile) {
    return <ChooseSetupPath />
  }
  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <p className="text-ink-muted font-semibold text-center">{t('inactiveAccount.message')}</p>
      </div>
    )
  }
  if (!profile.pin_hash) return <Navigate to="/pin-ornatish" replace />
  if (!unlocked) return <PinUnlock />

  const Dashboard = ROLE_DASHBOARDS[profile.role]
  if (!Dashboard) return <LoadingScreen />
  return <Dashboard />
}

// Sessiya bor, lekin hali profil yo'q — masalan, email tasdiqlash
// yoqilgan loyihada foydalanuvchi signUp qildi-yu, kompaniya yaratish
// bosqichigacha yetmagan. Ikkala davom etish yo'lini taklif qilamiz.
function ChooseSetupPath() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'linear-gradient(160deg, #FFF8F0 0%, #FDE8D5 50%, #F5D5B5 100%)' }}
    >
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-extrabold text-brown-dark mb-1">{t('chooseSetupPath.title')}</h1>
        <p className="text-sm text-ink-muted font-semibold mb-6">{t('chooseSetupPath.subtitle')}</p>
        <div className="flex flex-col gap-3">
          <Link to="/kompaniya-ochish" className="btn-primary flex items-center justify-center">
            {t('chooseSetupPath.iAmOwner')}
          </Link>
          <Link to="/xodim-kirish" className="btn-secondary flex items-center justify-center">
            {t('chooseSetupPath.iAmEmployee')}
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await signOut()
            }}
            className="text-sm text-ink-muted underline mt-2 font-semibold"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequireSession({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/kompaniya-ochish" element={<OwnerSignup />} />
      <Route path="/kirish" element={<OwnerLogin />} />
      <Route path="/parolni-tiklash" element={<ForgotPassword />} />
      <Route path="/yangi-parol" element={<ResetPassword />} />
      <Route path="/xodim-kirish" element={<EmployeeJoin />} />
      <Route
        path="/pin-ornatish"
        element={
          <RequireSession>
            <PinSetup />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
