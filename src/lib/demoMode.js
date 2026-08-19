// Ochiq demo rejimi (portfolio uchun).
//
// Demo alohida loyiha emas — ayni shu bazadagi alohida kompaniya.
// Izolyatsiya mavjud RLS orqali: demo hisob get_my_company_id() bilan
// cheklangan, boshqa kompaniyaning birorta qatorini ko'ra olmaydi.
//
// Quyidagi parol ochiq turishi — ATAYLAB. Maqsad kodsiz kirish, ya'ni
// uni yashirishning ma'nosi yo'q. Himoya sirga emas, baza darajasidagi
// yozish taqiqiga tayanadi (20260810090000_demo_mode.sql): demo
// kompaniyaga tegishli foydalanuvchi hech qanday jadvalga yoza olmaydi,
// hatto brauzer konsolidan to'g'ridan-to'g'ri so'rov yuborsa ham.
export const DEMO_EMAIL = 'demo@nontizimi.uz'
export const DEMO_PASSWORD = 'NonTizimi-Demo-2026'

// Modul darajasidagi bayroq. AuthContext profil yuklangach o'rnatadi
// (companies.is_demo bo'yicha), supabase klientidagi qo'riqchi esa shuni
// o'qiydi. React state emas — chunki uni React'dan tashqarida, har bir
// so'rov oldidan tekshirish kerak.
let demoActive = false

export function setDemoActive(value) {
  demoActive = Boolean(value)
}

export function isDemoActive() {
  return demoActive
}

// Demo rejimida ruxsat etilgan YAGONA RPC'lar — qolgani bloklanadi.
// Ruxsat ro'yxati (allowlist) tanlandi, taqiq ro'yxati emas: keyinchalik
// yangi RPC qo'shilganda u avtomatik bloklanadi, eslab qolish shart emas.
export const DEMO_ALLOWED_RPCS = new Set(['check_device', 'list_company_employees_for_login'])

// Yozish amali bloklanganda qaytariladigan xato. errors.js buni
// tarjima qiladi.
export const DEMO_BLOCKED_MESSAGE = 'DEMO_READ_ONLY'

export function demoBlockedError() {
  return { data: null, error: { message: DEMO_BLOCKED_MESSAGE, code: 'DEMO' } }
}
