// Owner/Manager tomonidan chaqiriladi (oddiy foydalanuvchi JWT'i bilan —
// verify_jwt yoqilgan, standart). Xodim uchun DARHOL auth.users yozuvini
// yaratadi (Admin API, service_role bilan — bu kalit faqat shu yerda,
// serverda ishlatiladi, hech qachon frontendga chiqmaydi) va bir martalik
// "sozlash kodi" beradi — xodim shu kod bilan pin-auth orqali PIN
// o'rnatadi.
//
// Auth.users identifikatori sifatida SINTETIK EMAIL ishlatiladi (haqiqiy
// odam hech qachon ko'rmaydi, hech qachon xat yuborilmaydi) — chunki
// sessiya yaratish uchun ishlatiladigan Admin generateLink() faqat email
// bilan ishlaydi, telefon bilan emas. Haqiqiy telefon raqami (agar
// berilsa) faqat profiles.phone'da ma'lumot sifatida saqlanadi,
// autentifikatsiya uchun ishlatilmaydi.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VALID_ROLES = ['manager', 'baker', 'driver', 'cashier']
const SYNTHETIC_EMAIL_DOMAIN = 'employees.nontizimi.internal'

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1]
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(normalized))
}

function randomSyntheticEmail() {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return `emp-${id}@${SYNTHETIC_EMAIL_DOMAIN}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: "Avtorizatsiyadan o'tilmagan" }, 401)

    let callerId: string
    try {
      callerId = decodeJwtPayload(token).sub
    } catch {
      return json({ error: 'Yaroqsiz token' }, 401)
    }
    if (!callerId) return json({ error: 'Yaroqsiz token' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('company_id, role, is_active')
      .eq('id', callerId)
      .maybeSingle()

    if (callerError || !caller || !caller.is_active || !['owner', 'manager'].includes(caller.role)) {
      return json({ error: "Ruxsat yo'q" }, 403)
    }

    const { fullName, role, phone } = await req.json()
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return json({ error: 'Ism kerak' }, 400)
    }
    if (!VALID_ROLES.includes(role)) {
      return json({ error: "Noto'g'ri rol" }, 400)
    }

    const providedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null

    let newUserId: string | null = null
    let lastError: string | null = null
    for (let attempt = 0; attempt < 3 && !newUserId; attempt++) {
      const { data, error } = await admin.auth.admin.createUser({
        email: randomSyntheticEmail(),
        email_confirm: true,
      })
      if (!error && data.user) {
        newUserId = data.user.id
        break
      }
      lastError = error?.message || 'Nomaʼlum xato'
    }
    if (!newUserId) {
      return json({ error: `Foydalanuvchi yaratilmadi: ${lastError}` }, 500)
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: newUserId,
      company_id: caller.company_id,
      full_name: fullName.trim(),
      role,
      phone: providedPhone,
      is_active: true,
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId)
      return json({ error: profileError.message }, 500)
    }

    const { data: invite, error: inviteError } = await admin
      .from('invites')
      .insert({
        company_id: caller.company_id,
        full_name: fullName.trim(),
        role,
        phone: providedPhone,
        created_by: callerId,
        profile_id: newUserId,
      })
      .select('code')
      .single()

    if (inviteError) {
      return json({ error: inviteError.message }, 500)
    }

    await admin.from('audit_logs').insert({
      company_id: caller.company_id,
      actor_id: callerId,
      action: 'xodim_qoshildi',
      target_table: 'profiles',
      target_id: newUserId,
    })

    return json({ code: invite.code, profileId: newUserId }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : 'Nomaʼlum xato' }, 500)
  }
})
