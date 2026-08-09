// PIN sessiyasi — xodim PIN kiritgach, bir smena davomida qayta
// so'ralmasligi uchun localStorage'da saqlanadi.
//
// Muddat oxirgi FAOLLIKDAN boshlab hisoblanadi, PIN kiritilgan
// paytdan emas: 8 soatlik qat'iy oyna smena o'rtasida (masalan 12
// soatlik ish kunida) kassirni bloklab qo'yardi. Endi qurilmaga 8
// soat davomida umuman tegilmasa qulflanadi — kechasi do'konda
// qolgan planshet ertalab PIN so'raydi.
//
// Xavfsizlik doirasi: bu UI darajasidagi qulf, autentifikatsiya emas.
// Supabase sessiya tokeni allaqachon shu localStorage'da turadi, ya'ni
// qurilmaga jismoniy kirish imkoni bo'lgan odam baribir hamma narsaga
// ega. PIN begona xodim boshqa birovning ochiq smenasidan
// foydalanmasligi uchun. Shuning uchun bu yerda localStorage yetarli
// va mavjud tahdid modelini yomonlashtirmaydi.

const STORAGE_KEY = 'bakery.pin-unlock'

export const PIN_SESSION_MS = 8 * 60 * 60 * 1000

// Xodim boshqa hisobga o'tsa, eski yozuv o'tmasligi uchun userId
// tekshiriladi.
export function readPinSession(userId) {
  if (!userId) return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (parsed?.userId !== userId) return false
    if (typeof parsed.expiresAt !== 'number') return false
    return parsed.expiresAt > Date.now()
  } catch {
    // Buzuq yozuv yoki localStorage yopiq (private rejim) — PIN so'raladi.
    return false
  }
}

export function writePinSession(userId) {
  if (!userId) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userId, expiresAt: Date.now() + PIN_SESSION_MS })
    )
  } catch {
    // localStorage yozib bo'lmasa, sessiya shunchaki saqlanmaydi —
    // ilova ishlashda davom etadi, faqat yangilashda PIN so'raydi.
  }
}

export function clearPinSession() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // e'tiborsiz qoldiriladi
  }
}
