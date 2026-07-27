// Xodim uchun haqiqiy kirish nuqtasi — sessiya mavjud emas, shuning uchun
// JWT talab qilinmaydi (config.toml'da verify_jwt=false). Ikkita amal:
//
//  - "setup": bir martalik taklif kodi + yangi PIN — admin_complete_pin_setup()
//    orqali tekshiriladi/saqlanadi.
//  - "login": kompaniya kodi + profil + mavjud PIN — admin_verify_pin_for_login()
//    orqali tekshiriladi (5 daqiqada 5 xato — bloklash saqlanadi).
//
// Ikkala holatda ham, muvaffaqiyatli tekshiruvdan so'ng, Admin API
// (generateLink + verifyOtp) orqali HAQIQIY Supabase sessiyasi yaratiladi
// va frontendga qaytariladi — PIN o'zi hech qachon sessiya yaratmaydi,
// faqat shu serverdagi tekshiruvni ishga tushiradi (4-bo'lim talabi
// saqlanadi, faqat SMS o'rniga to'g'ridan-to'g'ri server tekshiruvi bilan).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function mintSession(admin: ReturnType<typeof createClient>, profileId: string) {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileId)
  if (userError || !userData.user?.email) {
    throw new Error("Foydalanuvchi topilmadi (sessiya yaratib bo'lmadi)")
  }
  const email = userData.user.email

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error("Sessiya havolasini yaratib bo'lmadi")
  }

  const plain = createClient(SUPABASE_URL, ANON_KEY)
  const { data: verifyData, error: verifyError } = await plain.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError || !verifyData.session) {
    throw new Error('Sessiya tasdiqlanmadi')
  }
  return verifyData.session
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    if (body.action === 'setup') {
      const { companyCode, inviteCode, pin } = body
      if (!companyCode || !inviteCode || !pin) {
        return json({ error: "Barcha maydonlarni to'ldiring" }, 400)
      }

      const { data: profileId, error: setupError } = await admin.rpc('admin_complete_pin_setup', {
        p_company_code: companyCode,
        p_invite_code: inviteCode,
        p_pin: pin,
      })
      if (setupError) {
        return json({ error: setupError.message }, 400)
      }

      const session = await mintSession(admin, profileId as string)
      return json({ session }, 200)
    }

    if (body.action === 'login') {
      const { companyCode, profileId, pin } = body
      if (!companyCode || !profileId || !pin) {
        return json({ error: "Barcha maydonlarni to'ldiring" }, 400)
      }

      const { data: ok, error: verifyError } = await admin.rpc('admin_verify_pin_for_login', {
        p_company_code: companyCode,
        p_profile_id: profileId,
        p_pin: pin,
      })
      if (verifyError) {
        return json({ error: verifyError.message }, 400)
      }
      if (!ok) {
        return json({ error: "PIN noto'g'ri" }, 401)
      }

      const session = await mintSession(admin, profileId as string)
      return json({ session }, 200)
    }

    return json({ error: "Noto'g'ri amal" }, 400)
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Noma'lum xato" }, 500)
  }
})
