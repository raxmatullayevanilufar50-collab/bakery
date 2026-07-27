// Supabase Auth "Send SMS Hook" — signInWithOtp() chaqirilganda Supabase
// OTP kodini o'zi generatsiya qiladi va shu funksiyani chaqirib, "buni
// jo'nat" deydi. Bu funksiyaning yagona vazifasi — Eskiz.uz orqali SMS
// jo'natish. OTP generatsiya/tekshirish/sessiya mantig'ining hammasi
// Supabase Auth tomonida qoladi — frontendda (EmployeeJoin.jsx) hech
// narsa o'zgarmaydi.
//
// MUHIM: bu endpoint hech qanday foydalanuvchi JWT bilan himoyalanmaydi
// (Supabase o'zi chaqiradi), shuning uchun so'rov haqiqatan Supabase'dan
// kelganini Standard Webhooks imzosi orqali tekshirish shart — aks holda
// istalgan kishi shu URL'ni topib, Eskiz balansingiz hisobidan SMS
// jo'natishi mumkin.

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api'
const ESKIZ_EMAIL = Deno.env.get('ESKIZ_EMAIL')
const ESKIZ_PASSWORD = Deno.env.get('ESKIZ_PASSWORD')
// Authentication -> Hooks -> Send SMS Hook yoqilganda Supabase beradigan
// imzo siri (odatda "v1,whsec_..." ko'rinishida).
const HOOK_SECRET = Deno.env.get('SEND_SMS_HOOK_SECRET')

// Eskiz token'ini har chaqiriqda qayta olmaslik uchun issiq (warm) Edge
// Function nusxasi doirasida xotirada saqlaymiz.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getEskizToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }
  if (!ESKIZ_EMAIL || !ESKIZ_PASSWORD) {
    throw new Error('ESKIZ_EMAIL yoki ESKIZ_PASSWORD sozlanmagan (Edge Function secrets)')
  }

  const body = new URLSearchParams({ email: ESKIZ_EMAIL, password: ESKIZ_PASSWORD })
  const res = await fetch(`${ESKIZ_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Eskiz login xatosi: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  const token = data?.data?.token
  if (!token) {
    throw new Error('Eskiz login javobida token topilmadi')
  }
  // Eskiz tokeni ~30 kun amal qiladi; ehtiyot uchun 25 kun deb hisoblaymiz.
  cachedToken = { value: token, expiresAt: Date.now() + 25 * 24 * 60 * 60 * 1000 }
  return token
}

async function sendEskizSms(phone: string, message: string) {
  const token = await getEskizToken()
  // Eskiz raqamni "998..." (mamlakat kodi bilan, "+" belgisiz) formatida kutadi.
  const digits = phone.replace(/[^\d]/g, '')
  const normalizedPhone = digits.startsWith('998') ? digits : `998${digits}`

  const body = new URLSearchParams({
    mobile_phone: normalizedPhone,
    message,
    from: '4546',
  })

  const res = await fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${token}`,
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`Eskiz SMS yuborish xatosi: ${res.status} ${await res.text()}`)
  }
}

// Supabase'ning hook secret'i "v1,whsec_XXXX" yoki oddiy "whsec_XXXX"
// ko'rinishida bo'lishi mumkin — ikkalasini ham qabul qilamiz.
function extractSecretBytes(secret: string): Uint8Array {
  let s = secret.trim()
  if (s.includes(',')) s = s.split(',').pop() as string
  if (s.startsWith('whsec_')) s = s.slice('whsec_'.length)
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

// Vaqt asosidagi hujumlarning oldini olish uchun doimiy vaqtli taqqoslash.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Standard Webhooks imzosini tekshiradi (Supabase shu formatda imzolaydi).
async function verifySignature(rawBody: string, headers: Headers): Promise<boolean> {
  if (!HOOK_SECRET) return false

  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signatureHeader = headers.get('webhook-signature')
  if (!id || !timestamp || !signatureHeader) return false

  // Qayta hujum (replay) himoyasi — 5 daqiqadan eski so'rovlarni rad etamiz.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (age > 300) return false

  const secretBytes = extractSecretBytes(HOOK_SECRET)

  const signedContent = `${id}.${timestamp}.${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  return signatureHeader
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean)
    .some((sig) => constantTimeEqual(sig, expected))
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text()

    const validSignature = await verifySignature(rawBody, req.headers)
    if (!validSignature) {
      return new Response(JSON.stringify({ error: { http_code: 401, message: 'Noto\'g\'ri imzo' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.parse(rawBody)
    const phone: string | undefined = payload?.user?.phone
    const otp: string | undefined = payload?.sms?.otp

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: 'Telefon yoki OTP topilmadi' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const message = `Bakery: tasdiqlash kodingiz ${otp}. Hech kimga bermang.`
    await sendEskizSms(phone, message)

    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: err instanceof Error ? err.message : 'Nomaʼlum xato' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
