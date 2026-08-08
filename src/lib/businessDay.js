// Kun chegarasi Toshkent vaqti bo'yicha belgilanadi — serverdagi
// close_day() RPC ham aynan shu mintaqadan foydalanadi (20260808110000).
// Qurilma soati boshqa mintaqaga qo'yilgan bo'lsa ham ikkalasi bir xil
// kunni ko'rsatadi.
const BUSINESS_TIMEZONE = 'Asia/Tashkent'

// 'en-CA' formati YYYY-MM-DD beradi — Postgres `date` turiga to'g'ridan-
// to'g'ri mos keladi.
export function todayInTashkent() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
