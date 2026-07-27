import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'

// supabase-js'ning functions.invoke() xato tanasini (body) ishonchli
// ochib bermasligi mumkin bo'lgani uchun, to'g'ridan-to'g'ri fetch bilan
// chaqiramiz — shunda xato xabarini har doim aniq o'qiy olamiz.
async function callFunction(name, body, accessToken) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `${name} xatolik qaytardi`)
  }
  return data
}

// PIN orqali sessiya o'rnatish (setup yoki login) — sessiyasiz chaqiriladi.
export function callPinAuth(body) {
  return callFunction('pin-auth', body, null)
}

// Xodim yaratish — Owner/Manager'ning o'z sessiyasi (access_token) bilan.
export async function callCreateEmployee(body) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Avtorizatsiyadan o'tilmagan")
  return callFunction('create-employee', body, session.access_token)
}
