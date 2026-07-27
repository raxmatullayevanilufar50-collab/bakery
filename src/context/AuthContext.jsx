import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceKey, getDeviceLabel } from '../lib/device'
import { setLanguage } from '../lib/i18n'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // profile === null bilan "hali tekshirilmagan" holatini ajratish uchun.
  const [profileChecked, setProfileChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  // PIN bilan ochilgan-ochilmaganligi — xotirada saqlanadi, sahifa
  // yangilanganda yoki qurilma almashtirilganda qayta so'raladi.
  const [unlocked, setUnlocked] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
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
      setProfileChecked(true)
      return null
    }
    setProfile(data)
    setProfileChecked(true)
    // Xodim avval tanlagan tili shu qurilmada ham avtomatik yuklansin.
    if (data?.preferred_language) {
      setLanguage(data.preferred_language)
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
        await loadProfile(data.session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUnlocked(false)
      if (newSession) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Sessiya paydo bo'lganda joriy qurilmani ro'yxatga oladi va
  // bloklanmaganini tekshiradi (4-bo'lim, 5 va 6-talab).
  useEffect(() => {
    if (!session) return
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
  }, [session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUnlocked(false)
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

  const value = {
    session,
    profile,
    profileChecked,
    loading,
    unlocked,
    setUnlocked,
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
