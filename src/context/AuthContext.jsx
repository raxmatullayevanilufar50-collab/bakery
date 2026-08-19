import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceKey, getDeviceLabel } from '../lib/device'
import { setLanguage } from '../lib/i18n'
import { readPinSession, writePinSession, clearPinSession } from '../lib/pinSession'
import { setDemoActive, DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demoMode'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // Kompaniya nomi/manzili — chek sarlavhasi va kunlik hisobot uchun kerak.
  const [company, setCompany] = useState(null)
  // profile === null bilan "hali tekshirilmagan" holatini ajratish uchun.
  const [profileChecked, setProfileChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  // PIN bilan ochilgan-ochilmaganligi. localStorage'da saqlanadi
  // (src/lib/pinSession.js) — sahifa yangilanganda yoki ilova qayta
  // ochilganda PIN qayta so'ralmaydi, faqat 8 soat faoliyatsizlikdan
  // keyin yoki xodim o'zi chiqqanda.
  const [unlocked, setUnlockedState] = useState(false)
  // setUnlocked ichida joriy foydalanuvchini o'qish uchun — session
  // state'iga bog'lansa, PinUnlock eski closure'ni ushlab qolishi mumkin.
  const userIdRef = useRef(null)
  // Demo rejimida mehmon rollarni almashtirib ko'ra oladi. Faqat React
  // state — bazadagi rol o'zgarmaydi (o'zgartirib ham bo'lmaydi). RLS
  // baribir haqiqiy rol bo'yicha ishlaydi, ya'ni bu almashtirish qaysi
  // panel chizilishini tanlaydi, ruxsatlarni kengaytirmaydi.
  const [demoRole, setDemoRole] = useState(null)

  const setUnlocked = useCallback((value) => {
    setUnlockedState(value)
    if (value) writePinSession(userIdRef.current)
    else clearPinSession()
  }, [])

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setCompany(null)
      setProfileChecked(true)
      return null
    }
    setProfileChecked(false)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, company_id, full_name, role, phone, is_active, pin_hash, preferred_language')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error(error)
      setProfile(null)
      setCompany(null)
      setProfileChecked(true)
      return null
    }
    setProfile(data)
    setProfileChecked(true)
    // Xodim avval tanlagan tili shu qurilmada ham avtomatik yuklansin.
    if (data?.preferred_language) {
      setLanguage(data.preferred_language)
    }
    if (data?.company_id) {
      const { data: companyRow } = await supabase
        .from('companies')
        .select('id, name, address, is_demo')
        .eq('id', data.company_id)
        .maybeSingle()
      setCompany(companyRow || null)
      // Demo bayrog'ini React'dan tashqarida ham o'qish mumkin bo'lishi
      // kerak — supabase klientidagi yozish qo'riqchisi har bir so'rov
      // oldidan shuni tekshiradi.
      setDemoActive(companyRow?.is_demo)
    } else {
      setCompany(null)
      setDemoActive(false)
    }
    return data
  }, [])

  useEffect(() => {
    let active = true

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session)
      if (data.session) {
        // Saqlangan PIN sessiyasi hali kuchdami — sahifa yangilanganda
        // shu yerda tiklanadi, aks holda PinUnlock ekrani chiqadi.
        userIdRef.current = data.session.user.id
        setUnlockedState(readPinSession(data.session.user.id))
        await loadProfile(data.session.user.id)
      }
      setLoading(false)
    }
    init()

    // Bu hodisa faqat kirish/chiqishda emas, token yangilanganda ham
    // ishlaydi (Supabase taxminan har soatda TOKEN_REFRESHED yuboradi).
    // Shuning uchun bu yerda qulfni so'zsiz yopib bo'lmaydi — aks holda
    // kassir har soatda PIN kiritishga majbur bo'lardi. Buning o'rniga
    // saqlangan sessiya qayta o'qiladi.
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        userIdRef.current = newSession.user.id
        setUnlockedState(readPinSession(newSession.user.id))
        await loadProfile(newSession.user.id)
      } else {
        userIdRef.current = null
        setUnlockedState(false)
        clearPinSession()
        setProfile(null)
        setCompany(null)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Sessiya paydo bo'lganda joriy qurilmani ro'yxatga oladi va
  // bloklanmaganini tekshiradi (4-bo'lim, 5 va 6-talab).
  // Demo rejimida qurilma ro'yxatga olinmaydi: portfolio havolasini
  // ochgan har bir mehmon uchun `devices` jadvaliga qator qo'shilishi
  // ma'nosiz (va u cheksiz o'sardi). check_device qurilma topilmasa
  // `true` qaytaradi, ya'ni bu o'tkazib yuborish hech narsani buzmaydi.
  useEffect(() => {
    if (!session || company?.is_demo) return
    let cancelled = false

    async function checkThisDevice() {
      const deviceKey = getDeviceKey()
      await supabase.rpc('register_device', {
        p_device_key: deviceKey,
        p_device_label: getDeviceLabel(),
      })
      const { data: ok } = await supabase.rpc('check_device', { p_device_key: deviceKey })
      if (!cancelled && ok === false) {
        await supabase.auth.signOut()
      }
    }
    checkThisDevice()

    return () => {
      cancelled = true
    }
  }, [session, company?.is_demo])

  // PIN sessiyasini xodim ishlayotgan vaqtda uzaytirib boradi va muddati
  // tugaganda qulflaydi. Muddat aynan FAOLLIKDAN hisoblanishi uchun
  // uzaytirish faqat haqiqiy harakat (bosish/yozish) bo'lganda bajariladi —
  // ochiq qolgan, lekin tegilmayotgan planshet 8 soatdan keyin qulflanadi.
  useEffect(() => {
    if (!unlocked || !session) return
    const userId = session.user.id
    let activeSinceLastTouch = false

    const markActive = () => {
      activeSinceLastTouch = true
    }

    const check = () => {
      if (!readPinSession(userId)) {
        setUnlockedState(false)
        return
      }
      if (activeSinceLastTouch) {
        writePinSession(userId)
        activeSinceLastTouch = false
      }
    }

    // Ilova fonga o'tib qaytganda muddat darhol tekshirilsin — kassir
    // telefonni cho'ntagiga solib, ertasi kuni ochishi mumkin.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }

    document.addEventListener('pointerdown', markActive)
    document.addEventListener('keydown', markActive)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(check, 60 * 1000)

    return () => {
      document.removeEventListener('pointerdown', markActive)
      document.removeEventListener('keydown', markActive)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [unlocked, session])

  const signOut = useCallback(async () => {
    clearPinSession()
    setDemoActive(false)
    await supabase.auth.signOut()
    setUnlockedState(false)
  }, [])

  // Kodsiz demo kirish. Oddiy parol bilan kirish — Supabase sessiyasi
  // haqiqiy, chunki barcha so'rovlar RLS orqali auth.uid() ga bog'langan.
  // Demo hisobning cheklovi parolda emas, bazadagi yozish taqiqida.
  const signInDemo = useCallback(async () => {
    clearPinSession()
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })
    return error
  }, [])

  const refreshProfile = useCallback(() => {
    if (session) return loadProfile(session.user.id)
    return Promise.resolve(null)
  }, [session, loadProfile])

  // Tilni o'zgartiradi va, agar foydalanuvchi tizimga kirgan bo'lsa,
  // keyingi safar avtomatik yuklanishi uchun profilida saqlaydi.
  const changeLanguage = useCallback(
    async (lang) => {
      setLanguage(lang)
      if (session) {
        await supabase.from('profiles').update({ preferred_language: lang }).eq('id', session.user.id)
        setProfile((p) => (p ? { ...p, preferred_language: lang } : p))
      }
    },
    [session]
  )

  const isDemo = Boolean(company?.is_demo)

  const effectiveProfile = useMemo(
    () => (profile && isDemo && demoRole ? { ...profile, role: demoRole } : profile),
    [profile, isDemo, demoRole]
  )

  const value = {
    session,
    profile: effectiveProfile,
    company,
    profileChecked,
    loading,
    unlocked,
    setUnlocked,
    isDemo,
    demoRole: demoRole || profile?.role || null,
    setDemoRole,
    signInDemo,
    signOut,
    refreshProfile,
    changeLanguage,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak')
  return ctx
}
